// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/trpc/routers/_app";
import { TRPCError } from "@trpc/server";
import type { TRPCContext } from "@/trpc/init";

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
};

vi.mock("@/lib/services", () => ({
  authService: () => mockAuthService,
}));

function makeCtx(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    user: null,
    setSessionCookie: vi.fn(),
    clearSessionCookie: vi.fn(),
    ...overrides,
  };
}

describe("authRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("me returns null when not logged in", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user when logged in", async () => {
    const user = { id: "u1", email: "a@b.com", name: "A" };
    mockAuthService.getMe.mockResolvedValue(user);

    const caller = appRouter.createCaller(makeCtx({ user }));
    const result = await caller.auth.me();
    expect(result).toEqual(user);
    expect(mockAuthService.getMe).toHaveBeenCalledWith("u1");
  });

  it("register creates user and sets cookie", async () => {
    const user = { id: "u1", email: "a@b.com", name: "A" };
    mockAuthService.register.mockResolvedValue({ user, token: "jwt-token" });

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.register({
      email: "a@b.com",
      name: "A",
      password: "Password1!",
    });

    expect(result.user).toEqual(user);
    expect(result.token).toBe("jwt-token");
  });

  it("register throws BAD_REQUEST for invalid email", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.auth.register({ email: "bad", name: "A", password: "Password1!" })
    ).rejects.toThrow(TRPCError);
  });

  it("login returns user and sets cookie", async () => {
    const user = { id: "u1", email: "a@b.com", name: "A" };
    mockAuthService.login.mockResolvedValue({ user, token: "jwt-token" });

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.login({ email: "a@b.com", password: "pass" });

    expect(result.user).toEqual(user);
    expect(result.token).toBe("jwt-token");
  });

  it("login throws BAD_REQUEST for invalid input", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.auth.login({ email: "bad", password: "" })
    ).rejects.toThrow(TRPCError);
  });

  it("logout clears cookie and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});
