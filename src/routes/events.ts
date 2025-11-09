import { Router, type Response } from "express";
import {
  validateRequest,
  type ValidatedRequest,
} from "../middleware/validate-request";
import { createEventSchema, type CreateEventDto } from "./schemas";

import { db } from "../db";
import { events } from "../db/schema";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.post(
  "/events",
  validateRequest({ body: createEventSchema }),
  asyncHandler(
    async (req: ValidatedRequest<{}, any, CreateEventDto>, res: Response) => {
      const { type, actor, correlationId, payload } = req.validated.body;

      const finalCorrelationId = correlationId ?? req.id;

      const [event] = await db
        .insert(events)
        .values({
          type,
          actor,
          correlationId: finalCorrelationId,
          payload,
        })
        .returning();

      req.log.info(
        {
          eventId: event!.id,
          correlationId: event!.correlationId,
        },
        "Event created"
      );

      res.status(201).json({
        success: true,
        data: {
          id: event!.id,
          type: event!.type,
          actor: event!.actor,
          correlationId: event!.correlationId,
          payload: event!.payload,
          ts: event!.ts,
        },
      });
    }
  )
);

export { router as eventsRouter };
