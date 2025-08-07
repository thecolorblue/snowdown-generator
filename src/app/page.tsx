"use client"

import MarkdownEditor from "@/components/MarkdownEditor";
import AuthStatus from "@/components/AuthStatus";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="absolute top-4 right-4">
        <AuthStatus />
      </div>
      <MarkdownEditor />
    </main>
  );
}
