type AutonomyLevel = 0 | 1 | 2 | 3;

interface PolicyDocument {
  version: string;
  nodes: Record<string, Node>;
}

interface PolicyVersionRow {
  id: number;
  name: string;
  version: string;
  doc: PolicyDocument;
  createdAt: Date;
}

interface Node {
  authorities: Authority[];
}

interface Authority {
  action: string;
  autonomyBands: AutonomyBand[];
  escalation?: Escalation;
}

interface AutonomyBand {
  level: AutonomyLevel;
  constraints: Record<string, number>;
}

interface Escalation {
  ifOutside: string;
  notify?: string[];
  timeoutHours?: number;
}

interface EvaluatorInput {
  action: string;
  data: Record<string, any>;
}

interface EvaluatorResult {
  approved: boolean;
  autonomyLevel: AutonomyLevel;
  reason: string;
  matchedBand?: AutonomyBand;
  escalationTarget?: string;
}

export type {
  PolicyDocument,
  Node,
  Authority,
  AutonomyBand,
  Escalation,
  EvaluatorInput,
  EvaluatorResult,
  PolicyVersionRow,
};
