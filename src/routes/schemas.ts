import z from "zod";

const createEventSchema = z.object({
  type: z.string().min(1, "Event type is required"),
  actor: z.string().min(1, "Actor is required"),
  correlationId: z.uuid().optional(),
  payload: z.record(z.string(), z.any()),
});

type CreateEventDto = z.infer<typeof createEventSchema>;

// Decision schemas
const createDecisionSchema = z.object({
  action: z.string().min(1, "Action is required"),
  data: z.record(z.string(), z.any()),
  correlationId: z.uuid().optional(),
  policyVersion: z.string().optional(),
});

type CreateDecisionDto = z.infer<typeof createDecisionSchema>;

const decisionParamsSchema = z.object({
  node: z.string().min(1, "Node is required"),
});

type DecisionParamsDto = z.infer<typeof decisionParamsSchema>;

// Outcome schemas

const createOutcomeSchema = z.object({
  metrics: z.record(z.string(), z.any()),
  correlationId: z.uuid().optional(),
});

type CreateOutcomeDto = z.infer<typeof createOutcomeSchema>;

const outcomeParamsSchema = z.object({
  decisionId: z.uuid("Invalid decision ID"),
});

type OutcomeParamsDto = z.infer<typeof outcomeParamsSchema>;

export type {
  CreateEventDto,
  CreateDecisionDto,
  DecisionParamsDto,
  CreateOutcomeDto,
  OutcomeParamsDto,
};
export {
  createEventSchema,
  createDecisionSchema,
  decisionParamsSchema,
  outcomeParamsSchema,
  createOutcomeSchema,
};
