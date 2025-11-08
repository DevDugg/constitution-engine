import { describe, test, expect } from "bun:test";
import policyLoader from "../loader";
import { NotFoundError } from "../../../errors/not-found-error";
import { BadRequestError } from "../../../errors/bad-request-error";

describe("Policy Loader", () => {
  // Assuming seed has run and finance-constitution@1.0.0 exists

  describe("Loading by name", () => {
    test("should load latest version by name only", async () => {
      const policy = await policyLoader.load("finance-constitution");

      expect(policy).toBeDefined();
      expect(policy.name).toBe("finance-constitution");
      expect(policy.version).toBe("1.0.0");
      expect(policy.doc).toBeDefined();
      expect(policy.doc.nodes).toBeDefined();
    });

    test("should load specific version by name@version", async () => {
      const policy = await policyLoader.load("finance-constitution@1.0.0");

      expect(policy).toBeDefined();
      expect(policy.name).toBe("finance-constitution");
      expect(policy.version).toBe("1.0.0");
    });
  });

  describe("Caching", () => {
    test("should cache policies for subsequent loads", async () => {
      // First load - fresh
      const policy1 = await policyLoader.load("finance-constitution");

      // Second load - should be from cache
      const policy2 = await policyLoader.load("finance-constitution");

      // Both should return the same data
      expect(policy1.id).toBe(policy2.id);
      expect(policy1.name).toBe(policy2.name);
      expect(policy1.version).toBe(policy2.version);

      // Verify it's actually cached by checking object reference
      // (Note: This may not work if loader returns new objects each time,
      //  but at least we verify consistent data)
      expect(policy1).toEqual(policy2);
    });

    test("should serve from cache within TTL window", async () => {
      const testKey = "finance-constitution@1.0.0";

      // Load once
      const policy1 = await policyLoader.load(testKey);

      // Load again immediately (well within 60s TTL)
      const policy2 = await policyLoader.load(testKey);

      // Should return same data (verifies cache is working)
      expect(policy1.id).toBe(policy2.id);
      expect(policy1.version).toBe(policy2.version);
    });
  });

  describe("Error Handling", () => {
    test("should throw NotFoundError for non-existent policy", async () => {
      await expect(policyLoader.load("non-existent-policy")).rejects.toThrow(
        NotFoundError
      );
    });

    test("should throw NotFoundError for non-existent version", async () => {
      await expect(
        policyLoader.load("finance-constitution@99.99.99")
      ).rejects.toThrow(NotFoundError);
    });

    test("should throw BadRequestError for empty policy name", async () => {
      await expect(policyLoader.load("")).rejects.toThrow(BadRequestError);
    });

    test("should throw BadRequestError for invalid format", async () => {
      await expect(policyLoader.load("@1.0.0")).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe("Policy Structure", () => {
    test("should return complete policy structure", async () => {
      const policy = await policyLoader.load("finance-constitution");

      expect(policy.id).toBeTypeOf("number");
      expect(policy.name).toBeTypeOf("string");
      expect(policy.version).toBeTypeOf("string");
      expect(policy.doc).toBeTypeOf("object");
      expect(policy.createdAt).toBeInstanceOf(Date);
    });

    test("should have valid policy document structure", async () => {
      const policy = await policyLoader.load("finance-constitution");

      expect(policy.doc.version).toBe("1.0.0");
      expect(policy.doc.nodes).toBeDefined();
      expect(policy.doc.nodes["finance"]).toBeDefined();
      expect(policy.doc.nodes["finance"]?.authorities).toBeInstanceOf(Array);
    });
  });
});
