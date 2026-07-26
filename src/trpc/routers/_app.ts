import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { postsRouter } from "./posts";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  posts: postsRouter,
});

export type AppRouter = typeof appRouter;
