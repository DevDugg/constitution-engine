interface AssemblerInput {
  node: string;
  inputData: Record<string, any>;
  contextVec?: number[];
  options?: {
    snapshotLimit?: number;
    snapshotScopes?: string[];
    similarLimit?: number;
  };
}

interface AssemblerOutput {
  knowledge: {
    snapshots: KnowledgeSnapshot[];
  };
  memory: {
    similarDecisions: DecisionMemory[];
  };
  entities: {
    features: Record<string, any>;
  };
}

interface KnowledgeSnapshot {
  id: number;
  scope: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  createdAt: string;
}

interface DecisionMemory {
  id: string;
  node: string;
  inputs: any;
  output: any;
  autonomyLevel: number;
  ts: string;
  similarity: number;
}

export type {
  AssemblerInput,
  AssemblerOutput,
  KnowledgeSnapshot,
  DecisionMemory,
};
