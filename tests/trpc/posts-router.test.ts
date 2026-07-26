// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/trpc/routers/_app";
import { TRPCError } from "@trpc/server";
import type { TRPCContext } from "@/trpc/init";

const mockPostsService = {
  listPublished: vi.fn(),
  getBySlug: vi.fn(),
  getById: vi.fn(),
  getMine: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  toggleLike: vi.fn(),
  hasLiked: vi.fn(),
  createComment: vi.fn(),
  getComments: vi.fn(),
};

vi.mock("@/lib/services", () => ({
  postsService: () => mockPostsService,
}));

const UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeCtx(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    user: null,
    setSessionCookie: vi.fn(),
    clearSessionCookie: vi.fn(),
    ...overrides,
  };
}

const mockPost = {
  id: UUID, authorId: "u1", title: "Test", slug: "test", content: "Hello",
  excerpt: null, published: true, createdAt: new Date(), updatedAt: new Date(),
  author: { id: "u1", name: "User", email: "u@test.com" },
  _count: { likes: 0, comments: 0 },
  hasLiked: false,
};

describe("postsRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns paginated posts", async () => {
      mockPostsService.listPublished.mockResolvedValue({ posts: [mockPost], total: 1 });
      const caller = appRouter.createCaller(makeCtx());
      const result = await caller.posts.list({ page: 1, limit: 10 });
      expect(result).toEqual({ posts: [mockPost], total: 1 });
    });

    it("uses default values for page and limit", async () => {
      mockPostsService.listPublished.mockResolvedValue({ posts: [], total: 0 });
      const caller = appRouter.createCaller(makeCtx());
      await caller.posts.list({});
      expect(mockPostsService.listPublished).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        authorId: undefined,
      });
    });
  });

  describe("bySlug", () => {
    it("returns post when found", async () => {
      mockPostsService.getBySlug.mockResolvedValue(mockPost);
      const caller = appRouter.createCaller(makeCtx());
      const result = await caller.posts.bySlug({ slug: "test" });
      expect(result).toEqual(mockPost);
    });

    it("throws NOT_FOUND when post doesn't exist", async () => {
      mockPostsService.getBySlug.mockResolvedValue(null);
      const caller = appRouter.createCaller(makeCtx());
      await expect(caller.posts.bySlug({ slug: "nope" })).rejects.toThrow(TRPCError);
    });
  });

  describe("mine", () => {
    it("returns user's posts", async () => {
      mockPostsService.getMine.mockResolvedValue([mockPost]);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      const result = await caller.posts.mine();
      expect(result).toEqual([mockPost]);
      expect(mockPostsService.getMine).toHaveBeenCalledWith("u1");
    });

    it("throws UNAUTHORIZED when not logged in", async () => {
      const caller = appRouter.createCaller(makeCtx());
      await expect(caller.posts.mine()).rejects.toThrow(TRPCError);
    });
  });

  describe("create", () => {
    it("creates post and returns it", async () => {
      mockPostsService.create.mockResolvedValue(mockPost);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      const result = await caller.posts.create({
        title: "Test", slug: "test", content: "Hello", published: true,
      });
      expect(result).toEqual(mockPost);
      expect(mockPostsService.create).toHaveBeenCalledWith("u1", {
        title: "Test", slug: "test", content: "Hello", published: true,
      });
    });

    it("throws CONFLICT for duplicate slug", async () => {
      mockPostsService.create.mockRejectedValue(new Error("unique constraint"));
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      await expect(
        caller.posts.create({ title: "T", slug: "dup", content: "C", published: true })
      ).rejects.toThrow(TRPCError);
    });

    it("throws BAD_REQUEST for invalid input", async () => {
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      await expect(
        caller.posts.create({ title: "", slug: "", content: "", published: true })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("update", () => {
    it("updates post and returns it", async () => {
      mockPostsService.update.mockResolvedValue(mockPost);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      const result = await caller.posts.update({ id: UUID, data: { title: "Updated" } });
      expect(result).toEqual(mockPost);
    });

    it("throws NOT_FOUND when post not found", async () => {
      mockPostsService.update.mockResolvedValue(null);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      await expect(caller.posts.update({ id: "00000000-0000-0000-0000-000000000999", data: { title: "X" } })).rejects.toThrow(TRPCError);
    });
  });

  describe("delete", () => {
    it("deletes post and returns success", async () => {
      mockPostsService.delete.mockResolvedValue(true);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      const result = await caller.posts.delete({ id: UUID });
      expect(result).toEqual({ success: true });
    });

    it("throws NOT_FOUND when post not found or not owner", async () => {
      mockPostsService.delete.mockResolvedValue(false);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      await expect(caller.posts.delete({ id: "00000000-0000-0000-0000-000000000999" })).rejects.toThrow(TRPCError);
    });
  });

  describe("like", () => {
    it("toggles like", async () => {
      mockPostsService.toggleLike.mockResolvedValue(true);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      const result = await caller.posts.like({ postId: UUID });
      expect(result).toEqual({ liked: true });
    });

    it("throws UNAUTHORIZED when not logged in", async () => {
      const caller = appRouter.createCaller(makeCtx());
      await expect(caller.posts.like({ postId: UUID })).rejects.toThrow(TRPCError);
    });
  });

  describe("createComment", () => {
    it("creates comment", async () => {
      const mockComment = { id: "c1", postId: "p1", authorId: "u1", content: "Nice!", createdAt: new Date() };
      mockPostsService.createComment.mockResolvedValue(mockComment);
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      const result = await caller.posts.createComment({
        postId: UUID, data: { content: "Nice!" },
      });
      expect(result).toEqual(mockComment);
    });

    it("throws BAD_REQUEST for empty comment", async () => {
      const caller = appRouter.createCaller(makeCtx({ user: { id: "u1", email: "a@b.com", name: "A" } }));
      await expect(
        caller.posts.createComment({ postId: UUID, data: { content: "" } })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED when not logged in", async () => {
      const caller = appRouter.createCaller(makeCtx());
      await expect(
        caller.posts.createComment({ postId: UUID, data: { content: "Hi" } })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("comments", () => {
    it("returns comments for a post", async () => {
      const mockComments = [{ id: "c1", postId: "p1", authorId: "u1", content: "Hi", createdAt: new Date(), author: { id: "u1", name: "User" } }];
      mockPostsService.getComments.mockResolvedValue(mockComments);
      const caller = appRouter.createCaller(makeCtx());
      const result = await caller.posts.comments({ postId: UUID });
      expect(result).toEqual(mockComments);
    });
  });
});
