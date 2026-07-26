import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-8">Page not found.</p>
      <Link href="/">
        <Button variant="ghost">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to home
        </Button>
      </Link>
    </div>
  );
}
