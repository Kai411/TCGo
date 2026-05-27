import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let _db: Firestore | null = null;

export const getAdminFirestore = (): Firestore => {
  if (!_db) {
    const config = useRuntimeConfig();
    const sa = JSON.parse(
      Buffer.from(config.firebaseServiceAccount as string, "base64").toString("utf8"),
    );
    if (!getApps().length) {
      adminApp = initializeApp({ credential: cert(sa) });
    } else {
      adminApp = getApps()[0];
    }
    _db = getFirestore(adminApp);
  }
  return _db;
};
