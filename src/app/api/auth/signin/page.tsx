import { getServerSession } from "next-auth"
import { authOptions } from "../[...nextauth]/route"
import { redirect } from "next/navigation"
import SDApplicationBar from "@/components/SDApplicationBar"

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  
  // If user is already signed in, redirect to home
  if (session) {
    redirect("/")
  }

  return (
    <div className="flex flex-col min-h-screen">
      <SDApplicationBar />
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Sign in to your account
            </h2>
          </div>
          <div className="mt-8">
            <a
              href="/api/auth/signin/google"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in with Google
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}