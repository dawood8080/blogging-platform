import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(500)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly (e.g. my-post-title)"),
  excerpt: z.string().max(1000).optional(),
  content: z.string().min(1, "Content is required"),
  published: z.boolean().default(true),
});

export const updatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(500).optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(500)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly (e.g. my-post-title)")
    .optional(),
  excerpt: z.string().max(1000).optional(),
  content: z.string().min(1).optional(),
  published: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
