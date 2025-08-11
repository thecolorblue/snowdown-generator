"use client"

import MarkdownEditor from "@/components/MarkdownEditor";
import AuthStatus from "@/components/AuthStatus";
import SDApplicationBar from "@/components/SDApplicationBar";

export default function Home() {
  return (
    <main>
      <SDApplicationBar />
      <MarkdownEditor />
    </main>
  );
}
