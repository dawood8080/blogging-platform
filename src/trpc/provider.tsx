"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TRPCProvider, makeTRPCClient } from "./client";
import { makeQueryClient } from "./query-client";

export function TRPCProviderWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  const [trpcClient] = useState(() => makeTRPCClient());

  return (
    <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </TRPCProvider>
  );
}
