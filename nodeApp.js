const express = require("express");
const { decode } = require("@msgpack/msgpack");
const app = express();
const PORT = 8000;

// Middleware to parse JSON and msgpack
app.use(express.json());
app.use(express.raw({ type: "application/msgpack" }));

// Function to filter Express application spans
function isExpressSpan(span) {
  return (
    // Include only express-related spans
    span.name?.startsWith("express.") ||
    // Include the main web request span
    (span.type === "web" && span.name === "express.request")
  );
}

// Format the span data to show all fields
function formatSpan(span) {
  // Return all fields from the span
  return {
    // Core span fields
    name: span.name,
    resource: span.resource,
    service: span.service,
    type: span.type,
    start: span.start,
    duration: `${(span.duration / 1000000).toFixed(2)}ms`,

    // Span identifiers
    trace_id: span.trace_id,
    span_id: span.span_id,
    parent_id: span.parent_id || "none",

    // Error information
    error: span.error,

    // Metadata and tags
    meta: span.meta || {},
    metrics: span.metrics || {},

    // Additional fields if they exist
    ...(span.sampling_priority && {
      sampling_priority: span.sampling_priority,
    }),
    ...(span.origin && { origin: span.origin }),
    ...(span.links && { links: span.links }),

    // Raw span for debugging (uncomment if needed)
    _raw: span,
  };
}

// Handle trace data
app.all("/v0.4/traces", (req, res) => {
  try {
    let traces =
      req.headers["content-type"] === "application/msgpack"
        ? decode(req.body)
        : req.body;

    console.log(JSON.stringify(traces, null, 2));
  } catch (error) {
    console.error("Error processing traces:", error);
  }
  res.json({ status: "success", message: "success" });
});

// Handle metrics data
app.all("/dogstatsd/v2/proxy", (req, res) => {
  console.log("\n=== Metrics Data ===");
  // console.log("Method:", req.method);
  // console.log("Headers:", req.headers);
  // console.log("Body:", req.body);
  // console.log("===================\n");
  res.json({ status: "success" });
});

// Handle logs data
app.all("/v1/input", (req, res) => {
  console.log("\n=== Log Data ===");
  console.log("Path:", req.path);
  res.json({ status: "success" });
});

// Handle telemetry data
app.all("/telemetry/proxy/api/v2/apmtelemetry", (req, res) => {
  console.log("\n=== Telemetry Data ===");
  // console.log("=====================\n");
  res.json({ status: "success" });
});

// Handle configuration requests
app.all("/v0.7/config", (req, res) => {
  console.log("\n=== Configuration Request ===");
  res.json({ status: "success" });
});

// Log any unhandled routes that dd-trace might be trying to reach
app.all("*", (req, res) => {
  console.log("\n=== Unhandled DD-Trace Request ===");
  console.log("Path:", req.path);
  // console.log("Method:", req.method);
  // console.log("Headers:", req.headers);
  // console.log("Body:", req.body);
  console.log("==============================\n");
  res.json({ status: "success" });
});

app.listen(PORT, () => {
  console.log(`Trace collector listening on http://localhost:${PORT}`);
  console.log("Ready to receive Datadog agent data...");
});
