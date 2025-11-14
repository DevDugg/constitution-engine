import { Router, type Response } from "express";
import {
  validateRequest,
  type ValidatedRequest,
} from "../middleware/validate-request";
import { asyncHandler } from "../middleware/async-handler";
import {
  createOutcomeSchema,
  type CreateOutcomeDto,
  outcomeParamsSchema,
  type OutcomeParamsDto,
} from "./schemas";
import { db } from "../db";
import { decisions, outcomes } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../errors/not-found-error";
import { computeReward } from "../core/learning/reward";
import type { RewardInput } from "../core/learning/types";

const router = Router();

/**
 * POST /outcomes/:decisionId
 *
 * Records the outcome of a previous decision.
 * Uses upsert semantics - updates if outcome already exists.
 *
 * This closes the learning loop:
 * Event → Decision → Outcome → Reward → Bandit Stats
 */
router.post(
  "/outcomes/:decisionId",
  validateRequest({
    body: createOutcomeSchema,
    params: outcomeParamsSchema,
  }),
  asyncHandler(
    async (
      req: ValidatedRequest<OutcomeParamsDto, any, CreateOutcomeDto>,
      res: Response
    ) => {
      const { decisionId } = req.validated.params!;
      const { metrics, correlationId } = req.validated.body;

      const finalCorrelationId = correlationId ?? req.id;

      // Fetch the decision to validate it exists and get context
      const decision = await db.query.decisions.findFirst({
        where: eq(decisions.id, decisionId),
      });

      if (!decision) {
        throw new NotFoundError(`Decision ${decisionId} not found`);
      }

      // Upsert outcome (decision_id is primary key)
      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId,
          metrics,
          correlationId: finalCorrelationId,
        })
        .onConflictDoUpdate({
          target: outcomes.decisionId,
          set: {
            metrics,
            recordedAt: new Date(),
            correlationId: finalCorrelationId,
          },
        })
        .returning();

      // Compute reward for learning
      const rewardInput: RewardInput = {
        decision: {
          autonomyLevel: decision.autonomyLevel,
          inputs: decision.inputs as Record<string, any>,
          output: decision.output as Record<string, any>,
          policyVersion: decision.policyVersion,
          node: decision.node,
        },
        outcome: {
          metrics,
        },
        // Extract matched band constraints from decision output if available
        matchedBandConstraints: (decision.output as any)?.matchedBand
          ?.constraints,
      };

      const rewardResult = computeReward(rewardInput);

      req.log.info(
        {
          decisionId,
          outcomeRecorded: true,
          rewardComputed: rewardResult !== null,
          success: rewardResult?.success,
          score: rewardResult?.score,
        },
        "Outcome recorded"
      );

      res.status(201).json({
        success: true,
        data: {
          decisionId: outcome!.decisionId,
          metrics: outcome!.metrics,
          recordedAt: outcome!.recordedAt,
          correlationId: outcome!.correlationId,
          reward: rewardResult,
        },
      });
    }
  )
);

/**
 * GET /outcomes/:decisionId
 *
 * Retrieves the outcome for a specific decision.
 */
router.get(
  "/outcomes/:decisionId",
  validateRequest({ params: outcomeParamsSchema }),
  asyncHandler(
    async (
      req: ValidatedRequest<OutcomeParamsDto, any, any>,
      res: Response
    ) => {
      const { decisionId } = req.validated.params!;

      const outcome = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, decisionId),
      });

      if (!outcome) {
        throw new NotFoundError(`Outcome for decision ${decisionId} not found`);
      }

      res.status(200).json({
        success: true,
        data: {
          decisionId: outcome.decisionId,
          metrics: outcome.metrics,
          recordedAt: outcome.recordedAt,
          correlationId: outcome.correlationId,
        },
      });
    }
  )
);

export { router as outcomesRouter };
