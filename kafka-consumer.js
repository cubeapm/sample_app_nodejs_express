const { Kafka } = require("kafkajs");

// Initialize a simple in-memory store for received messages
// In a real-world app, you'd use a proper database
const receivedMessages = [];
let messageCount = 0;

// Flag to track if the consumer is running
let isConsumerRunning = false;

// Kafka client and consumer
let kafka = null;
let consumer = null;
let producer = null;

// Default topic
const DEFAULT_TOPIC = "test-topic";

// Connect to Kafka
async function connectToKafka(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(
        `Attempting to connect to Kafka (attempt ${i + 1}/${retries})...`
      );

      // Create Kafka client
      kafka = new Kafka({
        clientId: "nodejs-express-app",
        brokers: ["kafka:9092"],
        retry: {
          initialRetryTime: 300,
          retries: 10,
          maxRetryTime: 30000,
        },
        // Add a higher request timeout
        requestTimeout: 60000,
      });

      // Create consumer
      consumer = kafka.consumer({
        groupId: "nodejs-express-group",
        sessionTimeout: 30000,
        // Set a high retry value
        retry: {
          initialRetryTime: 1000,
          maxRetryTime: 30000,
          retries: 10,
        },
      });

      await consumer.connect();

      // Create producer
      producer = kafka.producer({
        allowAutoTopicCreation: false,
        retry: {
          initialRetryTime: 1000,
          maxRetryTime: 30000,
          retries: 10,
        },
      });
      await producer.connect();

      console.log("Successfully connected to Kafka");

      try {
        // Create the default topic explicitly with retry logic
        await createTopicIfNotExists(DEFAULT_TOPIC);
      } catch (topicError) {
        console.error("Error creating default topic:", topicError.message);
        console.log("Will retry topic creation during consumer start...");
        // Continue with initialization, we'll retry during consumer start
      }

      // Start consuming messages
      await startConsumer();

      return;
    } catch (error) {
      console.error(
        `Error connecting to Kafka (attempt ${i + 1}/${retries}):`,
        error.message
      );
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("Failed to connect to Kafka after all retries");
        // Don't throw, continue with app initialization
        console.error("Will continue without Kafka consumer");
        return;
      }
    }
  }
}

// Create a topic if it doesn't exist
async function createTopicIfNotExists(topic, config = {}) {
  let admin = null;
  try {
    admin = kafka.admin();
    await admin.connect();
    console.log(`Checking if topic '${topic}' exists...`);

    // List existing topics
    const topics = await admin.listTopics();
    console.log("Available topics:", topics);

    if (!topics.includes(topic)) {
      // Default configuration with sensible values
      const topicConfig = {
        numPartitions: config.numPartitions || 1,
        replicationFactor: config.replicationFactor || 1,
        configEntries: config.configEntries || [
          {
            name: "retention.ms",
            value: "604800000", // 7 days
          },
          {
            name: "cleanup.policy",
            value: "delete",
          },
        ],
      };

      // Create the topic
      console.log(`Creating topic '${topic}' with config:`, topicConfig);
      await admin.createTopics({
        topics: [
          {
            topic,
            ...topicConfig,
          },
        ],
        waitForLeaders: true,
      });
      console.log(`Created topic: ${topic} successfully`);
    } else {
      console.log(`Topic already exists: ${topic}`);
    }
  } catch (error) {
    console.error(`Error creating/checking Kafka topic ${topic}:`, error);
    throw error; // Re-throw to handle it in the caller
  } finally {
    if (admin) {
      try {
        await admin.disconnect();
      } catch (err) {
        console.error("Error disconnecting admin client:", err);
      }
    }
  }
}

// Start consuming messages
async function startConsumer() {
  if (isConsumerRunning) {
    console.log("Kafka consumer is already running");
    return;
  }

  try {
    console.log("Starting Kafka consumer...");

    // Make sure the topic exists before subscribing
    try {
      await createTopicIfNotExists(DEFAULT_TOPIC);
    } catch (topicError) {
      console.error(
        "Failed to create topic during consumer start:",
        topicError.message
      );
      console.warn(
        "Will attempt to subscribe anyway, but consumption may fail"
      );
    }

    // Subscribe to the default topic
    await consumer.subscribe({
      topic: DEFAULT_TOPIC,
      fromBeginning: true,
    });

    // Run the consumer
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const content = message.value.toString();
          const timestamp = new Date().toISOString();

          // Store the message
          messageCount++;
          receivedMessages.push({
            id: messageCount,
            topic,
            partition,
            offset: message.offset,
            content,
            timestamp,
            processed: true,
          });

          // Only keep the 100 most recent messages
          if (receivedMessages.length > 100) {
            receivedMessages.shift();
          }

          console.log(
            `[${timestamp}] Received Kafka message #${messageCount} from ${topic}: ${content}`
          );
        } catch (error) {
          console.error("Error processing Kafka message:", error);
        }
      },
    });

    isConsumerRunning = true;
    console.log("Kafka consumer started successfully");
  } catch (error) {
    console.error("Failed to start Kafka consumer:", error);
    isConsumerRunning = false;
  }
}

// Send a message to Kafka
async function sendMessage(topic = DEFAULT_TOPIC, message) {
  try {
    if (!producer) {
      throw new Error("Kafka producer not connected");
    }

    // Ensure the topic exists before sending
    if (topic !== DEFAULT_TOPIC) {
      try {
        await createTopicIfNotExists(topic);
      } catch (topicError) {
        console.error(`Failed to create topic '${topic}':`, topicError.message);
        throw new Error(
          `Failed to create topic '${topic}': ${topicError.message}`
        );
      }
    }

    // Send the message
    const result = await producer.send({
      topic,
      messages: [
        {
          value:
            typeof message === "string" ? message : JSON.stringify(message),
        },
      ],
    });

    console.log(`Message sent to topic '${topic}' successfully:`, result);
    return true;
  } catch (error) {
    console.error("Error sending Kafka message:", error);
    throw error;
  }
}

// Get received messages (for API endpoints)
function getReceivedMessages(limit = 10) {
  return receivedMessages.slice(-limit);
}

// Get topics (for API endpoints)
async function getTopics() {
  try {
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();
    return topics;
  } catch (error) {
    console.error("Error getting Kafka topics:", error);
    return [];
  }
}

// Function to check if consumer is running
function isConsumerActive() {
  return isConsumerRunning;
}

// Connect to Kafka when this module is loaded
connectToKafka().catch((error) => {
  console.error("Failed to initialize Kafka consumer:", error);
});

module.exports = {
  getReceivedMessages,
  getTopics,
  isConsumerActive,
  sendMessage,
  DEFAULT_TOPIC,
};
