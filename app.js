const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");
const redis = require("redis");
const amqp = require("amqplib");

const { trace } = require("@opentelemetry/api");

// Import the message consumers
const rabbitmqConsumer = require("./rabbitmq-consumer");
const kafkaConsumer = require("./kafka-consumer");

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

// RabbitMQ connection
let channel;
const connectToRabbitMQ = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `Attempting to connect to RabbitMQ (attempt ${i + 1}/${retries})...`
      );
      const connection = await amqp.connect("amqp://admin:admin@rabbitmq:5672");
      channel = await connection.createChannel();

      // Declare a queue with more options to ensure persistence
      const queue = "test_queue";
      await channel.assertQueue(queue, {
        durable: true, // Make the queue durable (survive restart)
        autoDelete: false, // Don't auto-delete when consumers disconnect
      });

      console.log("Successfully connected to RabbitMQ");
      return;
    } catch (error) {
      console.error(
        `Error connecting to RabbitMQ (attempt ${i + 1}/${retries}):`,
        error.message
      );
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("Failed to connect to RabbitMQ after all retries");
        throw error;
      }
    }
  }
};

// Connect to RabbitMQ with retries
connectToRabbitMQ().catch((error) => {
  console.error("Failed to establish RabbitMQ connection:", error);
  process.exit(1);
});

const PORT = parseInt(process.env.PORT || "8000");
const app = express();
app.use(express.json());

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

// RabbitMQ endpoints
app.post("/rabbitmq/send", async (req, res) => {
  try {
    const message = req.body.message || "Hello RabbitMQ!";
    const queue = "test_queue";

    console.log(`Sending message to queue '${queue}': ${message}`);

    // Set persistent: true to make sure the message survives broker restarts
    await channel.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
    });

    // Check queue immediately after sending
    const queueInfoAfterSend = await channel.checkQueue(queue);
    console.log(
      `Queue status after send: ${queueInfoAfterSend.messageCount} messages`
    );

    res.send(`Message sent: ${message}`);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).send("Error sending message");
  }
});

// Replace the problematic receive endpoint with one that shows messages already consumed
app.get("/rabbitmq/messages", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const messages = rabbitmqConsumer.getReceivedMessages(limit);

    res.json({
      count: messages.length,
      messages: messages,
      consumer_active: rabbitmqConsumer.isConsumerActive(),
    });
  } catch (error) {
    console.error("Error retrieving messages:", error);
    res.status(500).send(`Error retrieving messages: ${error.message}`);
  }
});

// Endpoint to check queue status without consuming messages
app.get("/rabbitmq/status", async (req, res) => {
  try {
    const queue = "test_queue";

    // Check queue status
    const queueInfo = await channel.checkQueue(queue);

    res.json({
      queue: queue,
      messageCount: queueInfo.messageCount,
      consumerCount: queueInfo.consumerCount,
      status: "Queue is active",
      consumerRunning: rabbitmqConsumer.isConsumerActive(),
    });
  } catch (error) {
    console.error("Error checking queue status:", error);
    res.status(500).send(`Error checking queue status: ${error.message}`);
  }
});

// Kafka endpoints
app.post("/kafka/send", async (req, res) => {
  try {
    const message = req.body.message || "Hello Kafka!";
    const topic = req.body.topic || kafkaConsumer.DEFAULT_TOPIC;

    console.log(`Sending message to Kafka topic '${topic}': ${message}`);

    await kafkaConsumer.sendMessage(topic, message);

    res.send(`Message sent to Kafka topic '${topic}': ${message}`);
  } catch (error) {
    console.error("Error sending Kafka message:", error);
    res.status(500).send(`Error sending Kafka message: ${error.message}`);
  }
});

app.get("/kafka/messages", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const messages = kafkaConsumer.getReceivedMessages(limit);

    res.json({
      count: messages.length,
      messages: messages,
      consumer_active: kafkaConsumer.isConsumerActive(),
    });
  } catch (error) {
    console.error("Error retrieving Kafka messages:", error);
    res.status(500).send(`Error retrieving Kafka messages: ${error.message}`);
  }
});

app.get("/kafka/topics", async (req, res) => {
  try {
    const topics = await kafkaConsumer.getTopics();

    res.json({
      topics: topics,
      default_topic: kafkaConsumer.DEFAULT_TOPIC,
      consumer_active: kafkaConsumer.isConsumerActive(),
    });
  } catch (error) {
    console.error("Error retrieving Kafka topics:", error);
    res.status(500).send(`Error retrieving Kafka topics: ${error.message}`);
  }
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
