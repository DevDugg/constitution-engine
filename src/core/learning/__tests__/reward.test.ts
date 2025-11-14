import { describe, test, expect } from "bun:test";
import { computeReward } from "../reward";
import type { RewardInput } from "../types";

describe("Reward Computation", () => {
  const baseDecision = {
    autonomyLevel: 2,
    inputs: { discount_pct: 0.1, margin_pct: 0.24 },
    output: { approved: true },
    policyVersion: "finance-constitution@1.0.0",
    node: "finance",
  };

  const baseConstraints = {
    max_discount_pct: 0.12,
    min_margin_pct: 0.23,
  };

  describe("AL0 (Escalated) Decisions", () => {
    test("returns null for escalated decisions (AL0)", () => {
      const input: RewardInput = {
        decision: {
          ...baseDecision,
          autonomyLevel: 0,
        },
        outcome: {
          metrics: { won: true, margin_pct: 0.25 },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).toBeNull();
    });
  });

  describe("Success Field Validation", () => {
    test("accepts 'success' field (new standard)", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { success: true, margin_pct: 0.25, discount_pct: 0.1 },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("accepts 'won' field (backward compatibility)", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.25, discount_pct: 0.1 },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("prefers 'success' over 'won' when both present", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { success: false, won: true, margin_pct: 0.25 },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toBe("Outcome marked as unsuccessful");
    });

    test("returns failure for missing success indicator", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { margin_pct: 0.25 },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toBe("Outcome marked as unsuccessful");
    });

    test("returns failure for non-boolean success value", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { success: "yes", margin_pct: 0.25 },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toBe(
        "Missing or invalid 'success' outcome metric"
      );
    });
  });

  describe("Unsuccessful Outcomes", () => {
    test("returns failure when outcome not successful", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: false, reason: "competitor_price" },
        },
        matchedBandConstraints: baseConstraints,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toBe("Outcome marked as unsuccessful");
      expect(result?.score).toBe(0);
    });
  });

  describe("Constraint Validation - min_ constraints", () => {
    test("succeeds when metric meets min constraint", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.25 },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.score).toBe(1.0);
    });

    test("succeeds when metric exactly equals min constraint", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.23 },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("fails when metric below min constraint", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.2 },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain("margin_pct=0.2 below min_margin_pct");
      expect(result?.score).toBe(0);
    });

    test("fails when required metric is missing", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain("Missing margin_pct");
    });

    test("fails when metric is wrong type (string instead of number)", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: "0.25" as any },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain("Invalid margin_pct type");
    });
  });

  describe("Constraint Validation - max_ constraints", () => {
    test("succeeds when metric below max constraint", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, discount_pct: 0.1 },
        },
        matchedBandConstraints: { max_discount_pct: 0.12 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("succeeds when metric exactly equals max constraint", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, discount_pct: 0.12 },
        },
        matchedBandConstraints: { max_discount_pct: 0.12 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("fails when metric exceeds max constraint", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, discount_pct: 0.15 },
        },
        matchedBandConstraints: { max_discount_pct: 0.12 },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain(
        "discount_pct=0.15 exceeds max_discount_pct"
      );
    });
  });

  describe("Multiple Constraints", () => {
    test("succeeds when all constraints satisfied", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: {
            won: true,
            margin_pct: 0.25,
            discount_pct: 0.1,
            revenue: 10000,
          },
        },
        matchedBandConstraints: {
          min_margin_pct: 0.23,
          max_discount_pct: 0.12,
        },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("fails when any constraint violated", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: {
            won: true,
            margin_pct: 0.25, // Good
            discount_pct: 0.15, // Bad - exceeds max
          },
        },
        matchedBandConstraints: {
          min_margin_pct: 0.23,
          max_discount_pct: 0.12,
        },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain("discount_pct");
    });

    test("reports multiple violations in reason", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: {
            won: true,
            margin_pct: 0.2, // Bad - below min
            discount_pct: 0.15, // Bad - exceeds max
          },
        },
        matchedBandConstraints: {
          min_margin_pct: 0.23,
          max_discount_pct: 0.12,
        },
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain("margin_pct");
      expect(result?.reason).toContain("discount_pct");
    });
  });

  describe("No Constraints (Optional Validation)", () => {
    test("succeeds when no constraints provided", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.25 },
        },
        matchedBandConstraints: undefined,
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    test("succeeds when constraints object is empty", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.25 },
        },
        matchedBandConstraints: {},
      };

      const result = computeReward(input);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });
  });

  describe("Department-Agnostic Examples", () => {
    describe("Finance", () => {
      test("validates finance metrics correctly", () => {
        const input: RewardInput = {
          decision: { ...baseDecision, node: "finance" },
          outcome: {
            metrics: {
              success: true,
              margin_pct: 0.25,
              discount_pct: 0.1,
              revenue: 50000,
            },
          },
          matchedBandConstraints: {
            min_margin_pct: 0.22,
            max_discount_pct: 0.15,
          },
        };

        const result = computeReward(input);
        expect(result?.success).toBe(true);
      });
    });

    describe("HR (Future)", () => {
      test("validates HR metrics correctly", () => {
        const input: RewardInput = {
          decision: { ...baseDecision, node: "hr", autonomyLevel: 2 },
          outcome: {
            metrics: {
              success: true,
              satisfaction_score: 4.5,
              processing_days: 5,
            },
          },
          matchedBandConstraints: {
            min_satisfaction_score: 4.0,
            max_processing_days: 7,
          },
        };

        const result = computeReward(input);
        expect(result?.success).toBe(true);
      });

      test("fails when HR satisfaction too low", () => {
        const input: RewardInput = {
          decision: { ...baseDecision, node: "hr", autonomyLevel: 2 },
          outcome: {
            metrics: {
              success: true,
              satisfaction_score: 3.5,
              processing_days: 5,
            },
          },
          matchedBandConstraints: {
            min_satisfaction_score: 4.0,
            max_processing_days: 7,
          },
        };

        const result = computeReward(input);
        expect(result?.success).toBe(false);
        expect(result?.reason).toContain("satisfaction_score");
      });
    });

    describe("Operations (Future)", () => {
      test("validates operations metrics correctly", () => {
        const input: RewardInput = {
          decision: { ...baseDecision, node: "operations", autonomyLevel: 3 },
          outcome: {
            metrics: {
              success: true,
              quality_score: 0.98,
              turnaround_hours: 18,
            },
          },
          matchedBandConstraints: {
            min_quality_score: 0.95,
            max_turnaround_hours: 24,
          },
        };

        const result = computeReward(input);
        expect(result?.success).toBe(true);
      });
    });
  });

  describe("Score Computation", () => {
    test("returns 1.0 score for successful outcome", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.25 },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result?.score).toBe(1.0);
    });

    test("returns 0 score for unsuccessful outcome", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: false },
        },
      };

      const result = computeReward(input);
      expect(result?.score).toBe(0);
    });

    test("returns 0 score for constraint violations", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.2 },
        },
        matchedBandConstraints: { min_margin_pct: 0.23 },
      };

      const result = computeReward(input);
      expect(result?.score).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles zero values correctly", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0 },
        },
        matchedBandConstraints: { min_margin_pct: 0 },
      };

      const result = computeReward(input);
      expect(result?.success).toBe(true);
    });

    test("handles negative values in constraints", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { success: true, loss: -100 },
        },
        matchedBandConstraints: { max_loss: -150 }, // -100 exceeds -150 (less negative)
      };

      const result = computeReward(input);
      expect(result?.success).toBe(false);
      expect(result?.reason).toContain("loss");
    });

    test("handles very large numbers", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, revenue: 1000000 },
        },
        matchedBandConstraints: { min_revenue: 100000 },
      };

      const result = computeReward(input);
      expect(result?.success).toBe(true);
    });

    test("ignores non-constraint fields", () => {
      const input: RewardInput = {
        decision: baseDecision,
        outcome: {
          metrics: { won: true, margin_pct: 0.25, customer_name: "Acme Corp" },
        },
        matchedBandConstraints: {
          min_margin_pct: 0.23,
          random_field: 100, // Should be ignored (no min_/max_ prefix)
        },
      };

      const result = computeReward(input);
      expect(result?.success).toBe(true);
    });
  });
});
