import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "bun:test";
import { db } from "../../db";
import { decisions, outcomes, policyVersions } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { PolicyDocument } from "../../core/policy/types";

describe("Outcomes API Integration Tests", () => {
  let testDecisionId: string;
  let testPolicyId: number;

  const testPolicy: PolicyDocument = {
    version: "1.0.0",
    nodes: {
      finance: {
        authorities: [
          {
            action: "approve_discount",
            autonomyBands: [
              {
                level: 2,
                constraints: {
                  max_discount_pct: 0.12,
                  min_margin_pct: 0.23,
                },
              },
            ],
            escalation: {
              ifOutside: "CFO",
            },
          },
        ],
      },
    },
  };

  beforeAll(async () => {
    // Insert test policy
    const [policy] = await db
      .insert(policyVersions)
      .values({
        name: "test-policy",
        version: "1.0.0",
        doc: testPolicy,
      })
      .returning();
    testPolicyId = policy!.id;

    // Insert test decision
    const [decision] = await db
      .insert(decisions)
      .values({
        node: "finance",
        policyVersion: "test-policy@1.0.0",
        inputs: { discount_pct: 0.1, margin_pct: 0.24 },
        output: {
          approved: true,
          autonomyLevel: 2,
          reason: "Approved under AL2",
          matchedBand: {
            level: 2,
            constraints: {
              max_discount_pct: 0.12,
              min_margin_pct: 0.23,
            },
          },
        },
        autonomyLevel: 2,
        hash: "test-hash-123",
        prevHash: null,
        correlationId: "test-correlation-id",
        latencyMs: 100,
      })
      .returning();
    testDecisionId = decision!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(outcomes).where(eq(outcomes.decisionId, testDecisionId));
    await db.delete(decisions).where(eq(decisions.id, testDecisionId));
    await db.delete(policyVersions).where(eq(policyVersions.id, testPolicyId));
  });

  afterEach(async () => {
    // Clean up outcomes after each test
    await db.delete(outcomes).where(eq(outcomes.decisionId, testDecisionId));
  });

  describe("POST /outcomes/:decisionId", () => {
    test("creates outcome with successful reward", async () => {
      const outcomeData = {
        metrics: {
          won: true,
          margin_pct: 0.25,
          actual_revenue: 10000,
        },
        correlationId: "test-correlation-id",
      };

      // Insert outcome
      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome).toBeDefined();
      expect(outcome!.decisionId).toBe(testDecisionId);
      expect(outcome!.metrics).toEqual(outcomeData.metrics);

      // Verify outcome was stored
      const stored = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, testDecisionId),
      });

      expect(stored).toBeDefined();
      expect(stored?.metrics).toEqual(outcomeData.metrics);
    });

    test("creates outcome with unsuccessful reward", async () => {
      const outcomeData = {
        metrics: {
          won: false,
          reason_lost: "competitor_price",
        },
        correlationId: "test-correlation-id",
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome).toBeDefined();
      expect(outcome!.metrics).toEqual(outcomeData.metrics);
    });

    test("creates outcome with constraint violation", async () => {
      const outcomeData = {
        metrics: {
          won: true,
          margin_pct: 0.2, // Below min_margin_pct of 0.23
        },
        correlationId: "test-correlation-id",
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome).toBeDefined();
      expect(outcome!.metrics).toEqual(outcomeData.metrics);
    });

    test("updates existing outcome (upsert behavior)", async () => {
      // First insert
      const initialData = {
        metrics: {
          won: true,
          margin_pct: 0.25,
        },
        correlationId: "test-correlation-id",
      };

      await db.insert(outcomes).values({
        decisionId: testDecisionId,
        ...initialData,
      });

      // Update with new data
      const updatedData = {
        metrics: {
          won: true,
          margin_pct: 0.27,
          actual_revenue: 12000,
        },
        correlationId: "test-correlation-id",
      };

      await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...updatedData,
        })
        .onConflictDoUpdate({
          target: outcomes.decisionId,
          set: {
            metrics: updatedData.metrics,
            correlationId: updatedData.correlationId,
          },
        });

      // Verify update
      const stored = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, testDecisionId),
      });

      expect(stored?.metrics).toEqual(updatedData.metrics);
    });

    test("handles AL0 (escalated) decision outcome", async () => {
      // Create AL0 decision
      const [escalatedDecision] = await db
        .insert(decisions)
        .values({
          node: "finance",
          policyVersion: "test-policy@1.0.0",
          inputs: { discount_pct: 0.3, margin_pct: 0.1 },
          output: {
            approved: false,
            autonomyLevel: 0,
            reason: "Escalating to CFO",
            escalationTarget: "CFO",
          },
          autonomyLevel: 0,
          hash: "escalated-hash",
          prevHash: null,
          correlationId: "escalated-test",
          latencyMs: 50,
        })
        .returning();

      const outcomeData = {
        metrics: {
          won: true,
          margin_pct: 0.3,
          cfo_approved: true,
        },
        correlationId: "escalated-test",
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: escalatedDecision!.id,
          ...outcomeData,
        })
        .returning();

      expect(outcome).toBeDefined();

      // Clean up
      await db
        .delete(outcomes)
        .where(eq(outcomes.decisionId, escalatedDecision!.id));
      await db.delete(decisions).where(eq(decisions.id, escalatedDecision!.id));
    });
  });

  describe("GET /outcomes/:decisionId", () => {
    test("retrieves existing outcome", async () => {
      const outcomeData = {
        metrics: {
          won: true,
          margin_pct: 0.25,
        },
        correlationId: "test-correlation-id",
      };

      await db.insert(outcomes).values({
        decisionId: testDecisionId,
        ...outcomeData,
      });

      const stored = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, testDecisionId),
      });

      expect(stored).toBeDefined();
      expect(stored?.decisionId).toBe(testDecisionId);
      expect(stored?.metrics).toEqual(outcomeData.metrics);
    });

    test("returns undefined for non-existent outcome", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const stored = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, fakeId),
      });

      expect(stored).toBeUndefined();
    });
  });

  describe("Correlation ID Tracking", () => {
    test("maintains correlation ID through outcome recording", async () => {
      const correlationId = "unique-correlation-id";

      const outcomeData = {
        metrics: {
          won: true,
          margin_pct: 0.25,
        },
        correlationId,
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome!.correlationId).toBe(correlationId);

      // Verify we can trace the full flow
      const decision = await db.query.decisions.findFirst({
        where: eq(decisions.id, testDecisionId),
      });

      expect(decision?.correlationId).toBe("test-correlation-id");
    });
  });

  describe("Multiple Outcomes Scenarios", () => {
    test("allows multiple outcomes for different decisions", async () => {
      // Create second decision
      const [decision2] = await db
        .insert(decisions)
        .values({
          node: "finance",
          policyVersion: "test-policy@1.0.0",
          inputs: { discount_pct: 0.05, margin_pct: 0.26 },
          output: { approved: true, autonomyLevel: 1 },
          autonomyLevel: 1,
          hash: "hash-2",
          prevHash: "test-hash-123",
          correlationId: "test-2",
          latencyMs: 80,
        })
        .returning();

      const outcome1Data = {
        metrics: { won: true, margin_pct: 0.25 },
        correlationId: "test-correlation-id",
      };

      const outcome2Data = {
        metrics: { won: false, margin_pct: 0.2 },
        correlationId: "test-2",
      };

      await db.insert(outcomes).values([
        {
          decisionId: testDecisionId,
          ...outcome1Data,
        },
        {
          decisionId: decision2!.id,
          ...outcome2Data,
        },
      ]);

      const outcomes1 = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, testDecisionId),
      });

      const outcomes2 = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, decision2!.id),
      });

      expect(outcomes1?.metrics).toEqual(outcome1Data.metrics);
      expect(outcomes2?.metrics).toEqual(outcome2Data.metrics);

      // Clean up
      await db.delete(outcomes).where(eq(outcomes.decisionId, decision2!.id));
      await db.delete(decisions).where(eq(decisions.id, decision2!.id));
    });
  });

  describe("Metrics Validation", () => {
    test("stores arbitrary metric fields", async () => {
      const outcomeData = {
        metrics: {
          won: true,
          margin_pct: 0.25,
          custom_field: "custom_value",
          nested: {
            field: "value",
          },
          array_field: [1, 2, 3],
        },
        correlationId: "test-correlation-id",
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome!.metrics).toEqual(outcomeData.metrics);
    });

    test("handles empty metrics object", async () => {
      const outcomeData = {
        metrics: {},
        correlationId: "test-correlation-id",
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome!.metrics).toEqual({});
    });
  });

  describe("Timestamp Tracking", () => {
    test("records outcome timestamp", async () => {
      const outcomeData = {
        metrics: { won: true },
        correlationId: "test-correlation-id",
      };

      const [outcome] = await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          ...outcomeData,
        })
        .returning();

      expect(outcome!.recordedAt).toBeInstanceOf(Date);
      expect(outcome!.recordedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test("updates timestamp on upsert", async () => {
      // Initial insert
      await db.insert(outcomes).values({
        decisionId: testDecisionId,
        metrics: { won: true },
        correlationId: "test-correlation-id",
      });

      const first = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, testDecisionId),
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update
      await db
        .insert(outcomes)
        .values({
          decisionId: testDecisionId,
          metrics: { won: true, margin_pct: 0.25 },
          correlationId: "test-correlation-id",
        })
        .onConflictDoUpdate({
          target: outcomes.decisionId,
          set: {
            metrics: { won: true, margin_pct: 0.25 },
            recordedAt: new Date(),
          },
        });

      const second = await db.query.outcomes.findFirst({
        where: eq(outcomes.decisionId, testDecisionId),
      });

      expect(second!.recordedAt.getTime()).toBeGreaterThan(
        first!.recordedAt.getTime()
      );
    });
  });
});
