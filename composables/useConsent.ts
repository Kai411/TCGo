import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { LEGAL_VERSION } from "~/shared/legal";

/**
 * PDPA consent: record that the signed-in member agreed to TCGo collecting
 * and using their personal data as the Privacy Policy describes.
 *
 * TWO WRITES, ONE BATCH
 * The PDPA Regulations 2013 (reg. 3) want consent recorded and kept, so each
 * acceptance is its own entry in users/{uid}/consents: the version agreed
 * to and a server timestamp. The rules let the member create one and nobody
 * edit or delete it, so the log is append-only. The copy of the version on
 * the profile is only what the onboarding gate reads; the log is the proof.
 * One batch, so the gate can never open without the entry that justifies it.
 */
export type ConsentSource = "signup" | "prompt";

/**
 * Resolves once users/{uid} exists, or after `ms` regardless.
 *
 * useMyProfile creates the profile document when it first sees a new account
 * missing one. The consent batch merges a field into that same document, and
 * landing first would leave a bare document the listener then mistakes for a
 * finished profile, so it never seeds createdAt, trustScore and the rest.
 */
const whenProfileExists = (uid: string, ms = 5000) =>
  new Promise<void>((resolve) => {
    const { firestore } = useFirebase();
    let unsubscribe: (() => void) | null = null;
    const done = () => {
      clearTimeout(timer);
      unsubscribe?.();
      resolve();
    };
    const timer = setTimeout(done, ms);
    unsubscribe = onSnapshot(
      doc(firestore!, "users", uid),
      (snap) => snap.exists() && done(),
      done,
    );
  });

/**
 * Takes the uid rather than reading useAuth(): registration calls this the
 * moment the account exists, before the auth listener has caught up.
 */
export const recordConsentFor = async (uid: string, source: ConsentSource) => {
  const { firestore } = useFirebase();
  if (source === "signup") await whenProfileExists(uid);
  const batch = writeBatch(firestore!);
  batch.set(doc(collection(firestore!, "users", uid, "consents")), {
    version: LEGAL_VERSION,
    acceptedAt: serverTimestamp(),
    source,
  });
  batch.set(doc(firestore!, "users", uid), { consentVersion: LEGAL_VERSION }, { merge: true });
  await batch.commit();
};

export const useConsent = () => {
  const { user } = useAuth();

  const recordConsent = async (source: ConsentSource) => {
    const uid = user.value?.uid;
    if (!uid) throw new Error("Sign in first.");
    await recordConsentFor(uid, source);
  };

  return { recordConsent };
};
