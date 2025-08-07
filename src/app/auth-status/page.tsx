import AuthStatus from "@/components/AuthStatus"

export default function AuthStatusPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Authentication Status</h1>
        <AuthStatus />
      </div>
    </div>
  )
}