import { postsRepo, type IPostsRepository } from "@/lib/repositories";
import type {
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
} from "@/lib/schemas";

export class PostsService {
  constructor(private repo: IPostsRepository = postsRepo()) {}

  listPublished(opts: {
    page: number;
    limit: number;
    authorId?: string;
  }) {
    return this.repo.findPublished(opts);
  }

  getBySlug(slug: string, userId?: string) {
    return this.repo.findBySlug(slug, userId);
  }

  getById(id: string) {
    return this.repo.findById(id);
  }

  getMine(authorId: string) {
    return this.repo.findMine(authorId);
  }

  create(authorId: string, input: CreatePostInput) {
    return this.repo.create({ ...input, authorId });
  }

  update(id: string, authorId: string, input: UpdatePostInput) {
    return this.repo.update(id, authorId, input);
  }

  delete(id: string, authorId: string) {
    return this.repo.delete(id, authorId);
  }

  toggleLike(postId: string, userId: string) {
    return this.repo.toggleLike(postId, userId);
  }

  hasLiked(postId: string, userId: string) {
    return this.repo.hasLiked(postId, userId);
  }

  createComment(postId: string, authorId: string, input: CreateCommentInput) {
    return this.repo.createComment(postId, authorId, input.content);
  }

  getComments(postId: string) {
    return this.repo.getComments(postId);
  }
}