import { type Request, type NextFunction } from "express";

export const requestMiddleware = (req: Request, next: NextFunction) => {
  req.log.info("Request received");
  next();
};
