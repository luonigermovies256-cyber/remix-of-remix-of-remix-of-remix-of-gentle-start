# Firebase viewer accounts

Firebase handles sign-in for viewers only. Admin sign-in stays exactly as it is now.

## What viewers get
- **Login page** (/login): email + password, "Continue with Google", and a link to sign up.
- **Sign Up page** (/signup): email, password, confirm password, Google option.
- **Viewer dashboard** (/dashboard): only for signed-in viewers. Anyone else is sent to /login and comes back after signing in. It shows the viewer's name and email.
- **Navbar**: "Sign in" when signed out. When signed in, the viewer's name and a **Logout** button.

## Needed from you
- Your Firebase web config (apiKey, authDomain, projectId, appId). Until you send it, the pages are built but sign-in shows a "not configured" notice.
- In the Firebase console: turn on Email/Password and Google sign-in, and add vjemma.site plus the preview domain as Authorized domains.

## Technical details
- `firebase` is already in package.json, so nothing new gets installed.
- `src/lib/firebase.ts`: initializes the app lazily, on the client only, from `VITE_FIREBASE_*` values (these are public web keys).
- `src/lib/firebase-auth.tsx`: `FirebaseAuthProvider` and the `useFirebaseAuth()` hook (user, loading, signIn, signUp, signInWithGoogle via popup, logout), using `onAuthStateChanged`. It is mounted in `__root.tsx` and kept separate from the existing admin `auth.tsx`.
- New routes: `login.tsx`, `signup.tsx`, `dashboard.tsx`. The dashboard uses `ssr: false` and redirects in the client to `/login?redirect=/dashboard`.
- The Google button follows Google's branding rules (multicolor G, light theme).
- Add the Logout button to the Youku navbar component.
- Give each new page its own title and description.
