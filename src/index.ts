import { env } from "./config/env";
import { drizzle } from "drizzle-orm/bun-sql";

const db = drizzle(env.DATABASE_URL);
