"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function EditPostForm({ slug }: { slug: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const slugValid = postSlug === "" || SLUG_PATTERN.test(postSlug);

  const { data: myPosts, isLoading: postsLoading } = useQuery(
    trpc.posts.mine.queryOptions()
  );

  const post = myPosts?.find((p) => p.slug === slug);

  const updateMutation = useMutation(
    trpc.posts.update.mutationOptions({
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: trpc.posts.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.posts.bySlug.queryKey() });
        queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
        router.push(`/posts/${updated.slug}`);
      },
      onError: (err) => {
        setError(getErrorMessage(err));
      },
    })
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setPostSlug(post.slug);
      setExcerpt(post.excerpt ?? "");
      setContent(post.content);
    }
  }, [post]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (postsLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse h-96 bg-muted rounded" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Post not found.</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSlugTouched(true);
    setError("");
    if (!postSlug || !SLUG_PATTERN.test(postSlug)) return;
    updateMutation.mutate({
      id: post.id,
      data: {
        title,
        slug: postSlug,
        excerpt: excerpt || undefined,
        content,
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Edit Post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={postSlug}
                onChange={(e) => {
                  setPostSlug(e.target.value);
                  setSlugTouched(true);
                  setError("");
                }}
                onBlur={() => setSlugTouched(true)}
                required
                aria-invalid={slugTouched && !slugValid}
                aria-describedby="slug-hint"
              />
              {slugTouched && !slugValid && (
                <p id="slug-hint" className="text-xs text-destructive">
                  Slug must be URL-friendly — lowercase letters, numbers, and hyphens only (e.g. my-post-title)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt (optional)</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={12}
                className="min-h-50"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending || (slugTouched && !slugValid)}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
