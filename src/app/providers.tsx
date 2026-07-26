"use client";

import { TRPCProviderWrapper } from "@/trpc/provider";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProviderWrapper>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </TRPCProviderWrapper>
  );
}
