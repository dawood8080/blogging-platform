import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { trpc, HydrateClient, prefetch } from "@/trpc/server";
import MyPosts from "./_components/my-posts-client";

export default async function MyPostsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login");

  void prefetch(trpc.posts.mine.queryOptions());

  return (
    <HydrateClient>
      <MyPosts />
    </HydrateClient>
  );
}
