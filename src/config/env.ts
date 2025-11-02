import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),
  //   OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  //   SLACK_BOT_TOKEN: z.string().min(1, "SLACK_BOT_TOKEN is required").optional(),
  //   INTERNAL_JOB_TOKEN: z.string().min(1, "INTERNAL_JOB_TOKEN is required"),
  //   NODE_ENV: z
  //     .enum(["development", "production", "test"])
  //     .default("development"),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((err: z.core.$ZodIssue) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(
        `Missing or invalid environment variables:\n${missingVars}`
      );
    }
    throw error;
  }
}

export const env = loadEnv();
