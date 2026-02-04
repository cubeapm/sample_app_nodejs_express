const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");
const redis = require("redis");

const { trace } = require("@opentelemetry/api");

const mysqlClient = mysql.createConnection({
  host: "mysql",
  user: "root",
  password: "root",
  database: "test",
});
mysqlClient.connect((err) => {
  if (err) {
    if (process.env.CUBE_DOCKER_COMPOSE) throw err;
  } else {
    console.log("mysql connected!");
  }
});

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

const PORT = parseInt(process.env.PORT || "8000");
const app = express();


// Dummy middleware. Returns 401 Unauthorized for requests to '/middlewares'.
function authMiddleware(req, res, next) {
  if (req.path === '/middlewares') {
    return res.status(401).json({error: "Unauthorized"});
  }
  // Condition passed. Continue to next middleware/route.
  next();
}

app.use(authMiddleware);


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
    .get("http://localhost:8000/")
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

app.get("/middlewares", (req, res) => {
  res.send("middlewares done");
});

const errorHandler = (err, req, res, next) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
  }

  // pass the error to the next middleware
  // you can do any custom error handling here
  next(err);
};

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
