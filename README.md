# OpenTelemetry Instrumentation

This branch contains code for OpenTelemetry instrumentation.

Hitting an API endpoint will generate the corresponding traces. Traces are printed to console (where docker compose is running) by default. If you want to send traces to a backend tool, comment out the `OTEL_LOG_LEVEL` line and uncomment the `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` line in [docker-compose.yml](docker-compose.yml).

Runtime metrics will also be printed on console by default. If you want to send metrics to a backend tool, comment out the `OTEL_METRICS_EXPORTER=console` line and uncomment the `OTEL_METRICS_EXPORTER=otlp` and `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` lines in [docker-compose.yml](docker-compose.yml).

Refer the project README below for more details.

---

# NodeJS ExpressJS Instrumentation

This is a sample app to demonstrate how to instrument NodeJS ExpressJS app with **Datadog**, **Elastic**, **New Relic** and **OpenTelemetry**. It contains source code for the ExpressJS app which interacts with various services like Redis, MySQL, etc. to demonstrate tracing for these services. This repository has a docker compose file to set up all these services conveniently.

The code is organized into multiple branches. The main branch has the ExpressJS app without any instrumentation. Other branches then build upon the main branch to add specific instrumentations as below:

| Branch                                                                         | Instrumentation | Code changes for instrumentation                                                                |
| ------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------- |
| [main](https://github.com/cubeapm/sample_app_nodejs_express/tree/main)         | None            | -                                                                                               |
| [datadog](https://github.com/cubeapm/sample_app_nodejs_express/tree/datadog) | Datadog       | [main...datadog](https://github.com/cubeapm/sample_app_nodejs_express/compare/main...datadog) |
| [elastic](https://github.com/cubeapm/sample_app_nodejs_express/tree/elastic)         | Elastic   | [main...elastic](https://github.com/cubeapm/sample_app_nodejs_express/compare/main...elastic)         |
| [newrelic](https://github.com/cubeapm/sample_app_nodejs_express/tree/newrelic) | New Relic       | [main...newrelic](https://github.com/cubeapm/sample_app_nodejs_express/compare/main...newrelic) |
| [otel](https://github.com/cubeapm/sample_app_nodejs_express/tree/otel)         | OpenTelemetry   | [main...otel](https://github.com/cubeapm/sample_app_nodejs_express/compare/main...otel)         |

## Setup

Clone this repository and go to the project directory. Then run the following commands

```
npm install
docker compose up --build
```

ExpressJS app will now be available at `http://localhost:8000`.

The app has various API endpoints to demonstrate integrations with Redis, MySQL, etc. Check out [app.js](app.js) for the list of API endpoints.

## Contributing

Please feel free to raise PR for any enhancements - additional service integrations, library version updates, documentation updates, etc.
