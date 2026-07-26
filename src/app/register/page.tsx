"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "At least 1 uppercase letter (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "At least 1 special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, registerPending } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const allRulesPass = RULES.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (!allRulesPass) return;
    try {
      await register(email, name, password);
      router.push("/");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(true)}
                required
                autoComplete="new-password"
                aria-invalid={touched && !allRulesPass}
                aria-describedby="password-rules"
              />
              {touched && (
                <ul id="password-rules" className="space-y-1 mt-2">
                  {RULES.map((rule) => {
                    const pass = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={`text-xs flex items-center gap-1.5 ${
                          pass ? "text-green-600" : "text-destructive"
                        }`}
                      >
                        <span aria-hidden>{pass ? "\u2713" : "\u2717"}</span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={registerPending || !allRulesPass}
            >
              {registerPending ? "Creating account..." : "Register"}
            </Button>
          </form>
          <p className="text-sm text-center mt-4 text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}