import { createRequire } from "module";
// createRequire avoids Turbopack TDZ with these CJS packages
const require = createRequire(import.meta.url);
const bcryptjs = require("bcryptjs") as typeof import("bcryptjs");
const jose = require("jose") as typeof import("jose");
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-change-in-prod"
);

const COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcryptjs.compare(password, passwordHash);
}

export async function signToken(user: SessionUser): Promise<string> {
  return new jose.SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (
      typeof payload.sub === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string"
    ) {
      return { id: payload.sub, email: payload.email, name: payload.name };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
