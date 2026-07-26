import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { trpc, HydrateClient, prefetch } from "@/trpc/server";
import EditPostForm from "./edit-post-client";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login");

  const { slug } = await params;
  void prefetch(trpc.posts.mine.queryOptions());

  return (
    <HydrateClient>
      <EditPostForm slug={slug} />
    </HydrateClient>
  );
}
