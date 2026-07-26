import { describe, it, expect } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { ZodError } from "zod";
import { getErrorMessage } from "@/lib/error-utils";

function makeTRPCError(message: string, shapeMessage?: string) {
  const err = new TRPCClientError(message);
  if (shapeMessage !== undefined) {
    Object.assign(err, { shape: { message: shapeMessage, code: "BAD_REQUEST", data: undefined } });
  }
  return err;
}

describe("getErrorMessage", () => {
  it("returns default for null", () => {
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });

  it("returns default for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
  });

  it("returns default for non-error objects", () => {
    expect(getErrorMessage("string error")).toBe("An unexpected error occurred");
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
  });

  it("handles ZodError with single issue", () => {
    const err = new ZodError([]);
    err.addIssue({ code: "invalid_type", expected: "string", path: ["email"], message: "Expected string, received number" } as never);
    expect(getErrorMessage(err)).toBe("Expected string, received number");
  });

  it("handles ZodError with multiple issues", () => {
    const err = new ZodError([]);
    err.addIssue({ code: "too_small", minimum: 8, type: "string", inclusive: true, exact: false, path: ["password"], message: "Too short" } as never);
    err.addIssue({ code: "invalid_format", format: "email", path: ["email"], message: "Invalid email" } as never);
    expect(getErrorMessage(err)).toBe("Too short. Invalid email");
  });

  it("handles TRPCClientError with known mapped message via shape", () => {
    const err = makeTRPCError("raw", "INVALID_CREDENTIALS");
    expect(getErrorMessage(err)).toBe("Invalid email or password");
  });

  it("handles TRPCClientError with known mapped message via err.message fallback", () => {
    const err = makeTRPCError("EMAIL_TAKEN");
    expect(getErrorMessage(err)).toBe("Email already registered");
  });

  it("handles TRPCClientError with NOT_FOUND", () => {
    const err = makeTRPCError("raw", "NOT_FOUND");
    expect(getErrorMessage(err)).toBe("Resource not found");
  });

  it("handles TRPCClientError with UNAUTHORIZED", () => {
    const err = makeTRPCError("raw", "UNAUTHORIZED");
    expect(getErrorMessage(err)).toBe("You need to log in first");
  });

  it("handles TRPCClientError with SLUG_TAKEN", () => {
    const err = makeTRPCError("raw", "SLUG_TAKEN");
    expect(getErrorMessage(err)).toBe("A post with this slug already exists");
  });

  it("returns shape message as-is when human-readable (not [ prefixed)", () => {
    const err = makeTRPCError("raw", "Something went wrong on our end");
    expect(getErrorMessage(err)).toBe("Something went wrong on our end");
  });

  it("returns fallback for shape message starting with [", () => {
    const err = makeTRPCError("raw", "[TRPCError] internal");
    expect(getErrorMessage(err)).toBe("Something went wrong. Please try again.");
  });

  it("handles native Error with known message", () => {
    expect(getErrorMessage(new Error("INVALID_CREDENTIALS"))).toBe("Invalid email or password");
    expect(getErrorMessage(new Error("EMAIL_TAKEN"))).toBe("Email already registered");
    expect(getErrorMessage(new Error("UNAUTHORIZED"))).toBe("You need to log in first");
    expect(getErrorMessage(new Error("NOT_FOUND"))).toBe("Resource not found");
    expect(getErrorMessage(new Error("SLUG_TAKEN"))).toBe("A post with this slug already exists");
  });

  it("handles native Error with unknown message", () => {
    expect(getErrorMessage(new Error("DB connection refused"))).toBe("DB connection refused");
  });

  it("handles native Error with empty message", () => {
    expect(getErrorMessage(new Error(""))).toBe("An unexpected error occurred");
  });
});
