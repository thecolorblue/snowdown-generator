import TestAuth from "@/app/api/auth/test-auth"

export default function TestAuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Authentication Test</h1>
        <TestAuth />
      </div>
    </div>
  )
}