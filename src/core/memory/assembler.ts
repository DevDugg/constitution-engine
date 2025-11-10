import type { Request } from "express";
import type {
  AssemblerInput,
  AssemblerOutput,
  DecisionMemory,
  KnowledgeSnapshot,
} from "./types";
import { db } from "../../db";
import { knowledgeSnapshots } from "../../db/schema";
import { desc, inArray } from "drizzle-orm";
import { similar } from "./similar";

const assemble = async (
  input: AssemblerInput,
  req: Request
): Promise<AssemblerOutput> => {
  let snapshots: KnowledgeSnapshot[] = [];
  let similarDecisions: DecisionMemory[] = [];
  let entityFeatures: Record<string, any> = {};

  const { node, contextVec, options } = input;
  const {
    snapshotLimit = 5,
    snapshotScopes = [`${node}-daily`],
    similarLimit = 10,
  } = options ?? {};

  try {
    snapshots = await fetchKnowledgeSnapshots(snapshotScopes, snapshotLimit);
  } catch (error) {
    req.log.error(
      { err: error, node, scopes: snapshotScopes },
      "Failed to fetch snapshots"
    );
  }

  try {
    similarDecisions = await similar(node, contextVec ?? [], similarLimit);
  } catch (error) {
    req.log.error(
      { err: error, node, contextVecLength: contextVec?.length },
      "Failed to fetch similar decisions"
    );
  }

  return {
    knowledge: {
      snapshots,
    },
    memory: {
      similarDecisions,
    },
    entities: {
      features: entityFeatures,
    },
  };
};

const fetchKnowledgeSnapshots = async (
  scopes: string[],
  limit: number
): Promise<KnowledgeSnapshot[]> => {
  const snapshots = await db.query.knowledgeSnapshots.findMany({
    where: inArray(knowledgeSnapshots.scope, scopes),
    orderBy: [desc(knowledgeSnapshots.periodEnd)],
    limit: limit,
  });

  return snapshots.map((snapshot) => ({
    id: snapshot.id,
    scope: snapshot.scope,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    summary: snapshot.summary,
    createdAt: snapshot.createdAt.toISOString(),
  }));
};

export { assemble };
