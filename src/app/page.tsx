"use client"

import MarkdownEditor from "@/components/MarkdownEditor";
import AuthStatus from "@/components/AuthStatus";
import SDApplicationBar from "@/components/SDApplicationBar";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <SDApplicationBar />
      <main className="flex min-h-screen flex-col items-center p-24">
        <div className="absolute top-4 right-4">
          <AuthStatus />
        </div>
        <MarkdownEditor />
      </main>
    </div>
  );
}
