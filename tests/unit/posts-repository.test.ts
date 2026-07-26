// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostsRepository } from "@/lib/repositories/posts.repository";

function mockChain(resolveValue: unknown) {
  const self: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit", "offset", "values", "set", "returning"]) {
    self[m] = vi.fn(() => self);
  }
  self.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
  return self;
}

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db", () => ({
  db: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

const fakePost = {
  id: "p1", authorId: "u1", title: "Test", slug: "test", content: "Body",
  excerpt: null, published: true, createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-01-01"),
};
const fakeAuthor = { id: "u1", name: "Alice", email: "a@b.com" };
const postRow = { post: fakePost, author: fakeAuthor };

describe("PostsRepository", () => {
  let repo: PostsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostsRepository();
  });

  describe("findPublished", () => {
    it("returns paginated posts with total", async () => {
      mockSelect
        .mockReturnValueOnce(mockChain([postRow]))
        .mockReturnValueOnce(mockChain([{ count: 1 }]));

      const result = await repo.findPublished({ page: 1, limit: 10 });
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].title).toBe("Test");
      expect(result.posts[0].author.name).toBe("Alice");
      expect(result.total).toBe(1);
    });

    it("returns empty when no posts", async () => {
      mockSelect
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([{ count: 0 }]));

      const result = await repo.findPublished({ page: 1, limit: 10 });
      expect(result.posts).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("findBySlug", () => {
    it("returns null when not found", async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));
      const result = await repo.findBySlug("nope");
      expect(result).toBeNull();
    });

    it("returns post with counts when no userId", async () => {
      mockSelect
        .mockReturnValueOnce(mockChain([postRow]))
        .mockReturnValueOnce(mockChain([{ count: 5 }]))
        .mockReturnValueOnce(mockChain([{ count: 3 }]));

      const result = await repo.findBySlug("test");
      expect(result).not.toBeNull();
      expect(result!._count!.likes).toBe(5);
      expect(result!._count!.comments).toBe(3);
      expect(result!._count!.likes).toBe(5);
      expect(result!.hasLiked).toBe(false);
    });

    it("returns hasLiked true when user liked", async () => {
      mockSelect
        .mockReturnValueOnce(mockChain([postRow]))
        .mockReturnValueOnce(mockChain([{ count: 5 }]))
        .mockReturnValueOnce(mockChain([{ count: 3 }]))
        .mockReturnValueOnce(mockChain([{ id: "like-1" }]));

      const result = await repo.findBySlug("test", "u2");
      expect(result!.hasLiked).toBe(true);
    });

    it("returns hasLiked false when user did not like", async () => {
      mockSelect
        .mockReturnValueOnce(mockChain([postRow]))
        .mockReturnValueOnce(mockChain([{ count: 5 }]))
        .mockReturnValueOnce(mockChain([{ count: 3 }]))
        .mockReturnValueOnce(mockChain([]));

      const result = await repo.findBySlug("test", "u2");
      expect(result!.hasLiked).toBe(false);
    });
  });

  describe("findById", () => {
    it("returns null when not found", async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));
      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("returns post with author when found", async () => {
      mockSelect.mockReturnValueOnce(mockChain([postRow]));
      const result = await repo.findById("p1");
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Test");
      expect(result!.author.id).toBe("u1");
    });
  });

  describe("findMine", () => {
    it("returns author's posts", async () => {
      mockSelect.mockReturnValueOnce(mockChain([postRow]));
      const result = await repo.findMine("u1");
      expect(result).toHaveLength(1);
      expect(result[0].authorId).toBe("u1");
    });
  });

  describe("create", () => {
    it("inserts and re-fetches author", async () => {
      mockInsert.mockReturnValueOnce(mockChain([fakePost]));
      mockSelect.mockReturnValueOnce(mockChain([fakeAuthor]));

      const result = await repo.create({ authorId: "u1", title: "Test", slug: "test", content: "Body" });
      expect(result.title).toBe("Test");
      expect(result.author.name).toBe("Alice");
    });
  });

  describe("update", () => {
    it("with correct owner returns updated post", async () => {
      const updated = { ...fakePost, title: "Updated" };
      mockUpdate.mockReturnValueOnce(mockChain([updated]));
      mockSelect.mockReturnValueOnce(mockChain([{ post: updated, author: fakeAuthor }]));

      const result = await repo.update("p1", "u1", { title: "Updated" });
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Updated");
    });

    it("with wrong owner returns null", async () => {
      mockUpdate.mockReturnValueOnce(mockChain([]));
      const result = await repo.update("p1", "wrong-user", { title: "Hacked" });
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("with correct owner returns true", async () => {
      mockDelete.mockReturnValueOnce(mockChain([fakePost]));
      const result = await repo.delete("p1", "u1");
      expect(result).toBe(true);
    });

    it("with wrong owner returns false", async () => {
      mockDelete.mockReturnValueOnce(mockChain([]));
      const result = await repo.delete("p1", "wrong-user");
      expect(result).toBe(false);
    });
  });

  describe("toggleLike", () => {
    it("inserts like when not existing, returns true", async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));
      mockInsert.mockReturnValueOnce(mockChain([{ postId: "p1", userId: "u2" }]));

      const result = await repo.toggleLike("p1", "u2");
      expect(result).toBe(true);
    });

    it("removes like when existing, returns false", async () => {
      mockSelect.mockReturnValueOnce(mockChain([{ id: "like-1" }]));
      mockDelete.mockReturnValueOnce(mockChain([]));

      const result = await repo.toggleLike("p1", "u2");
      expect(result).toBe(false);
    });
  });

  describe("hasLiked", () => {
    it("returns true when liked", async () => {
      mockSelect.mockReturnValueOnce(mockChain([{ id: "like-1" }]));
      const result = await repo.hasLiked("p1", "u2");
      expect(result).toBe(true);
    });

    it("returns false when not liked", async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));
      const result = await repo.hasLiked("p1", "u2");
      expect(result).toBe(false);
    });
  });

  describe("createComment", () => {
    it("inserts and returns the comment", async () => {
      const comment = { id: "c1", postId: "p1", authorId: "u2", content: "Hi", createdAt: new Date() };
      mockInsert.mockReturnValueOnce(mockChain([comment]));
      const result = await repo.createComment("p1", "u2", "Hi");
      expect(result.content).toBe("Hi");
    });
  });

  describe("getComments", () => {
    it("returns comments for a post", async () => {
      const commentRow = { comment: { id: "c1", postId: "p1", authorId: "u2", content: "Hi", createdAt: new Date() }, author: { id: "u2", name: "Bob" } };
      mockSelect.mockReturnValueOnce(mockChain([commentRow]));
      const result = await repo.getComments("p1");
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Hi");
      expect(result[0].author.name).toBe("Bob");
    });

    it("returns empty array when no comments", async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));
      const result = await repo.getComments("p1");
      expect(result).toEqual([]);
    });
  });
});
