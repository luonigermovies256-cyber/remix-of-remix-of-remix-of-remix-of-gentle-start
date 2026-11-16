import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

type Ctx = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const FirebaseAuthContext = createContext<Ctx | null>(null);

function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Viewer sign-in isn't set up yet. Please try again later.");
  return auth;
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: Ctx = {
    user,
    loading,
    configured: isFirebaseConfigured,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(requireAuth(), email, password);
    },
    signUp: async (email, password, name) => {
      const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
        setUser({ ...cred.user } as User);
      }
    },
    signInWithGoogle: async () => {
      await signInWithPopup(requireAuth(), new GoogleAuthProvider());
    },
    logout: async () => {
      await signOut(requireAuth());
    },
  };

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth() {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) throw new Error("useFirebaseAuth must be used inside FirebaseAuthProvider");
  return ctx;
}

/** Turns Firebase error codes into plain messages. */
export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email.",
    "auth/popup-closed-by-user": "Google sign-in was closed.",
    "auth/unauthorized-domain": "This website isn't allowed for Google sign-in yet.",
  };
  return map[code] ?? (e instanceof Error ? e.message : "Something went wrong.");
}
