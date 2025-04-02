const amqp = require("amqplib");

// Initialize a simple in-memory store for received messages
// In a real-world app, you'd use a proper database
const receivedMessages = [];
let messageCount = 0;

// Flag to track if the consumer is running
let isConsumerRunning = false;

// RabbitMQ connection and channel
let connection = null;
let channel = null;

// Connect to RabbitMQ
async function connectToRabbitMQ(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `Attempting to connect to RabbitMQ (attempt ${i + 1}/${retries})...`
      );
      connection = await amqp.connect("amqp://admin:admin@rabbitmq:5672");

      // Handle connection close events
      connection.on("close", () => {
        console.log("RabbitMQ connection closed. Reconnecting...");
        setTimeout(() => connectToRabbitMQ(), 5000);
      });

      connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err.message);
        if (connection) connection.close();
      });

      channel = await connection.createChannel();

      // Declare the queue
      const queue = "test_queue";
      await channel.assertQueue(queue, {
        durable: true,
        autoDelete: false,
      });

      console.log("Successfully connected to RabbitMQ");

      // Start consuming messages
      await startConsumer();

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
}

// Start consuming messages
async function startConsumer() {
  if (isConsumerRunning) {
    console.log("Consumer is already running");
    return;
  }

  try {
    const queue = "test_queue";

    console.log("Starting RabbitMQ consumer...");

    await channel.consume(
      queue,
      (msg) => {
        if (msg) {
          try {
            const content = msg.content.toString();
            const timestamp = new Date().toISOString();

            // Store the message
            messageCount++;
            receivedMessages.push({
              id: messageCount,
              content,
              timestamp,
              processed: true,
            });

            // Only keep the 100 most recent messages
            if (receivedMessages.length > 100) {
              receivedMessages.shift();
            }

            console.log(
              `[${timestamp}] Received message #${messageCount}: ${content}`
            );

            // Acknowledge the message
            channel.ack(msg);
          } catch (error) {
            console.error("Error processing message:", error);
            // Nack and don't requeue if it's a processing error
            channel.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );

    isConsumerRunning = true;
    console.log("RabbitMQ consumer started successfully");
  } catch (error) {
    console.error("Failed to start consumer:", error);
    isConsumerRunning = false;
  }
}

// Get received messages (for API endpoints)
function getReceivedMessages(limit = 10) {
  return receivedMessages.slice(-limit);
}

// Function to check if consumer is running
function isConsumerActive() {
  return isConsumerRunning;
}

// Connect to RabbitMQ when this module is loaded
connectToRabbitMQ().catch((error) => {
  console.error("Failed to initialize message consumer:", error);
});

module.exports = {
  getReceivedMessages,
  isConsumerActive,
};
