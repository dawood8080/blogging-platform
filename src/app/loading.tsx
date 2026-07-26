export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-40 bg-muted rounded-lg" />
        <div className="h-40 bg-muted rounded-lg" />
        <div className="h-40 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
