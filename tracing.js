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
const {
    BatchLogRecordProcessor,
    SimpleLogRecordProcessor,
    ConsoleLogRecordExporter,
} = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-proto");

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

const logProcessor = process.env.OTEL_LOG_LEVEL === "debug"
    ? new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
    // It automatically reads ENDPOINT and HEADERS from env variables
    : new BatchLogRecordProcessor(new OTLPLogExporter({}));

const sdk = new opentelemetry.NodeSDK({
  traceExporter,
  logRecordProcessors: [logProcessor],
  instrumentations: getNodeAutoInstrumentations({
    "@opentelemetry/instrumentation-fs": {
      enabled: false,
    },
    "@opentelemetry/instrumentation-winston": {
      // Log sending needs @opentelemetry/winston-transport npm package.
      // If it is not installed, logs will not be sent.
      disableLogSending: !process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    },
  }),
});

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry
sdk.start();
