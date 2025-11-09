import { type Request, type Response, type NextFunction } from "express";
import { CustomError } from "../errors/custom-error";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log the error
  req.log?.error(err);

  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      errors: err.serializeErrors(),
    });
  }

  // Unknown error - don't leak details in production
  console.error(err);
  res.status(500).json({
    errors: [{ message: "Internal server error" }],
  });
};
