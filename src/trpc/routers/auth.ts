import { createTRPCRouter, publicProcedure } from "../init";
import { authService } from "@/lib/services";
import {
  registerSchema,
  loginSchema,
} from "@/lib/schemas";

export const authRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return authService().getMe(ctx.user.id);
  }),

  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService().register(input);
      await ctx.setSessionCookie(result.token);
      return result;
    }),

  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const result = await authService().login(input);
    await ctx.setSessionCookie(result.token);
    return result;
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.clearSessionCookie();
    return { success: true };
  }),
});