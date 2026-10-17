import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: (import.meta.env["VITE_FIREBASE_API_KEY"] as string) ?? "AIzaSyAPsZn-xdV5jRN0VXY_F4fjsw1tM5IlfhI",
  authDomain: "vj-emma.firebaseapp.com",
  projectId: "vj-emma",
  storageBucket: "vj-emma.firebasestorage.app",
  messagingSenderId: "554543961518",
  appId: "1:554543961518:web:8a5dae337c7499a9bfe43f",
  measurementId: "G-RCM0Q2QC94",
};

let _app: FirebaseApp | undefined;

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Missing VITE_FIREBASE_API_KEY. Add your Firebase Web API key so the app can reach Firebase.",
    );
  }
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export const auth: Auth = new Proxy({} as Auth, {
  get: (_t, p, r) => Reflect.get(getAuth(firebaseApp()), p, r),
});

export const db: Firestore = new Proxy({} as Firestore, {
  get: (_t, p, r) => Reflect.get(getFirestore(firebaseApp()), p, r),
});

export const storage: FirebaseStorage = new Proxy({} as FirebaseStorage, {
  get: (_t, p, r) => Reflect.get(getStorage(firebaseApp()), p, r),
});

/** Analytics is browser-only and optional; never let it break rendering. */
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(firebaseApp());
  } catch {
    /* analytics unavailable */
  }
}

/**
 * Real SDK instances. The Proxy exports above break `instanceof` checks inside
 * the Firestore SDK (`doc()` / `collection()` reject them), so always use these.
 */
export const getDb = (): Firestore => getFirestore(firebaseApp());
export const getFbAuth = (): Auth => getAuth(firebaseApp());
export const getFbStorage = (): FirebaseStorage => getStorage(firebaseApp());
