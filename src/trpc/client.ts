"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./routers/_app";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function makeTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
        headers() {
          const headers = new Headers();
          headers.set("x-trpc-source", "nextjs-react");
          return headers;
        },
      }),
    ],
  });
}