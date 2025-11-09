import z from "zod";

const createEventSchema = z.object({
  type: z.string().min(1, "Event type is required"),
  actor: z.string().min(1, "Actor is required"),
  correlationId: z.uuid().optional(),
  payload: z.record(z.string(), z.any()),
});

type CreateEventDto = z.infer<typeof createEventSchema>;

export { createEventSchema, type CreateEventDto };
