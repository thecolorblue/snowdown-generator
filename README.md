# Snowdown

A markdown editor for creating worksheets from markdown, using Next.js and unist, unified, and remark.

Includes additional plugins for:

- Latex formatting
- Tailwind styles
- Embedded lua scripts
- generating text from LLMs
- metadata headers

Check out the examples in `/public`.

## Getting Started

```
npm install
npm start
```

## Google Authentication Setup

To enable Google authentication for this application, follow these steps:

1. **Create a Google Cloud Project:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API

2. **Create OAuth Credentials:**
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application" as the application type
   - Add the following redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Note the Client ID and Client Secret

3. **Set up Environment Variables:**
   Create a `.env.local` file in the project root with:
   ```
   NEXTAUTH_SECRET=your-secure-secret-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Install Required Packages:**
   ```
   npm install next-auth google-auth-library @types/next-auth
   ```

5. **Configure Authentication:**
   - Create the authentication API route at `src/app/api/auth/[...nextauth]/route.ts`
   - Configure Google provider with appropriate scopes

6. **Run the Application:**
   ```
   npm run dev
   ```

The application will now support Google authentication for user login and session management.