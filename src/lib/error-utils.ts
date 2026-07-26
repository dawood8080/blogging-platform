import { TRPCClientError } from "@trpc/client";
import { ZodError } from "zod";

// ── Friendly message map ──────────────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid email or password",
  EMAIL_TAKEN: "Email already registered",
  NOT_FOUND: "Resource not found",
  NOT_FOUND_OR_FORBIDDEN: "Not found or you don't have permission",
  UNAUTHORIZED: "You need to log in first",
  SLUG_TAKEN: "A post with this slug already exists",
};

// ── Try to extract human-friendly message from any error ───────────
export function getErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred";

  // ZodError (from direct .parse() calls)
  if (err instanceof ZodError) {
    return err.issues.map((i) => i.message).join(". ");
  }

  // tRPC client error
  if (err instanceof TRPCClientError) {

    const msg = err.shape?.message ?? err.message;
    if (typeof msg === "string") {
      if (ERROR_MESSAGES[msg]) return ERROR_MESSAGES[msg];
      if (!msg.startsWith("[")) return msg;
    }

    return "Something went wrong. Please try again.";
  }

  // Native Error with a known message
  if (err instanceof Error) {
    if (ERROR_MESSAGES[err.message]) return ERROR_MESSAGES[err.message];
    if (err.message) return err.message;
  }

  return "An unexpected error occurred";
}
