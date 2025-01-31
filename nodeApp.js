const express = require("express");
const { decode } = require("@msgpack/msgpack");

const app = express();
const PORT = 8000;

// Middleware to parse JSON and NDJSON
app.use(express.json());
app.use(express.raw({ type: "application/x-ndjson" })); // For Elastic APM data

// Function to parse NDJSON
const parseNDJSON = (data) => {
  return data
    .toString()
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error("Error parsing NDJSON line:", e);
        return null;
      }
    })
    .filter((item) => item !== null);
};

// APM Server info endpoint
app.get("/", (req, res) => {
  res.json({
    version: "8.12.1",
    version_major: 8,
    version_minor: 12,
    version_patch: 1,
  });
});

// Agent config endpoint
app.get("/config/v1/agents", (req, res) => {
  console.log("\n=== Agent Config Request ===");
  console.log("Query:", req.query);
  // Send config with sampling enabled
  res.json({
    transaction_sample_rate: "1.0", // Enable sampling
    transaction_max_spans: "500",
    capture_body: "all",
  });
});

app.post("/telemetry/proxy/api/v2/apmtelemetry", (req, res) => {
  console.log("\n=== APM Telemetry Request ===");
  // console.log("Headers:", req.headers);
  // console.log("Body:", req.body);
  res.status(202).send("Accepted");
});

// Handle Elastic APM intake
app.post("/intake/v2/events", (req, res) => {
  try {
    console.log("\n=== Elastic APM Data ===");
    // console.log("Headers:", req.headers);

    // Parse NDJSON data
    const parsedData = parseNDJSON(req.body);
    console.log(JSON.stringify(parsedData));

    // Process different types of data
    // parsedData.forEach((data) => {
    //   if (data.metadata) {
    //     console.log("\nService Metadata:");
    //     console.log(data.metadata);
    //   } else if (data.transaction) {
    //     console.log("\nTransaction:");
    //     console.log(data.transaction);
    //   } else if (data.span) {
    //     console.log("\nSpan:");
    //     console.log(data.span);
    //   } else if (data.metricset) {
    //     console.log("\nMetrics:");
    //     // console.log(data.metricset);
    //   } else if (data.error) {
    //     // Show full error data
    //     console.log("\nError Event:");
    //     console.log(data.error);

    //     // Show detailed exception info if available
    //     if (data.error.exception) {
    //       console.log("\nException Details:");
    //       console.log(data.error.exception);
    //     }
    //   }
    // });

    // console.log("========================\n");
    res.status(202).send("Accepted");
  } catch (error) {
    console.error("Error processing APM data:", error);
    res.status(500).send("Error processing data");
  }
});

// Log unhandled routes
app.all("*", (req, res) => {
  console.log("Unhandled route:", req.method, req.url);
  console.log("Headers:", req.headers);
  res.status(200).send("OK");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Trace collector listening on http://localhost:${PORT}`);
  console.log("Ready to receive Elastic APM data...");
});
