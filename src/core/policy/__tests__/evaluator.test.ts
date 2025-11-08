import { describe, test, expect } from "bun:test";
import { evaluate } from "../evaluator";
import type { EvaluatorInput, Authority } from "../types";
import { BadRequestError } from "../../../errors/bad-request-error";

describe("Policy Evaluator", () => {
  // Mock authority for testing
  const mockAuthority: Authority = {
    action: "approve_discount",
    autonomyBands: [
      {
        level: 1,
        constraints: {
          max_discount_pct: 0.05,
          min_margin_pct: 0.25,
        },
      },
      {
        level: 2,
        constraints: {
          max_discount_pct: 0.12,
          min_margin_pct: 0.23,
        },
      },
      {
        level: 3,
        constraints: {
          max_discount_pct: 0.15,
          min_margin_pct: 0.22,
        },
      },
    ],
    escalation: {
      ifOutside: "CFO",
    },
  };

  describe("Autonomy Level Matching", () => {
    test("should approve at AL1 for requests within AL1 bounds", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.05,
          margin_pct: 0.25,
        },
      };

      const result = evaluate(input, mockAuthority);

      expect(result.approved).toBe(true);
      expect(result.autonomyLevel).toBe(1);
      expect(result.reason).toContain("AL1");
    });

    test("should approve at AL2 for requests outside AL1 but within AL2", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.08,
          margin_pct: 0.24,
        },
      };

      const result = evaluate(input, mockAuthority);

      expect(result.approved).toBe(true);
      expect(result.autonomyLevel).toBe(2);
      expect(result.matchedBand).toBeDefined();
      expect(result.matchedBand?.level).toBe(2);
    });

    test("should approve at AL3 for requests at maximum bounds", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.15,
          margin_pct: 0.22,
        },
      };

      const result = evaluate(input, mockAuthority);

      expect(result.approved).toBe(true);
      expect(result.autonomyLevel).toBe(3);
    });

    test("should return lowest matching autonomy level", () => {
      // This input fits both AL2 and AL3, should return AL2 (first match)
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.1,
          margin_pct: 0.24,
        },
      };

      const result = evaluate(input, mockAuthority);

      expect(result.approved).toBe(true);
      expect(result.autonomyLevel).toBe(2); // Not 3
    });
  });

  describe("Escalation", () => {
    test("should escalate (AL0) when request exceeds all bands", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.2,
          margin_pct: 0.15,
        },
      };

      const result = evaluate(input, mockAuthority);

      expect(result.approved).toBe(false);
      expect(result.autonomyLevel).toBe(0);
      expect(result.escalationTarget).toBe("CFO");
      expect(result.reason).toContain("Escalating");
    });

    test("should use default escalation target when not specified", () => {
      const authorityNoEscalation: Authority = {
        ...mockAuthority,
        escalation: undefined,
      };

      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.2,
          margin_pct: 0.15,
        },
      };

      const result = evaluate(input, authorityNoEscalation);

      expect(result.escalationTarget).toBe("supervisor");
    });
  });

  describe("Error Handling", () => {
    test("should throw BadRequestError when action mismatches", () => {
      const input: EvaluatorInput = {
        action: "wrong_action",
        data: {
          discount_pct: 0.05,
          margin_pct: 0.25,
        },
      };

      expect(() => evaluate(input, mockAuthority)).toThrow(BadRequestError);
      expect(() => evaluate(input, mockAuthority)).toThrow("Action mismatch");
    });

    test("should throw BadRequestError when required field is missing", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.05,
          // Missing: margin_pct
        },
      };

      expect(() => evaluate(input, mockAuthority)).toThrow(BadRequestError);
      expect(() => evaluate(input, mockAuthority)).toThrow(
        "Missing required field"
      );
    });

    test("should throw BadRequestError when authority has no bands", () => {
      const emptyAuthority: Authority = {
        action: "approve_discount",
        autonomyBands: [],
      };

      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.05,
          margin_pct: 0.25,
        },
      };

      expect(() => evaluate(input, emptyAuthority)).toThrow(BadRequestError);
      expect(() => evaluate(input, emptyAuthority)).toThrow(
        "no autonomy bands"
      );
    });
  });

  describe("Boundary Testing", () => {
    test("should approve when exactly at max constraint", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.05, // Exactly at max
          margin_pct: 0.3,
        },
      };

      const result = evaluate(input, mockAuthority);
      expect(result.approved).toBe(true);
    });

    test("should reject when slightly over max constraint", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.051, // Slightly over AL1 max
          margin_pct: 0.3,
        },
      };

      const result = evaluate(input, mockAuthority);
      expect(result.autonomyLevel).not.toBe(1);
    });

    test("should approve when exactly at min constraint", () => {
      const input: EvaluatorInput = {
        action: "approve_discount",
        data: {
          discount_pct: 0.03,
          margin_pct: 0.25, // Exactly at min
        },
      };

      const result = evaluate(input, mockAuthority);
      expect(result.approved).toBe(true);
    });
  });
});
