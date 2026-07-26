"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, PenSquare } from "lucide-react";

export default function PostsList() {
  const trpc = useTRPC();
  const { user } = useAuth();
  const { data, isLoading } = useQuery(
    trpc.posts.list.queryOptions({ page: 1, limit: 20 })
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const posts = data?.posts ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Latest Posts</h1>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No posts yet.</p>
          {user ? (
            <Link href="/posts/new">
              <Button className="mt-4">
                <PenSquare className="w-4 h-4 mr-1" />
                Write a post
              </Button>
            </Link>
          ) : (
            <Link href="/register">
              <Button className="mt-4">Create an account</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/posts/${post.slug}`}>
                      <CardTitle className="hover:underline text-xl">
                        {post.title}
                      </CardTitle>
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">
                      by {post.author.name} &middot;{" "}
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {post.excerpt && (
                  <p className="text-muted-foreground mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                )}
                <Link href={`/posts/${post.slug}`}>
                  <Button variant="ghost" size="sm">
                    Read more
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
