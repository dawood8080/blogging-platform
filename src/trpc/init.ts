import { initTRPC, TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { verifyToken, type SessionUser, setSessionCookie, clearSessionCookie } from "@/lib/auth";

export type TRPCContext = {
  user: SessionUser | null;
  setSessionCookie: (token: string) => Promise<void>;
  clearSessionCookie: () => Promise<void>;
};

export async function createTRPCContext(): Promise<TRPCContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifyToken(token) : null;

  return {
    user,
    setSessionCookie,
    clearSessionCookie,
  };
}

const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const authMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(authMiddleware);