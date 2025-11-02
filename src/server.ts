import express from "express";
import { healthRouter } from "./routes/health";
import { env } from "./config/env";

const app = express();
app.use(express.json());
app.use("/health", healthRouter);

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
