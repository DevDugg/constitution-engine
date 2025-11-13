import { asyncHandler } from "../middleware/async-handler";
import { Router, type Response } from "express";
import {
  validateRequest,
  type ValidatedRequest,
} from "../middleware/validate-request";
import {
  createDecisionSchema,
  decisionParamsSchema,
  type CreateDecisionDto,
} from "./schemas";
import { makeDecision } from "../core/decisions/decisions";

const router = Router();

router.post(
  "/decisions/:node",
  validateRequest({ body: createDecisionSchema, params: decisionParamsSchema }),
  asyncHandler(
    async (
      req: ValidatedRequest<{ node: string }, any, CreateDecisionDto>,
      res: Response
    ) => {
      const { node: nodeParam } = req.validated.params;
      const { action, data, correlationId, policyVersion } = req.validated.body;

      const finalCorrelationId = correlationId ?? req.id;

      const decision = await makeDecision({
        node: nodeParam,
        action,
        data,
        correlationId: finalCorrelationId,
        policyVersion,
        req,
      });

      req.log.info(
        {
          decisionId: decision.id,
          node: nodeParam,
          action,
          approved: decision.approved,
          autonomyLevel: decision.autonomyLevel,
          latencyMs: decision.latencyMs,
        },
        "Decision created"
      );

      res.status(201).json({
        success: true,
        data: decision,
      });
    }
  )
);

export { router as decisionsRouter };
