// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    set: mockSet,
    delete: mockDelete,
    get: mockGet,
  })),
}));

// ponytail: test auth functions — need to mock require() calls
// Since auth.ts uses require() for bcryptjs and jose, we test the logic indirectly

describe("auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("setSessionCookie calls cookieStore.set with correct options", async () => {
    const { setSessionCookie } = await import("@/lib/auth");
    await setSessionCookie("my-jwt-token");

    expect(mockSet).toHaveBeenCalledWith("session", "my-jwt-token", {
      httpOnly: true,
      secure: expect.any(Boolean),
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  });

  it("clearSessionCookie calls cookieStore.delete", async () => {
    const { clearSessionCookie } = await import("@/lib/auth");
    await clearSessionCookie();
    expect(mockDelete).toHaveBeenCalledWith("session");
  });

  it("getSession returns null when no session cookie", async () => {
    mockGet.mockReturnValue(undefined);
    const { getSession } = await import("@/lib/auth");
    const result = await getSession();
    expect(result).toBeNull();
  });

  it("getSession returns verified user when valid token present", async () => {
    const { signToken, getSession } = await import("@/lib/auth");
    const user = { id: "u1", email: "a@b.com", name: "A" };
    const token = await signToken(user);
    mockGet.mockReturnValue({ value: token });

    const result = await getSession();
    expect(result).toEqual(user);
  });

  it("getSession returns null when token is invalid", async () => {
    mockGet.mockReturnValue({ value: "garbage-token" });
    const { getSession } = await import("@/lib/auth");
    const result = await getSession();
    expect(result).toBeNull();
  });

  it("requireAuth throws when no session", async () => {
    mockGet.mockReturnValue(undefined);
    const { requireAuth } = await import("@/lib/auth");
    await expect(requireAuth()).rejects.toThrow("UNAUTHORIZED");
  });

  it("requireAuth returns user when session valid", async () => {
    const { signToken, requireAuth } = await import("@/lib/auth");
    const user = { id: "u1", email: "a@b.com", name: "A" };
    const token = await signToken(user);
    mockGet.mockReturnValue({ value: token });

    const result = await requireAuth();
    expect(result).toEqual(user);
  });
});