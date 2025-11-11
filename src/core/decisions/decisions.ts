import { Router, type Response, type Request } from "express";
import {
  validateRequest,
  type ValidatedRequest,
} from "../../middleware/validate-request";
import { asyncHandler } from "../../middleware/async-handler";
import {
  createDecisionSchema,
  decisionParamsSchema,
  type CreateDecisionDto,
} from "../../routes/schemas";
import PolicyLoader from "../policy/loader";
// import { assemble } from "../memory/assembler";
import { evaluate } from "../policy/evaluator";
import { db } from "../../db";
import { decisions } from "../../db/schema";
import { desc } from "drizzle-orm";
import { computeDecisionHash } from "../../lib/hash";
import { BadRequestError } from "../../errors/bad-request-error";
import { NotFoundError } from "../../errors/not-found-error";

const router = Router();

interface MakeDecisionOutput {
  id: string;
  approved: boolean;
  autonomyLevel: number;
  reason: string;
  hash: string;
  prevHash: string | null;
  policyVersion: string;
  latencyMs: number;
  escalationTarget?: string;
  correlationId: string;
  ts: Date;
}

interface MakeDecisionParams {
  node: string;
  action: string;
  data: Record<string, any>;
  correlationId: string;
  policyVersion?: string;
  req: Request;
}

const makeDecision = async (
  params: MakeDecisionParams
): Promise<MakeDecisionOutput> => {
  const {
    node,
    action,
    data,
    correlationId,
    policyVersion,
    // req
  } = params;

  const startTime = performance.now();

  const policyName = policyVersion ?? `${node}-constitution`;

  const policy = await PolicyLoader.load(policyName);

  const policyNode = policy.doc.nodes[node];
  if (!policyNode) {
    throw new NotFoundError(`Node '${node}' not found in policy ${policyName}`);
  }

  const authority = policyNode.authorities.find((a) => a.action === action);
  if (!authority) {
    throw new BadRequestError(
      `Action '${action}' not found in node '${node}' of policy ${policyName}`
    );
  }

  //   no llm evaluations yet, hence a stub
  //   const context = await assemble(
  //     {
  //       node,
  //       inputData: data,
  //       contextVec: [],
  //       options: {},
  //     },
  //     req
  //   );

  const evaluationResult = evaluate({ action, data }, authority);

  const previousDecision = await db.query.decisions.findFirst({
    orderBy: [desc(decisions.ts)],
    columns: { hash: true },
  });

  const prevHash = previousDecision?.hash ?? null;

  const output = {
    approved: evaluationResult.approved,
    autonomyLevel: evaluationResult.autonomyLevel,
    reason: evaluationResult.reason,
    ...(evaluationResult.escalationTarget && {
      escalationTarget: evaluationResult.escalationTarget,
    }),
  };

  const hash = computeDecisionHash({
    inputs: data,
    output,
    prevHash,
    policyVersion: `${policy.name}@${policy.version}`,
  });

  const latencyMs = Math.round(performance.now() - startTime);

  const [insertedDecision] = await db
    .insert(decisions)
    .values({
      node,
      policyVersion: `${policy.name}@${policy.version}`,
      inputs: data,
      output,
      autonomyLevel: evaluationResult.autonomyLevel,
      hash,
      prevHash,
      correlationId,
      latencyMs,
    })
    .returning();

  return {
    id: insertedDecision!.id,
    approved: evaluationResult.approved,
    autonomyLevel: evaluationResult.autonomyLevel,
    reason: evaluationResult.reason,
    hash: insertedDecision!.hash,
    prevHash: insertedDecision!.prevHash,
    policyVersion: insertedDecision!.policyVersion,
    latencyMs: insertedDecision!.latencyMs!,
    escalationTarget: evaluationResult.escalationTarget,
    correlationId: insertedDecision!.correlationId,
    ts: insertedDecision!.ts,
  };
};

router.post(
  "/decisions/:node",
  (req, res, next) => {
    console.log("=== DEBUG ===");
    console.log("URL:", req.url);
    console.log("Path:", req.path);
    console.log("Route path:", req.route?.path);
    console.log("Params:", req.params);
    console.log("=============");
    next();
  },
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
