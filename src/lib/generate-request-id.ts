import { type Request } from "express";
import { generateUuid } from "./uuid";

export const generateRequestId = (req: Request): string => {
  return (req.headers["x-cid"] as string) ?? generateUuid();
};
