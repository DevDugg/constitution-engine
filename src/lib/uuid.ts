import crypto from "node:crypto";

export const generateUuid = (): string => {
  return crypto.randomUUID();
};
