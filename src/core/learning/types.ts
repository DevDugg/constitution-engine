interface DecisionForReward {
  autonomyLevel: number;
  inputs: Record<string, any>;
  output: Record<string, any>;
  policyVersion: string;
  node: string;
}

interface OutcomeMetrics {
  won?: boolean;
  margin_pct?: number;
  actual_revenue?: number;
  customer_satisfied?: boolean;
  [key: string]: any;
}

interface RewardInput {
  decision: DecisionForReward;
  outcome: {
    metrics: OutcomeMetrics;
  };
  matchedBandConstraints?: Record<string, number>;
}

interface RewardResult {
  success: boolean;
  reason: string;
  score?: number;
}

export type { DecisionForReward, OutcomeMetrics, RewardInput, RewardResult };
