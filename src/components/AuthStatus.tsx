"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export default function AuthStatus() {
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (status === "loading") {
    return <span className="text-gray-500">Loading...</span>
  }

  if (session) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100 transition-colors"
        >
          <span className="text-gray-700 text-sm">
            {session.user?.name || session.user?.email}
          </span>
          {session.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name || "User Avatar"}
              className="w-8 h-8 rounded-full"
            />
          )}
        </button>

        {isMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
            <button
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                console.log("Profile settings clicked")
                setIsMenuOpen(false)
              }}
            >
              Profile settings
            </button>
            <div className="border-t my-1"></div>
            <button
              onClick={() => signOut()}
              className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        )}
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