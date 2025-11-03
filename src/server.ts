import express, { type Request } from "express";
import { healthRouter } from "./routes/health";
import { env } from "./config/env";
import { pinoHttp } from "pino-http";
import { generateRequestId } from "./lib/generate-request-id";
import { metricsRouter } from "./routes/metrics";

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

const app = express();

app.use(logger);
app.use(express.json());

// routes
app.use(healthRouter);
app.use(metricsRouter);

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
