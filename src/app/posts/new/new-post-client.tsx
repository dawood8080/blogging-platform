"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewPostForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const effectiveSlug = slug || slugify(title);
  const slugValid = SLUG_PATTERN.test(effectiveSlug);

  const createMutation = useMutation(
    trpc.posts.create.mutationOptions({
      onSuccess: (post) => {
        queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
        router.push(`/posts/${post.slug}`);
      },
      onError: (err) => {
        setError(getErrorMessage(err));
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSlugTouched(true);
    setError("");
    if (!SLUG_PATTERN.test(effectiveSlug)) return;
    createMutation.mutate({
      title,
      slug: effectiveSlug,
      excerpt: excerpt || undefined,
      content,
      published: true,
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New Post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slug) setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                  setError("");
                }}
                onBlur={() => setSlugTouched(true)}
                placeholder="auto-generated-from-title"
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
                className="min-h-[200px]"
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
                disabled={createMutation.isPending || !slugValid}
              >
                {createMutation.isPending ? "Creating..." : "Create Post"}
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
