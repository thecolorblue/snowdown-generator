import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// Define proper types for the auth options
export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID : (() => { throw new Error('Missing GOOGLE_CLIENT_ID environment variable'); })(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET : (() => { throw new Error('Missing GOOGLE_CLIENT_SECRET environment variable'); })(),
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
  secret: process.env.NEXTAUTH_SECRET
}