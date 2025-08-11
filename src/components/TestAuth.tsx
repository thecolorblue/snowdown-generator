"use client"

import { useSession } from "next-auth/react"
import { signIn, signOut } from "next-auth/react"

export default function TestAuth() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading authentication status...</div>
  }

  if (session) {
    return (
      <div className="p-4 bg-green-100 border border-green-300 rounded">
        <h2 className="text-lg font-semibold">Authenticated</h2>
        <p>User: {session.user?.name || session.user?.email}</p>
        <button 
          onClick={() => signOut()}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
      <h2 className="text-lg font-semibold">Not Authenticated</h2>
      <button 
        onClick={() => signIn("google")}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Sign In with Google
      </button>
    </div>
  )
}