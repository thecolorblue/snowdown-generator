import { auth } from "auth"
import MarkdownEditor from "@/components/MarkdownEditor";
import AuthStatus from "@/components/AuthStatus";
import SDApplicationBar from "@/components/SDApplicationBar";

import { SessionProvider } from "next-auth/react"

interface HomeParameters {
  searchParams: Promise<{ q: string }>;
  pageProps: {
    session: {
      expires: string
    }
  }
}

export default async function Home() {
  const session = await auth()
  if (session?.user) {
    // TODO: Look into https://react.dev/reference/react/experimental_taintObjectReference
    // filter out sensitive data before passing to client.
    session.user = {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    }
  }

  console.log(session);
  return (
    <SessionProvider basePath={"/auth"} session={session}>
      <div className="flex flex-col min-h-screen">
        <SDApplicationBar />
        <main className="flex min-h-screen flex-col items-center p-24">
          <div className="absolute top-4 right-4">
            <AuthStatus />
          </div>
          <MarkdownEditor />
        </main>
      </div>
    </SessionProvider>
  );
}
