import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";

let adminApp: App | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _rtdb: Database | null = null;

const getAdminApp = (): App => {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
  } else {
    const config = useRuntimeConfig();
    const sa = JSON.parse(
      Buffer.from(config.firebaseServiceAccount as string, "base64").toString("utf8"),
    );
    adminApp = initializeApp({
      credential: cert(sa),
      // Auction bids and live price live in RTDB, so settlement needs it.
      databaseURL: config.public.firebaseDatabaseURL as string,
    });
  }
  return adminApp;
};

export const getAdminFirestore = (): Firestore => {
  if (!_db) _db = getFirestore(getAdminApp());
  return _db;
};

export const getAdminAuth = (): Auth => {
  if (!_auth) _auth = getAuth(getAdminApp());
  return _auth;
};

export const getAdminRtdb = (): Database => {
  if (!_rtdb) _rtdb = getDatabase(getAdminApp());
  return _rtdb;
};
