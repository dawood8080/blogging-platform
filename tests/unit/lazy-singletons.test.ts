import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: vi.fn(function () { return {}; }),
}));

vi.mock("@/lib/repositories/users.repository", () => ({
  UsersRepository: vi.fn(function () {
    return { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn() };
  }),
}));

vi.mock("@/lib/repositories/posts.repository", () => ({
  PostsRepository: vi.fn(function () {
    return {
      findPublished: vi.fn(), findBySlug: vi.fn(), findById: vi.fn(), findMine: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggleLike: vi.fn(),
      hasLiked: vi.fn(), createComment: vi.fn(), getComments: vi.fn(),
    };
  }),
}));

describe("lazy singletons", () => {
  it("usersRepo returns the same instance", async () => {
    const { usersRepo } = await import("@/lib/repositories");
    const a = usersRepo();
    const b = usersRepo();
    expect(a).toBe(b);
  });

  it("postsRepo returns the same instance", async () => {
    const { postsRepo } = await import("@/lib/repositories");
    const a = postsRepo();
    const b = postsRepo();
    expect(a).toBe(b);
  });
});
