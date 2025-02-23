"use strict";
const process = require("process");
const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const opentelemetry = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");

if (process.env.OTEL_LOG_LEVEL === "debug") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const exporterOptions = {
  // concurrencyLimit: 1,
};
const traceExporter =
  process.env.OTEL_LOG_LEVEL === "debug"
    ? new opentelemetry.tracing.ConsoleSpanExporter()
    : new OTLPTraceExporter(exporterOptions);

const sdk = new opentelemetry.NodeSDK({
  traceExporter,
  instrumentations: getNodeAutoInstrumentations({
    "@opentelemetry/instrumentation-fs": {
      enabled: false,
    },
  }),
});

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry
sdk.start();
