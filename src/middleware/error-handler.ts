import { type Request, type Response, type NextFunction } from "express";
import { CustomError } from "../errors/custom-error";

/**
 * Global error handler for Express.
 * Catches all errors thrown in routes/middleware and formats responses.
 *
 * - CustomErrors: Return structured error with appropriate status code
 * - Unknown errors: Log fully but return generic message (don't leak internals)
 *
 * This handler ensures the service never crashes on request errors.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle known custom errors
  if (err instanceof CustomError) {
    req.log?.warn(
      {
        err,
        statusCode: err.statusCode,
        errors: err.serializeErrors(),
      },
      "Request error (handled)"
    );

    return res.status(err.statusCode).json({
      errors: err.serializeErrors(),
    });
  }

  // Unknown/unexpected errors - log fully but don't leak details
  req.log?.error(
    {
      err,
      stack: err.stack,
      message: err.message,
    },
    "Unhandled error in request"
  );

  // Don't expose internal error details in production
  res.status(500).json({
    errors: [{ message: "Internal server error" }],
  });
};
