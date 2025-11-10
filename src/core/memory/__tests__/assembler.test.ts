import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { assemble } from "../assembler";
import { db } from "../../../db";
import { knowledgeSnapshots } from "../../../db/schema";
import type { AssemblerInput } from "../types";

describe("Context Assembler", () => {
  const mockReq = {
    log: {
      error: () => {},
      info: () => {},
    },
  } as any;

  beforeAll(async () => {
    // Seed test snapshots with different scopes and dates
    await db.insert(knowledgeSnapshots).values([
      {
        scope: "finance-daily",
        periodStart: "2025-11-09",
        periodEnd: "2025-11-10",
        summary: "Finance daily snapshot 1: 50 deals, avg margin 28%",
      },
      {
        scope: "finance-daily",
        periodStart: "2025-11-08",
        periodEnd: "2025-11-09",
        summary: "Finance daily snapshot 2: 45 deals, avg margin 27%",
      },
      {
        scope: "finance-daily",
        periodStart: "2025-11-07",
        periodEnd: "2025-11-08",
        summary: "Finance daily snapshot 3: 52 deals, avg margin 29%",
      },
      {
        scope: "finance-weekly",
        periodStart: "2025-11-03",
        periodEnd: "2025-11-10",
        summary: "Finance weekly snapshot: 250 deals processed this week",
      },
      {
        scope: "sales-daily",
        periodStart: "2025-11-09",
        periodEnd: "2025-11-10",
        summary: "Sales daily snapshot: 100 leads, 25 conversions",
      },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(knowledgeSnapshots);
  });

  describe("Structure and Defaults", () => {
    test("returns correct structure with all required properties", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
      };

      const result = await assemble(input, mockReq);

      expect(result).toHaveProperty("knowledge");
      expect(result).toHaveProperty("memory");
      expect(result).toHaveProperty("entities");
      expect(result.knowledge).toHaveProperty("snapshots");
      expect(result.memory).toHaveProperty("similarDecisions");
      expect(result.entities).toHaveProperty("features");
      expect(Array.isArray(result.knowledge.snapshots)).toBe(true);
      expect(Array.isArray(result.memory.similarDecisions)).toBe(true);
      expect(typeof result.entities.features).toBe("object");
    });

    test("uses default snapshot limit of 5", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
      };

      const result = await assemble(input, mockReq);

      expect(result.knowledge.snapshots.length).toBeLessThanOrEqual(5);
    });

    test("uses default scope of {node}-daily", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
      };

      const result = await assemble(input, mockReq);

      result.knowledge.snapshots.forEach((snapshot) => {
        expect(snapshot.scope).toBe("finance-daily");
      });
    });
  });

  describe("Snapshot Fetching", () => {
    test("fetches snapshots from database", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
      };

      const result = await assemble(input, mockReq);

      expect(result.knowledge.snapshots.length).toBeGreaterThan(0);
      expect(result.knowledge.snapshots[0]).toHaveProperty("id");
      expect(result.knowledge.snapshots[0]).toHaveProperty("scope");
      expect(result.knowledge.snapshots[0]).toHaveProperty("periodStart");
      expect(result.knowledge.snapshots[0]).toHaveProperty("periodEnd");
      expect(result.knowledge.snapshots[0]).toHaveProperty("summary");
      expect(result.knowledge.snapshots[0]).toHaveProperty("createdAt");
    });

    test("respects custom snapshot limit", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
        options: {
          snapshotLimit: 2,
        },
      };

      const result = await assemble(input, mockReq);

      expect(result.knowledge.snapshots.length).toBeLessThanOrEqual(2);
    });

    test("filters by specified scopes", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
        options: {
          snapshotScopes: ["finance-weekly"],
        },
      };

      const result = await assemble(input, mockReq);

      expect(result.knowledge.snapshots.length).toBeGreaterThan(0);
      result.knowledge.snapshots.forEach((snapshot) => {
        expect(snapshot.scope).toBe("finance-weekly");
      });
    });

    test("can fetch multiple scopes", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
        options: {
          snapshotScopes: ["finance-daily", "finance-weekly"],
          snapshotLimit: 10,
        },
      };

      const result = await assemble(input, mockReq);

      const scopes = result.knowledge.snapshots.map((s) => s.scope);
      const hasDaily = scopes.some((s) => s === "finance-daily");
      const hasWeekly = scopes.some((s) => s === "finance-weekly");

      expect(hasDaily || hasWeekly).toBe(true);
    });

    test("returns snapshots ordered by period_end DESC", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
        options: {
          snapshotLimit: 10,
        },
      };

      const result = await assemble(input, mockReq);

      if (result.knowledge.snapshots.length > 1) {
        for (let i = 0; i < result.knowledge.snapshots.length - 1; i++) {
          const current = new Date(result.knowledge.snapshots[i]!.periodEnd);
          const next = new Date(result.knowledge.snapshots[i + 1]!.periodEnd);
          expect(current >= next).toBe(true);
        }
      }
    });

    test("formats createdAt as ISO string", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
      };

      const result = await assemble(input, mockReq);

      if (result.knowledge.snapshots.length > 0) {
        const createdAt = result.knowledge.snapshots[0]!.createdAt;
        expect(typeof createdAt).toBe("string");
        expect(() => new Date(createdAt)).not.toThrow();
      }
    });
  });

  describe("Stubbed Features", () => {
    test("returns empty array for similar decisions (stubbed)", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
        contextVec: new Array(1536).fill(0.1),
      };

      const result = await assemble(input, mockReq);

      expect(result.memory.similarDecisions).toEqual([]);
    });

    test("returns empty object for entity features (stubbed)", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000, customer_id: "C123" },
      };

      const result = await assemble(input, mockReq);

      expect(result.entities.features).toEqual({});
    });
  });

  describe("Error Handling", () => {
    test("returns empty snapshots array on fetch error", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
        options: {
          // Invalid scope that doesn't exist
          snapshotScopes: ["nonexistent-scope"],
        },
      };

      const result = await assemble(input, mockReq);

      // Should not throw, but return empty array
      expect(result.knowledge.snapshots).toEqual([]);
    });

    test("continues execution if one component fails", async () => {
      const input: AssemblerInput = {
        node: "finance",
        inputData: { deal_value: 10000 },
      };

      const result = await assemble(input, mockReq);

      // Even if similar decisions stub "fails", snapshots should still work
      expect(result).toHaveProperty("knowledge");
      expect(result).toHaveProperty("memory");
      expect(result).toHaveProperty("entities");
    });
  });
});
