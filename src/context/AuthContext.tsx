"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type User = {
  id: string;
  email: string;
  name: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginPending: boolean;
  registerPending: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const trpc = useTRPC();

  const { data: meData } = useQuery({
    ...trpc.auth.me.queryOptions(),
    enabled: loading,
    retry: false,
  });

  useEffect(() => {
    if (meData !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from session check
      setUser(meData);
      setLoading(false);
    }
  }, [meData, setUser, setLoading]);

  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: (result) => {
        setUser(result.user);
      },
    })
  );

  const registerMutation = useMutation(
    trpc.auth.register.mutationOptions({
      onSuccess: (result) => {
        setUser(result.user);
      },
    })
  );

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSettled: () => {
        setUser(null);
      },
    })
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation]
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      await registerMutation.mutateAsync({ email, name, password });
    },
    [registerMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        loginPending: loginMutation.isPending,
        registerPending: registerMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}