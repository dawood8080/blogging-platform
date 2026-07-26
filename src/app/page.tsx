import { trpc, HydrateClient, prefetch } from "@/trpc/server";
import PostsList from "./_components/posts-list";

export default async function HomePage() {
  void prefetch(trpc.posts.list.queryOptions({ page: 1, limit: 20 }));
  void prefetch(trpc.auth.me.queryOptions());

  return (
    <HydrateClient>
      <PostsList />
    </HydrateClient>
  );
}
