import { db } from "@/db";
import { posts, comments, likes, users } from "@/db/schema";
import { eq, desc, and, count as drizzleCount } from "drizzle-orm";

export interface CreatePostInput {
  authorId: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  published?: boolean;
}

export interface UpdatePostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  published?: boolean;
}

export type PostWithAuthor = typeof posts.$inferSelect & {
  author: Pick<typeof users.$inferSelect, "id" | "name" | "email">;
  _count?: { likes: number; comments: number };
  hasLiked?: boolean;
};

const authorSelect = {
  id: users.id,
  name: users.name,
  email: users.email,
} as const;

const postSelect = {
  post: posts,
  author: authorSelect,
} as const;

// mapping repeated 5x → extract once
function mapPost(r: { post: typeof posts.$inferSelect; author: { id: string; name: string; email: string } }): PostWithAuthor {
  return { ...r.post, author: r.author };
}

export interface IPostsRepository {
  findPublished(opts: {
    page: number;
    limit: number;
    authorId?: string;
  }): Promise<{ posts: PostWithAuthor[]; total: number }>;
  findBySlug(slug: string, userId?: string): Promise<PostWithAuthor | null>;
  findById(id: string): Promise<PostWithAuthor | null>;
  findMine(authorId: string): Promise<PostWithAuthor[]>;
  create(input: CreatePostInput): Promise<PostWithAuthor>;
  update(
    id: string,
    authorId: string,
    input: UpdatePostInput
  ): Promise<PostWithAuthor | null>;
  delete(id: string, authorId: string): Promise<boolean>;
  toggleLike(postId: string, userId: string): Promise<boolean>;
  hasLiked(postId: string, userId: string): Promise<boolean>;
  createComment(
    postId: string,
    authorId: string,
    content: string
  ): Promise<typeof comments.$inferSelect>;
  getComments(postId: string): Promise<
    (typeof comments.$inferSelect & {
      author: Pick<typeof users.$inferSelect, "id" | "name">;
    })[]
  >;
}

export class PostsRepository implements IPostsRepository {
  async findPublished(opts: {
    page: number;
    limit: number;
    authorId?: string;
  }): Promise<{ posts: PostWithAuthor[]; total: number }> {
    const { page, limit, authorId } = opts;
    const offset = (page - 1) * limit;

    const conditions = [eq(posts.published, true)];
    if (authorId) conditions.push(eq(posts.authorId, authorId));

    const where = and(...conditions);

    const [postsResult, countResult] = await Promise.all([
      db()
        .select(postSelect)
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(where)
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset),
      db()
        .select({ count: drizzleCount() })
        .from(posts)
        .where(where),
    ]);

    return {
      posts: postsResult.map(mapPost),
      total: countResult[0]?.count ?? 0,
    };
  }

  async findBySlug(slug: string, userId?: string): Promise<PostWithAuthor | null> {
    const result = await db()
      .select(postSelect)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!result[0]) return null;

    const postId = result[0].post.id;

    const likeCountPromise = db()
      .select({ count: drizzleCount() })
      .from(likes)
      .where(eq(likes.postId, postId));

    const commentCountPromise = db()
      .select({ count: drizzleCount() })
      .from(comments)
      .where(eq(comments.postId, postId));

    const userLikePromise = userId
      ? db()
          .select({ id: likes.id })
          .from(likes)
          .where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
          .limit(1)
      : Promise.resolve([]);

    const [likeCount, commentCount, userLike] = await Promise.all([
      likeCountPromise,
      commentCountPromise,
      userLikePromise,
    ]);

    return {
      ...mapPost(result[0]),
      _count: {
        likes: likeCount[0]?.count ?? 0,
        comments: commentCount[0]?.count ?? 0,
      },
      hasLiked: userLike.length > 0,
    };
  }

  async findById(id: string): Promise<PostWithAuthor | null> {
    const result = await db()
      .select(postSelect)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, id))
      .limit(1);

    return result[0] ? mapPost(result[0]) : null;
  }

  async findMine(authorId: string): Promise<PostWithAuthor[]> {
    const result = await db()
      .select(postSelect)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.authorId, authorId))
      .orderBy(desc(posts.createdAt));

    return result.map(mapPost);
  }

  async create(input: CreatePostInput): Promise<PostWithAuthor> {
    const result = await db().insert(posts).values(input).returning();
    const post = result[0];

    const author = await db()
      .select(authorSelect)
      .from(users)
      .where(eq(users.id, post.authorId))
      .limit(1);

    return { ...post, author: author[0] };
  }

  async update(
    id: string,
    authorId: string,
    input: UpdatePostInput
  ): Promise<PostWithAuthor | null> {
    const result = await db()
      .update(posts)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(posts.id, id), eq(posts.authorId, authorId)))
      .returning();

    if (!result[0]) return null;
    return this.findById(result[0].id);
  }

  async delete(id: string, authorId: string): Promise<boolean> {
    const result = await db()
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.authorId, authorId)))
      .returning();
    return result.length > 0;
  }

  async toggleLike(postId: string, userId: string): Promise<boolean> {
    const existing = await db()
      .select()
      .from(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
      .limit(1);

    if (existing[0]) {
      await db()
        .delete(likes)
        .where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
      return false; // unliked
    }

    await db().insert(likes).values({ postId, userId });
    return true; // liked
  }

  async hasLiked(postId: string, userId: string): Promise<boolean> {
    const result = await db()
      .select()
      .from(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
      .limit(1);
    return result.length > 0;
  }

  async createComment(
    postId: string,
    authorId: string,
    content: string
  ): Promise<typeof comments.$inferSelect> {
    const result = await db()
      .insert(comments)
      .values({ postId, authorId, content })
      .returning();
    return result[0];
  }

  async getComments(postId: string) {
    const result = await db()
      .select({
        comment: comments,
        author: {
          id: users.id,
          name: users.name,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));

    return result.map((r) => ({
      ...r.comment,
      author: r.author,
    }));
  }
}
