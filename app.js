require("dotenv").config();

const tracer = require("dd-trace").init({
  logInjection: true,
  env: process.env.DD_ENV || "development",
  service: process.env.DD_SERVICE || "nodejs-express-app",
  version: process.env.DD_VERSION || "1.0.0",
  debug: true,
  logger: {
    debug: (message) => console.log("DD-DEBUG", message),
    info: (message) => {
      if (!message.includes("incompatible integration version")) {
        console.log("DD-INFO", message);
      }
    },
    warn: (message) => console.log("DD-WARN", message),
    error: (message) => console.log("DD-ERROR", message),
  },
  // url: "http://localhost:3130/v0.4/traces",
  flushInterval: 5000,
  sampleRate: 1,
  runtimeMetrics: false,
  analytics: false,
  telemetry: false,
  logLevel: "warn",
  hostname: "localhost",
  port: 3130,
  dogstatsd: {
    port: 8001,
    url: "http://localhost:8001/dogstatsd/v2/proxy",
  },
});

const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");
const redis = require("redis");

// const { trace } = require("@opentelemetry/api");

const mysqlClient = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "test",
  port: 3306,
});
mysqlClient.connect((err) => {
  if (err) {
    if (process.env.CUBE_DOCKER_COMPOSE) throw err;
  } else {
    console.log("mysql connected!");
  }
});

const redisClient = redis.createClient({
  url: "redis://localhost:6379",
});
redisClient.connect().catch((err) => {
  if (err) {
    if (process.env.CUBE_DOCKER_COMPOSE) throw err;
  } else {
    console.log("redis connected!");
  }
});

const PORT = parseInt(process.env.PORT || "8001");
const app = express();

app.use(express.json());
app.use(express.raw({ type: "application/msgpack" }));

app.use((req, res, next) => {
  const span = tracer.scope().active();
  if (span) {
    const spanData = {
      name: span.name,
      service: span._service,
      resource: span._resource,
      type: span._type,
      tags: span.context()._tags,
      meta: span.context()._meta,
      metrics: span.context()._metrics,
      startTime: span._startTime,
      duration: span._duration,
      context: {
        traceId: span.context().toTraceId(),
        spanId: span.context().toSpanId(),
        parentId: span.context().parentId
          ? span.context().parentId.toString()
          : null,
      },
    };
  }
  next();
});

app.get("/", (req, res) => {
  res.send("Hello");
});

app.get("/param/:param", function (req, res) {
  res.send("Got param " + req.params.param);
});

app.get("/exception", function (req, res) {
  throw new Error("Sample exception");
});

app.get("/api", (req, res) => {
  axios
    .get("http://localhost:8001/")
    .then((response) => res.send("API called"));
});

app.get("/mysql", (req, res) => {
  mysqlClient.query("SELECT NOW()", (err, results, fields) => {
    res.send(results[0]["NOW()"]);
  });
});

app.get("/redis", (req, res) => {
  redisClient.set("foo", "bar");
  res.send("Redis called");
});

const errorHandler = (err, req, res, next) => {
  // const span = trace.getActiveSpan();
  // if (span) {
  //   span.recordException(err);
  // }

  // pass the error to the next middleware
  // you can do any custom error handling here
  next(err);
};

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
