"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, PenSquare, LogOut, User } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
  };

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          Blog
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className="px-3 py-1.5 rounded-md hover:bg-accent text-sm">
            Home
          </Link>
          {user && (
            <Link href="/my-posts" className="px-3 py-1.5 rounded-md hover:bg-accent text-sm">
              My Posts
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <Link href="/posts/new">
                <Button size="sm">
                  <PenSquare className="w-4 h-4 mr-1" />
                  New Post
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="sm">
                      <User className="w-4 h-4 mr-1" />
                      {user.name}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile nav */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-2 mt-8">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-md hover:bg-accent text-sm text-left"
                >
                  Home
                </Link>
                {user && (
                  <Link
                    href="/my-posts"
                    onClick={() => setOpen(false)}
                    className="px-3 py-2 rounded-md hover:bg-accent text-sm text-left"
                  >
                    My Posts
                  </Link>
                )}
                {loading ? null : user ? (
                  <>
                    <Link href="/posts/new" onClick={() => setOpen(false)}>
                      <Button className="w-full">
                        <PenSquare className="w-4 h-4 mr-1" />
                        New Post
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <Button variant="ghost" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)}>
                      <Button className="w-full">Register</Button>
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}