import { db } from "./index";
import { policyVersions } from "./models/policy-versions.model";
import type { PolicyDocument } from "../core/policy/types";

const financePolicy: PolicyDocument = {
  version: "1.0.0",
  nodes: {
    finance: {
      authorities: [
        {
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
        },
      ],
    },
  },
};

async function seed() {
  console.log("Seeding database...");

  try {
    const existing = await db.query.policyVersions.findFirst({
      where: (policyVersions, { and, eq }) =>
        and(
          eq(policyVersions.name, "finance-constitution"),
          eq(policyVersions.version, "1.0.0")
        ),
    });

    if (existing) {
      console.log("Policy already exists, skipping...");
      return;
    }

    await db.insert(policyVersions).values({
      name: "finance-constitution",
      version: "1.0.0",
      doc: financePolicy,
    });

    console.log("Seeded finance-constitution@1.0.0");
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("✅ Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
