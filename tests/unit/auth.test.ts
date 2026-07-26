// @vitest-environment node
import { describe, it, expect } from "vitest";

// ponytail: test auth functions — need to mock require() calls
// Since auth.ts uses require() for bcryptjs and jose, we test the logic indirectly

describe("auth helpers", () => {
  it("hashPassword and verifyPassword should be consistent", async () => {
    // Dynamic import to avoid Turbopack issues in test env
    const { hashPassword, verifyPassword } = await import("@/lib/auth");
    const hash = await hashPassword("testpassword");
    expect(hash).not.toBe("testpassword");
    expect(await verifyPassword("testpassword", hash)).toBe(true);
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("signToken and verifyToken should round-trip", async () => {
    const { signToken, verifyToken } = await import("@/lib/auth");
    const user = { id: "user-1", email: "test@test.com", name: "Test" };
    const token = await signToken(user);
    expect(token).toBeTruthy();

    const verified = await verifyToken(token);
    expect(verified).toEqual(user);
  });

  it("verifyToken returns null for invalid token", async () => {
    const { verifyToken } = await import("@/lib/auth");
    const result = await verifyToken("invalid-token");
    expect(result).toBeNull();
  });
});