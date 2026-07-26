import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { appRouter } from "./routers/_app";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

export function HydrateClient({ children }: { children: React.ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      {children}
    </HydrationBoundary>
  );
}

// ponytail: prefetch bridges tRPC queryOptions to TanStack's prefetchQuery.
// `as any` needed because tRPC's queryOptions return type and TanStack's
// prefetchQuery parameter type have a staleTime function incompatibility.
// This is the pattern from the official tRPC SSR docs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefetch(queryOptions: any) {
  void getQueryClient().prefetchQuery(queryOptions);
}
