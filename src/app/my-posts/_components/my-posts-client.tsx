"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PenSquare, Pencil, Trash2 } from "lucide-react";

export default function MyPosts() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery(trpc.posts.mine.queryOptions());

  const deleteMutation = useMutation(
    trpc.posts.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
        queryClient.invalidateQueries(
          trpc.posts.list.queryOptions({ page: 1, limit: 20 })
        );
      },
    })
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Posts</h1>
        <Link href="/posts/new">
          <Button>
            <PenSquare className="w-4 h-4 mr-1" />
            New Post
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : posts?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>You haven&apos;t written any posts yet.</p>
          <Link href="/posts/new">
            <Button className="mt-4">Write your first post</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts?.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(post.createdAt).toLocaleDateString()}
                      {!post.published && (
                        <Badge variant="outline" className="ml-2">
                          Draft
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/posts/${post.slug}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this post?")) {
                          deleteMutation.mutate({ id: post.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
