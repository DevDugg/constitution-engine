import { db } from "../../db";
import { policyVersions } from "../../db/models/policy-versions.model";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../../errors/not-found-error";
import type { PolicyVersionRow } from "./types";
import { BadRequestError } from "../../errors/bad-request-error";
import { ModelError } from "../../errors/model-error";

interface CacheEntry {
  policy: PolicyVersionRow;
  timestamp: number;
}

class PolicyLoader {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60000; // 60 seconds

  async load(policyName: string): Promise<PolicyVersionRow> {
    return this.withErrorHandler(async () => {
      const { name, version } = this.parsePolicyName(policyName);

      const cached = this.getCached({ name, version });
      if (cached) return cached;

      if (version) {
        const policy = await this.loadSpecificFromDb(name, version);
        if (!policy) {
          throw new NotFoundError(
            `Policy version ${name}@${version} not found`
          );
        }

        this.setCache({ name, version }, policy);
        return policy;
      }

      const latestPolicy = await this.loadLatestFromDb(name);
      if (!latestPolicy) {
        throw new NotFoundError(`Policy ${name}@latest not found`);
      }
      this.setCache({ name, version: null }, latestPolicy);
      return latestPolicy;
    });
  }

  private parsePolicyName(policyName: string): {
    name: string;
    version: string | null;
  } {
    const [name, version] = policyName.split("@");

    if (!name || name === "") {
      throw new BadRequestError(
        `Couldn't parse policy name and version from: ${policyName}. Expected format: <name>@<version>.`
      );
    }

    return { name, version: version || null };
  }

  private async loadLatestFromDb(
    name: string
  ): Promise<PolicyVersionRow | null> {
    const policy = await db.query.policyVersions.findFirst({
      where: eq(policyVersions.name, name),
      orderBy: (policyVersions, { desc }) => [desc(policyVersions.createdAt)],
    });

    if (!policy) {
      return null;
    }

    return policy;
  }

  private async loadSpecificFromDb(
    name: string,
    version: string
  ): Promise<PolicyVersionRow | null> {
    const policy = await db.query.policyVersions.findFirst({
      where: and(
        eq(policyVersions.name, name),
        eq(policyVersions.version, version)
      ),
    });

    if (!policy) {
      return null;
    }
    return policy;
  }

  private getCached(key: {
    name: string;
    version: string | null;
  }): PolicyVersionRow | null {
    const now = Date.now();
    const keyString = `${key.name}@${key.version ?? "latest"}`;
    const entry = this.cache.get(keyString);
    if (!entry || now - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(keyString);
      return null;
    }
    return entry.policy;
  }

  private setCache(
    key: { name: string; version: string | null },
    policy: PolicyVersionRow
  ): void {
    const keyString = `${key.name}@${key.version ?? "latest"}`;
    this.cache.set(keyString, {
      policy,
      timestamp: Date.now(),
    });
  }

  private withErrorHandler = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof ModelError
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new ModelError(`Database error: ${error.message}`);
      }

      throw new ModelError(`Unknown error occurred`);
    }
  };
}

export default new PolicyLoader();
