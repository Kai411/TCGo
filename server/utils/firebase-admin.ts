import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let _db: Firestore | null = null;

const getAdminApp = (): App => {
  if (!adminApp) {
    const existing = getApps();
    if (existing.length) {
      adminApp = existing[0];
    } else {
      const config = useRuntimeConfig();
      const sa = JSON.parse(
        Buffer.from(config.firebaseServiceAccount as string, "base64").toString("utf8"),
      );
      adminApp = initializeApp({ credential: cert(sa) });
    }
  }
  return adminApp;
};

export const getAdminFirestore = (): Firestore => {
  if (!_db) _db = getFirestore(getAdminApp());
  return _db;
};

export const getAdminAuth = (): Auth => getAuth(getAdminApp());
