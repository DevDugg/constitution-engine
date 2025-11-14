import type { RewardInput, RewardResult } from "./types";

/**
 * Computes reward for bandit learning based on decision outcomes.
 *
 * Department-agnostic design:
 * - Uses generic "success" field (or "won" for backward compatibility)
 * - Validates against matched band constraints using naming convention
 * - Works for finance, HR, ops, or any future department
 *
 * Constraint validation:
 * - min_X: actual X must be >= constraint
 * - max_X: actual X must be <= constraint
 *
 * For AL0 (escalated) decisions, we don't compute rewards since they
 * required human intervention.
 */
export function computeReward(input: RewardInput): RewardResult | null {
  const { decision, outcome, matchedBandConstraints } = input;
  const { metrics } = outcome;

  // Skip reward for escalated decisions (AL0)
  if (decision.autonomyLevel === 0) {
    return null;
  }

  // Primary success indicator - universal across departments
  // Support both "success" (new) and "won" (finance legacy)
  const success = metrics["success"] ?? metrics["won"] ?? false;

  if (typeof success !== "boolean") {
    return {
      success: false,
      reason: "Missing or invalid 'success' outcome metric",
      score: 0,
    };
  }

  if (!success) {
    return {
      success: false,
      reason: "Outcome marked as unsuccessful",
      score: 0,
    };
  }

  // Validate against band constraints (generic)
  if (matchedBandConstraints) {
    const violations = validateConstraints(metrics, matchedBandConstraints);
    if (violations.length > 0) {
      return {
        success: false,
        reason: `Constraint violations: ${violations.join(", ")}`,
        score: 0,
      };
    }
  }

  // Success: outcome succeeded and met band constraints
  const score = computeScore(metrics, matchedBandConstraints);

  return {
    success: true,
    reason: "Outcome successful and constraints satisfied",
    score,
  };
}

/**
 * Validates outcome metrics against band constraints.
 * Works generically across departments using naming convention:
 * - min_X: actual X must be >= constraint
 * - max_X: actual X must be <= constraint
 *
 * Examples:
 * - Finance: min_margin_pct, max_discount_pct
 * - HR: min_satisfaction_score, max_processing_days
 * - Ops: min_quality_score, max_turnaround_hours
 */
function validateConstraints(
  metrics: Record<string, any>,
  constraints: Record<string, number>
): string[] {
  const violations: string[] = [];

  for (const [constraintKey, constraintValue] of Object.entries(constraints)) {
    if (constraintKey.startsWith("min_")) {
      const field = constraintKey.replace("min_", "");
      const actualValue = metrics[field];

      if (actualValue === undefined) {
        violations.push(`Missing ${field} for ${constraintKey} validation`);
      } else if (typeof actualValue !== "number") {
        violations.push(`Invalid ${field} type (expected number)`);
      } else if (actualValue < constraintValue) {
        violations.push(
          `${field}=${actualValue} below ${constraintKey}=${constraintValue}`
        );
      }
    } else if (constraintKey.startsWith("max_")) {
      const field = constraintKey.replace("max_", "");
      const actualValue = metrics[field];

      if (actualValue === undefined) {
        violations.push(`Missing ${field} for ${constraintKey} validation`);
      } else if (typeof actualValue !== "number") {
        violations.push(`Invalid ${field} type (expected number)`);
      } else if (actualValue > constraintValue) {
        violations.push(
          `${field}=${actualValue} exceeds ${constraintKey}=${constraintValue}`
        );
      }
    }
  }

  return violations;
}

/**
 * Computes a reward score from metrics.
 * Currently returns binary 1.0 for success.
 *
 * Future: Could be sophisticated based on domain
 * - Finance: margin delta
 * - HR: satisfaction score
 * - Ops: quality score
 */
function computeScore(
  _metrics: Record<string, any>,
  _constraints?: Record<string, number>
): number {
  // Simple approach: binary 1.0 for success
  // Can be enhanced later with domain-specific scoring
  return 1.0;
}
