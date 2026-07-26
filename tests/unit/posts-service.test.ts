import { describe, it, expect, vi, type Mock } from "vitest";
import { PostsService } from "@/lib/services/posts.service";
import type { IPostsRepository } from "@/lib/repositories";

function makeMockRepo(): IPostsRepository {
  return {
    findPublished: vi.fn() as Mock,
    findBySlug: vi.fn() as Mock,
    findById: vi.fn() as Mock,
    findMine: vi.fn() as Mock,
    create: vi.fn() as Mock,
    update: vi.fn() as Mock,
    delete: vi.fn() as Mock,
    toggleLike: vi.fn() as Mock,
    hasLiked: vi.fn() as Mock,
    createComment: vi.fn() as Mock,
    getComments: vi.fn() as Mock,
  };
}

const mockPost = {
  id: "p1", authorId: "u1", title: "Test", slug: "test", content: "Hello",
  excerpt: null, published: true, createdAt: new Date(), updatedAt: new Date(),
  author: { id: "u1", name: "User", email: "u@test.com" },
};

describe("PostsService", () => {
  it("listPublished forwards to repo.findPublished", async () => {
    const repo = makeMockRepo();
    (repo.findPublished as Mock).mockResolvedValue({ posts: [mockPost], total: 1 });
    const service = new PostsService(repo);

    const result = await service.listPublished({ page: 1, limit: 10 });
    expect(repo.findPublished).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(result).toEqual({ posts: [mockPost], total: 1 });
  });

  it("getBySlug forwards to repo.findBySlug", async () => {
    const repo = makeMockRepo();
    (repo.findBySlug as Mock).mockResolvedValue(mockPost);
    const service = new PostsService(repo);

    const result = await service.getBySlug("test", "u1");
    expect(repo.findBySlug).toHaveBeenCalledWith("test", "u1");
    expect(result).toBe(mockPost);
  });

  it("getById forwards to repo.findById", async () => {
    const repo = makeMockRepo();
    (repo.findById as Mock).mockResolvedValue(mockPost);
    const service = new PostsService(repo);

    const result = await service.getById("p1");
    expect(repo.findById).toHaveBeenCalledWith("p1");
    expect(result).toBe(mockPost);
  });

  it("getMine forwards to repo.findMine", async () => {
    const repo = makeMockRepo();
    (repo.findMine as Mock).mockResolvedValue([mockPost]);
    const service = new PostsService(repo);

    const result = await service.getMine("u1");
    expect(repo.findMine).toHaveBeenCalledWith("u1");
    expect(result).toEqual([mockPost]);
  });

  it("create forwards with authorId spread into input", async () => {
    const repo = makeMockRepo();
    (repo.create as Mock).mockResolvedValue(mockPost);
    const service = new PostsService(repo);

    const input = { title: "Test", slug: "test", content: "Hello", published: true as const };
    const result = await service.create("u1", input);
    expect(repo.create).toHaveBeenCalledWith({ ...input, authorId: "u1" });
    expect(result).toBe(mockPost);
  });

  it("update forwards all three args", async () => {
    const repo = makeMockRepo();
    (repo.update as Mock).mockResolvedValue(mockPost);
    const service = new PostsService(repo);

    const data = { title: "Updated" };
    const result = await service.update("p1", "u1", data);
    expect(repo.update).toHaveBeenCalledWith("p1", "u1", data);
    expect(result).toBe(mockPost);
  });

  it("delete forwards to repo.delete", async () => {
    const repo = makeMockRepo();
    (repo.delete as Mock).mockResolvedValue(true);
    const service = new PostsService(repo);

    const result = await service.delete("p1", "u1");
    expect(repo.delete).toHaveBeenCalledWith("p1", "u1");
    expect(result).toBe(true);
  });

  it("toggleLike forwards to repo.toggleLike", async () => {
    const repo = makeMockRepo();
    (repo.toggleLike as Mock).mockResolvedValue(true);
    const service = new PostsService(repo);

    const result = await service.toggleLike("p1", "u1");
    expect(repo.toggleLike).toHaveBeenCalledWith("p1", "u1");
    expect(result).toBe(true);
  });

  it("hasLiked forwards to repo.hasLiked", async () => {
    const repo = makeMockRepo();
    (repo.hasLiked as Mock).mockResolvedValue(false);
    const service = new PostsService(repo);

    const result = await service.hasLiked("p1", "u1");
    expect(repo.hasLiked).toHaveBeenCalledWith("p1", "u1");
    expect(result).toBe(false);
  });

  it("createComment extracts input.content and forwards", async () => {
    const repo = makeMockRepo();
    const mockComment = { id: "c1", postId: "p1", authorId: "u1", content: "Nice!", createdAt: new Date() };
    (repo.createComment as Mock).mockResolvedValue(mockComment);
    const service = new PostsService(repo);

    const result = await service.createComment("p1", "u1", { content: "Nice!" });
    expect(repo.createComment).toHaveBeenCalledWith("p1", "u1", "Nice!");
    expect(result).toBe(mockComment);
  });

  it("getComments forwards to repo.getComments", async () => {
    const repo = makeMockRepo();
    const mockComments = [{ id: "c1", postId: "p1", authorId: "u1", content: "Hi", createdAt: new Date(), author: { id: "u1", name: "User" } }];
    (repo.getComments as Mock).mockResolvedValue(mockComments);
    const service = new PostsService(repo);

    const result = await service.getComments("p1");
    expect(repo.getComments).toHaveBeenCalledWith("p1");
    expect(result).toEqual(mockComments);
  });
});
