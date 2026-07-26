import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-change-in-prod"
);

const PROTECTED_ROUTES = ["/my-posts", "/posts/new", "/posts/:slug/edit"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => {
    if (route.includes(":")) {
      // simple prefix match for dynamic segments (/posts/*/edit)
      const prefix = route.split(":")[0]; // "/posts/"
      const suffix = route.split(")")[1] || ""; // "/edit" or ""
      const segments = pathname.split("/");
      return (
        pathname.startsWith(prefix) &&
        segments.length === 4 &&
        pathname.endsWith(suffix || "/edit")
      );
    }
    return pathname.startsWith(route);
  });

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/my-posts/:path*", "/posts/new/:path*", "/posts/:slug/edit/:path*"],
};
