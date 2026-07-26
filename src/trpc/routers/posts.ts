import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { postsService } from "@/lib/services";
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
} from "@/lib/schemas";

export const postsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
        categoryId: z.string().uuid().optional(),
        authorId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input }) => {
      return postsService().listPublished(input);
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const post = await postsService().getBySlug(input.slug, ctx.user?.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      return post;
    }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    return postsService().getMine(ctx.user.id);
  }),

  create: protectedProcedure
    .input(createPostSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await postsService().create(ctx.user.id, input);
      } catch (err) {
        if (err instanceof Error && err.message.includes("unique")) {
          throw new TRPCError({ code: "CONFLICT", message: "A post with this slug already exists" });
        }
        throw err;
      }
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updatePostSchema }))
    .mutation(async ({ ctx, input }) => {
      const post = await postsService().update(
        input.id,
        ctx.user.id,
        input.data
      );
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found or you don't have permission" });
      return post;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await postsService().delete(input.id, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found or you don't have permission" });
      return { success: true };
    }),

  like: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const liked = await postsService().toggleLike(input.postId, ctx.user.id);
      return { liked };
    }),

  createComment: protectedProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        data: createCommentSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return postsService().createComment(
        input.postId,
        ctx.user.id,
        input.data
      );
    }),

  comments: publicProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .query(async ({ input }) => {
      return postsService().getComments(input.postId);
    }),
});
