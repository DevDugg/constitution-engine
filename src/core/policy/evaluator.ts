import type {
  Authority,
  AutonomyBand,
  EvaluatorInput,
  EvaluatorResult,
} from "./types";
import { BadRequestError } from "../../errors/bad-request-error";

const checkConstraints = (
  input: Record<string, any>,
  constraints: Record<string, number>
): boolean => {
  for (const [key, threshold] of Object.entries(constraints)) {
    if (key.startsWith("max_")) {
      const field = key.replace("max_", "");
      if (input[field] === undefined) {
        throw new BadRequestError(
          `Missing required field: ${field} (needed for constraint ${key})`
        );
      }
      if (input[field] > threshold) return false;
    }
    if (key.startsWith("min_")) {
      const field = key.replace("min_", "");
      if (input[field] === undefined) {
        throw new BadRequestError(
          `Missing required field: ${field} (needed for constraint ${key})`
        );
      }
      if (input[field] < threshold) return false;
    }
  }
  return true;
};

const sortAutonomyBands = (autonomyBands: AutonomyBand[]): AutonomyBand[] => {
  return [...autonomyBands].sort((a, b) => a.level - b.level);
};

export function evaluate(
  input: EvaluatorInput,
  authority: Authority
): EvaluatorResult {
  const { action: inputAction, data: inputData } = input;
  const { action: authorityAction, autonomyBands, escalation } = authority;

  // Validate action match
  if (inputAction !== authorityAction) {
    throw new BadRequestError(
      `Action mismatch: expected '${authorityAction}', got '${inputAction}'`
    );
  }

  // Validate authority has bands
  if (!autonomyBands || autonomyBands.length === 0) {
    throw new BadRequestError(
      `Authority for action '${authorityAction}' has no autonomy bands defined`
    );
  }

  // Sort bands and check constraints
  const sortedBands = sortAutonomyBands(autonomyBands);
  const matchedBand = sortedBands.find((band) =>
    checkConstraints(inputData, band.constraints)
  );

  if (matchedBand) {
    return {
      approved: true,
      autonomyLevel: matchedBand.level,
      reason: `Approved under AL${matchedBand.level} constraints`,
      matchedBand: matchedBand,
    };
  }

  // No bands matched - escalate
  const target = escalation?.ifOutside || "supervisor";
  return {
    approved: false,
    autonomyLevel: 0,
    reason: `No autonomy band matches constraints. Escalating to ${target}`,
    escalationTarget: target,
  };
}
