import { trpc, HydrateClient, prefetch } from "@/trpc/server";
import PostDetail from "./post-detail";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  void prefetch(trpc.posts.bySlug.queryOptions({ slug }));
  void prefetch(trpc.auth.me.queryOptions());

  return (
    <HydrateClient>
      <PostDetail slug={slug} />
    </HydrateClient>
  );
}
