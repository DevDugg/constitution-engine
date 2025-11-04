import { events } from "./models/events.model";
import { decisions } from "./models/decisions.model";
import { outcomes } from "./models/outcomes.model";
import { policyVersions } from "./models/policy-versions.model";
import { entityFeatures } from "./models/entity-features.model";
import { knowledgeSnapshots } from "./models/knowledge-snapshots.model";
import { policyVariantsStats } from "./models/policy-variants-stats.model";

export const schema = {
  events,
  decisions,
  outcomes,
  policyVersions,
  entityFeatures,
  knowledgeSnapshots,
  policyVariantsStats,
};
