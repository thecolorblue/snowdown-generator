import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// Define proper types for the auth options
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile',
          access_type: 'offline',
          response_type: 'code',
          prompt: 'consent'
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }: { token: { id?: string }; user?: { id: string } }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: { user: { id?: string } }; token: { id?: string } }) {
      if (session.user) {
        session.user.id = token.id
      }
      return session
    }
  },
  pages: {
    signIn: '/api/auth/signin',
    error: '/api/auth/error'
  }
}

// Create the handler for GET and POST requests
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }