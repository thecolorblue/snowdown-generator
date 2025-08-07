"use client"

import { useSession } from "next-auth/react"
import { signIn, signOut } from "next-auth/react"

export default function AuthStatus() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <span className="text-gray-500">Loading...</span>
  }

  if (session) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-gray-700">Welcome, {session.user?.name || session.user?.email}</span>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
    >
      Sign In with Google
    </button>
  )
}