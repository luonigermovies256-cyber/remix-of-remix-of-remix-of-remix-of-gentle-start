import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { getDb, getFbAuth, initAnalytics } from "@/lib/firebase";

const fbAuth = () => getFbAuth();
const firestore = () => getDb();

/** Sessions survive reloads and tab closes. */
void (typeof window !== "undefined"
  ? setPersistence(getFbAuth(), browserLocalPersistence).catch(() => {})
  : Promise.resolve());

export type Profile = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  last_seen: string;
  created_at: string;
};

/** Kept in the Supabase-ish shape so screens can read `session.user.id`. */
export type Session = { user: { id: string; email: string | null } } | null;

type AuthValue = {
  session: Session;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "");

/** Phone numbers are the credential; Firebase needs an email, so derive a stable one. */
export const phoneToAuthEmail = (phone: string) => `p${digitsOnly(phone)}@vjemma.site`;

export const slugEmailFromName = (name: string) =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "user"}@vjemma.site`;

async function ensureProfile(
  user: User,
  extra?: { name?: string; phone?: string; email?: string },
) {
  const ref = doc(firestore(), "profiles", user.uid);
  const snap = await getDoc(ref);
  const now = new Date().toISOString();
  if (!snap.exists()) {
    await setDoc(ref, {
      id: user.uid,
      name: extra?.name ?? user.displayName ?? "",
      phone: extra?.phone ?? null,
      email: extra?.email ?? user.email ?? null,
      avatar_url: user.photoURL ?? null,
      last_seen: now,
      created_at: now,
    });
  } else {
    await updateDoc(ref, {
      last_seen: now,
      ...(extra?.name ? { name: extra.name } : {}),
      ...(extra?.phone ? { phone: extra.phone } : {}),
      ...(extra?.email ? { email: extra.email } : {}),
      ...(user.photoURL ? { avatar_url: user.photoURL } : {}),
    });
  }
  await ensureRole(user.uid, extra?.email ?? user.email ?? snap.data()?.["email"]);
}

/** Only this account gets the admin console. */
export const ADMIN_EMAIL = "vjemmatruelightstudios@gmail.com";
export const ADMIN_PHONE = "0760734679";

const isAdminEmail = (email: string | null | undefined) =>
  (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;

const isAdminCredential = (email: string | null | undefined) =>
  isAdminEmail(email) || (email ?? "").trim().toLowerCase() === phoneToAuthEmail(ADMIN_PHONE);

async function ensureRole(uid: string, email: string | null | undefined) {
  const roles = await getDocs(collection(firestore(), "user_roles"));
  const existing = roles.docs.find((d) => (d.data() as { user_id?: string }).user_id === uid);
  const role = isAdminCredential(email) ? "admin" : "user";
  if (existing) {
    if ((existing.data() as { role?: string }).role !== role) {
      await updateDoc(existing.ref, { role });
    }
    return;
  }
  const id = crypto.randomUUID();
  await setDoc(doc(firestore(), "user_roles", id), {
    id,
    user_id: uid,
    role,
    created_at: new Date().toISOString(),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string | undefined, email?: string | null) => {
    if (!uid) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    // Admin status from the signed-in credential must never depend on Firestore.
    if (isAdminCredential(email)) setIsAdmin(true);
    try {
      const [p, roles] = await Promise.all([
        getDoc(doc(firestore(), "profiles", uid)),
        getDocs(collection(firestore(), "user_roles")),
      ]);
      const prof = p.exists() ? ({ ...(p.data() as Profile), id: uid }) : null;
      setProfile(prof);
      setIsAdmin(
        isAdminCredential(email) ||
          isAdminEmail(prof?.email) ||
          digitsOnly(prof?.phone ?? "") === ADMIN_PHONE ||
          roles.docs.some((d) => {
            const r = d.data() as { user_id?: string; role?: string };
            return r.user_id === uid && r.role === "admin";
          }),
      );
    } catch (e) {
      console.warn("profile/role lookup failed", e);
    }
  };

  useEffect(() => {
    void initAnalytics();
    return onAuthStateChanged(fbAuth(), async (user) => {
      setSession(user ? { user: { id: user.uid, email: user.email } } : null);
      setIsAdmin(isAdminCredential(user?.email));
      if (user) await ensureProfile(user).catch(() => {});
      await load(user?.uid, user?.email).catch(() => {});
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      isAdmin,
      loading,
      refresh: () => load(session?.user.id, session?.user.email),
      signOut: async () => {
        await fbSignOut(fbAuth());
        setProfile(null);
        setIsAdmin(false);
      },
    }),
    [session, profile, isAdmin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Turn raw Firebase errors into plain language for the UI. */
export function friendlyError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/email-already-in-use": "That phone number already has an account. Sign in instead.",
    "auth/invalid-email": "That phone number is not valid.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/wrong-password": "Wrong phone number or password.",
    "auth/user-not-found": "No account with that phone number yet.",
    "auth/invalid-credential": "Wrong phone number or password.",
    "auth/too-many-requests": "Too many attempts. Try again in a minute.",
    "auth/network-request-failed": "Network problem. Check your connection and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/operation-not-allowed": "This sign-in method is not enabled yet.",
    "auth/unauthorized-domain": "This site is not authorised for sign-in yet.",
    "permission-denied": "Your account was created, but saving your profile was blocked.",
    "unavailable": "Cannot reach the server right now. Try again.",
  };
  if (map[code]) return new Error(map[code]);
  if (/firebase|firestore|first argument|expected .* to be a/i.test(raw)) {
    return new Error("Something went wrong while saving your account. Please try again.");
  }
  return e instanceof Error ? e : new Error(raw);
}

const wrap = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { error: null as Error | null };
  } catch (e) {
    return { error: friendlyError(e) };
  }
};

/** Find the sign-in email registered against a phone number. */
async function emailForPhone(phone: string): Promise<string | null> {
  const wanted = digitsOnly(phone);
  if (!wanted) return null;
  try {
    const snap = await getDocs(collection(firestore(), "profiles"));
    for (const d of snap.docs) {
      const data = d.data() as { phone?: string | null; email?: string | null };
      if (data.phone && digitsOnly(String(data.phone)) === wanted && data.email) {
        return String(data.email).trim().toLowerCase();
      }
    }
  } catch (e) {
    console.warn("phone lookup failed", e);
  }
  return null;
}

/** Accepts a real email, or a phone number registered on a profile. */
export async function signInWithPhone(identifier: string, password: string) {
  const id = identifier.trim();
  if (id.includes("@")) {
    return wrap(() => signInWithEmailAndPassword(fbAuth(), id.toLowerCase(), password));
  }
  const mapped = await emailForPhone(id);
  const candidates = [mapped, phoneToAuthEmail(id)].filter(Boolean) as string[];
  let lastError: unknown = null;
  for (const email of candidates) {
    try {
      await signInWithEmailAndPassword(fbAuth(), email, password);
      return { error: null as Error | null };
    } catch (e) {
      lastError = e;
    }
  }
  return { error: friendlyError(lastError) };
}


export async function registerAccount(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
}) {
  return wrap(async () => {
    const email = input.email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(fbAuth(), email, input.password);
    // Profile writes must never fail the signup itself.
    await ensureProfile(cred.user, {
      name: input.name,
      phone: input.phone,
      email,
    }).catch((e) => console.warn("profile setup skipped", e));
  });
}

export async function signInWithGoogle() {
  try {
    const cred = await signInWithPopup(fbAuth(), new GoogleAuthProvider());
    await ensureProfile(cred.user).catch((e) => console.warn("profile setup skipped", e));
    return { error: null as Error | null, redirected: false };
  } catch (e) {
    return { error: friendlyError(e), redirected: false };
  }
}

/** Used by the post-signup phone step (Google accounts have no number). */
export async function saveProfilePhone(uid: string, phone: string) {
  await setDoc(doc(firestore(), "profiles", uid), { phone }, { merge: true });
}

