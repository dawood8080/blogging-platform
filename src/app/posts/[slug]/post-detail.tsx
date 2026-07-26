"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Heart, MessageSquare, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/error-utils";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PostDetail({ slug }: { slug: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const bySlugQuery = trpc.posts.bySlug.queryOptions({ slug });

  const { data: post, isLoading } = useQuery(bySlugQuery);
  const { data: comments } = useQuery({
    ...trpc.posts.comments.queryOptions({ postId: post?.id ?? "" }),
    enabled: !!post?.id,
  });

  const [commentError, setCommentError] = useState("");
  const [commentText, setCommentText] = useState("");

  const likeMutation = useMutation(
    trpc.posts.like.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries(bySlugQuery);

        const previousPost = queryClient.getQueryData(bySlugQuery.queryKey);

        queryClient.setQueryData(bySlugQuery.queryKey, (old) => {
          if (!old) return old;
          const wasLiked = old.hasLiked;
          const prevCount = old._count ?? { likes: 0, comments: 0 };
          return {
            ...old,
            hasLiked: !wasLiked,
            _count: {
              ...prevCount,
              likes: prevCount.likes + (wasLiked ? -1 : 1),
            },
          };
        });

        return { previousPost };
      },
      onError: (_err, _vars, context) => {
        if (context?.previousPost) {
          queryClient.setQueryData(bySlugQuery.queryKey, context.previousPost);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries(bySlugQuery);
      },
    })
  );

  const commentMutation = useMutation(
    trpc.posts.createComment.mutationOptions({
      onSuccess: () => {
        setCommentError("");
        setCommentText("");
        queryClient.invalidateQueries(
          trpc.posts.comments.queryOptions({ postId: post?.id ?? "" })
        );
        queryClient.invalidateQueries(bySlugQuery);
      },
      onError: (err) => {
        setCommentError(getErrorMessage(err));
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.posts.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.posts.list.queryKey() });
        queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
        router.push("/");
      },
    })
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Post not found.</p>
        <Link href="/">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to home
          </Button>
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === post.authorId;
  const isLiked = post.hasLiked ?? false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </Link>

      <article>
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">{post.title}</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            by {post.author.name} &middot;{" "}
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
          {isOwner && (
            <div className="flex gap-2 mt-4">
              <Link href={`/posts/${post.slug}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
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
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap">
          {post.content}
        </div>

        <div className="flex items-center gap-4 mt-8">
          {user && (
            <Button
              variant={isLiked ? "default" : "outline"}
              size="sm"
              onClick={() => likeMutation.mutate({ postId: post.id })}
              className={isLiked ? "bg-red-500 hover:bg-red-600 text-white" : ""}
            >
              <Heart
                className={`w-4 h-4 mr-1 ${isLiked ? "fill-current" : ""}`}
              />
              {post._count?.likes ?? 0}
            </Button>
          )}
          {!user && (
            <span className="text-sm text-muted-foreground">
              <Heart className="w-4 h-4 inline mr-1" />
              {post._count?.likes ?? 0} likes
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            <MessageSquare className="w-4 h-4 inline mr-1" />
            {post._count?.comments ?? 0} comments
          </span>
        </div>
      </article>

      <Separator className="my-8" />

      <section>
        <h2 className="text-xl font-semibold mb-4">Comments</h2>

        {user && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCommentError("");
              if (commentText.trim()) {
                commentMutation.mutate({
                  postId: post.id,
                  data: { content: commentText.trim() },
                });
              }
            }}
            className="mb-6 space-y-2"
          >
            {commentError && (
              <p className="text-sm text-destructive" role="alert">
                {commentError}
              </p>
            )}
            <Label htmlFor="comment" className="sr-only">
              Add a comment
            </Label>
            <Textarea
              id="comment"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || commentMutation.isPending}
            >
              {commentMutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </form>
        )}

        {!user && (
          <p className="text-sm text-muted-foreground mb-6">
            <Link href="/login" className="underline">
              Login
            </Link>{" "}
            to leave a comment.
          </p>
        )}

        <div className="space-y-4">
          {comments?.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="pt-4">
                <p className="text-sm font-medium">{comment.author.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-2 text-sm">{comment.content}</p>
              </CardContent>
            </Card>
          ))}
          {comments?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first!
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
