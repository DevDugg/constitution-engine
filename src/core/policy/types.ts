type AutonomyLevel = 0 | 1 | 2 | 3;

interface PolicyDocument {
  version: string;
  nodes: Record<string, Node>;
}

interface Node {
  authorities: Authority[];
}

interface Authority {
  action: string;
  autonomy_bands: AutonomyBand[];
  escalation?: Escalation;
}

interface AutonomyBand {
  level: AutonomyLevel;
  constraints: Record<string, number>;
}

interface Escalation {
  if_outside: string;
  notify?: string[];
  timeout_hours?: number;
}

interface EvaluatorInput {
  action: string;
  data: Record<string, any>;
}

interface EvaluatorResult {
  approved: boolean;
  autonomy_level: AutonomyLevel;
  reason: string;
  matched_band?: AutonomyBand;
  escalation_target?: string;
}

export type {
  PolicyDocument,
  Node,
  Authority,
  AutonomyBand,
  Escalation,
  EvaluatorInput,
  EvaluatorResult,
};
