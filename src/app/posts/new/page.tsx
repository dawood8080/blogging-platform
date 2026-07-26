import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { HydrateClient } from "@/trpc/server";
import NewPostForm from "./new-post-client";

export default async function NewPostPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login");

  return (
    <HydrateClient>
      <NewPostForm />
    </HydrateClient>
  );
}
