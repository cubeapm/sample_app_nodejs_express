const apm = require("elastic-apm-node").start({
  serviceName: "nodejs-express-app",
  serverUrl: "http://localhost:3130",
  environment: process.env.NODE_ENV || "development",

  // Turn on complete tracing
  active: true,
  instrument: true,

  // Capture everything
  transactionSampleRate: 1.0, // Sample all transactions
  captureSpans: true, // Enable span capture
  spanCompressionEnabled: false, // Don't compress spans
  spanFramesMinDuration: -1, // Capture all spans regardless of duration

  // Increase detail level
  stackTraceLimit: 50,
  captureBody: "all",
  captureErrorLogStackTraces: "always",
  captureSpanStackTraces: true,

  // Ensure all instrumentations are enabled
  instrumentations: {
    "@elastic/elasticsearch": true,
    mysql2: true,
    redis: true,
    express: true,
    http: true,
    core: true, // Add core instrumentation
    "all-callbacks": true, // Track all callbacks
  },

  // Debug settings
  logLevel: "trace", // Most verbose logging

  // Remove any filters
  ignoreUrls: [],
  disableInstrumentations: [],

  centralConfig: false, // Disable central config
});

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");
const redis = require("redis");

const { trace } = require("@opentelemetry/api");

const mysqlClient = mysql
  .createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "test",
    port: 3306,
  })
  .promise();

const redisClient = redis.createClient({
  url: "redis://redis:6379",
});

redisClient.connect().catch((err) => {
  if (err) {
    if (process.env.CUBE_DOCKER_COMPOSE) throw err;
  } else {
    console.log("redis connected!");
  }
});

const testFunction = () => {
  console.log("testFunction called");
};

const PORT = parseInt(process.env.PORT || "8001");
const app = express();

app.use(express.json());
// app.use(express.raw({ type: "application/msgpack" }));

// Add after app creation and before routes
app.use(apm.middleware.connect());

app.get("/", (req, res) => {
  console.log("root endpoint called");
  res.send("Hello");
});

app.get("/param/:param", function (req, res) {
  // logger.info("Param endpoint called", { param: req.params.param });
  res.send("Got param " + req.params.param);
});

app.get("/exception", function (req, res) {
  // logger.error("Exception endpoint called", { path: "/exception" });
  throw new Error("Sample exception");
});

app.get("/api", (req, res) => {
  axios
    .get("http://localhost:8001/mysql")
    .then((response) => {
      testFunction();
      res.send("API called");
    })
    .catch((error) => {
      res.status(500).send("API call failed");
    });
});

app.get("/mysql", async (req, res) => {
  try {
    const [results] = await mysqlClient.query("SELECT NOW()");
    res.send(results[0]["NOW()"]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/redis", (req, res) => {
  redisClient.set("foo", "bar");
  res.send("Redis called");
});

// Add logging to error handler
const errorHandler = (err, req, res, next) => {
  next(err);
};

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
