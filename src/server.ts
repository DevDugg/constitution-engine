import express, { type Request } from "express";
import { healthRouter } from "./routes/health";
import { env } from "./config/env";
import { pinoHttp } from "pino-http";
import pino from "pino";
import { generateRequestId } from "./lib/generate-request-id";
import { metricsRouter } from "./routes/metrics";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";
import { errorHandler } from "./middleware/error-handler";
import { decisionsRouter } from "./routes/decisions";
import { outcomesRouter } from "./routes/outcomes";

// Create base logger for non-request logging
const baseLogger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

const logger = pinoHttp({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
  genReqId: (req: Request): string => {
    return generateRequestId(req as Request);
  },
});

// Process-level error handlers - prevent crashes
process.on("uncaughtException", (error: Error) => {
  baseLogger.fatal({ err: error }, "Uncaught exception - service will exit");
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason: any) => {
  baseLogger.error({ err: reason }, "Unhandled promise rejection - continuing");
  // Don't exit - log and continue for resilience
});

// Graceful shutdown handler
process.on("SIGTERM", () => {
  baseLogger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    baseLogger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  baseLogger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    baseLogger.info("Server closed");
    process.exit(0);
  });
});

// Run migrations with error handling
try {
  baseLogger.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  baseLogger.info("Database migrations completed");
} catch (error) {
  baseLogger.fatal({ err: error }, "Database migration failed");
  process.exit(1);
}

const app = express();

app.use(logger);
app.use(express.json());

// routes
app.use(healthRouter);
app.use(metricsRouter);
app.use(decisionsRouter);
app.use(outcomesRouter);

// error handler (must be last)
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  baseLogger.info({ port: env.PORT }, "Server is running");
});
