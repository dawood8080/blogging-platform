import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
} from "@/lib/schemas";

describe("registerSchema", () => {
  const validPassword = "Passw0rd!";

  it("validates correct input", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      name: "Test User",
      password: validPassword,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      name: "Test",
      password: validPassword,
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      name: "Test",
      password: "Sh0rt!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      name: "Test",
      password: "password1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      name: "Test",
      password: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      name: "",
      password: validPassword,
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("validates correct input", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPostSchema", () => {
  it("validates correct input", () => {
    const result = createPostSchema.safeParse({
      title: "My Post",
      slug: "my-post",
      content: "Content here",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid slug", () => {
    const result = createPostSchema.safeParse({
      title: "My Post",
      slug: "My Post!",
      content: "Content",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createPostSchema.safeParse({
      title: "",
      slug: "my-post",
      content: "Content",
    });
    expect(result.success).toBe(false);
  });

  it("defaults published to true", () => {
    const result = createPostSchema.safeParse({
      title: "My Post",
      slug: "my-post",
      content: "Content",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.published).toBe(true);
    }
  });
});

describe("updatePostSchema", () => {
  it("validates partial update", () => {
    const result = updatePostSchema.safeParse({ title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  it("validates empty object", () => {
    const result = updatePostSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createCommentSchema", () => {
  it("validates correct input", () => {
    const result = createCommentSchema.safeParse({ content: "Great post!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = createCommentSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects too long content", () => {
    const result = createCommentSchema.safeParse({
      content: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});