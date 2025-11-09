import type { NextFunction, Request, Response } from "express";
import type z from "zod";
import { ValidationError } from "../errors/validation-error";

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: any;
        query?: any;
        params?: any;
      };
    }
  }
}

interface ValidationSchema {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

const validateRequest = (schemas: ValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const errors: { message: string; field?: string }[] = [];
    req.validated = {};

    const targets = ["body", "query", "params"] as const;

    for (const target of targets) {
      const schema = schemas[target as keyof ValidationSchema];

      if (schema) {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            errors.push({
              field: issue.path.length > 0 ? issue.path.join(".") : target,
              message: issue.message,
            });
          });
        } else {
          req.validated[target] = result.data;
        }
      }
    }
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    next();
  };
};

type ValidatedRequest<
  P = {},
  ResBody = any,
  ReqBody = any,
  ReqQuery = {}
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  validated?: {
    params?: P;
    body?: ReqBody;
    query?: ReqQuery;
  };
};

export { validateRequest, type ValidatedRequest };
