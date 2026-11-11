// Server side of Help Center enquiries. See shared/enquiries.ts.

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { ENQUIRY_MESSAGES_MAX, type Enquiry, type EnquiryMessage } from "~/shared/enquiries";

export const ENQUIRIES = "enquiries";

export const enquiryRef = (db: Firestore, id: string) => {
  const clean = String(id || "").trim();
  if (!clean || clean.includes("/")) throw createError({ statusCode: 400, message: "enquiryId required" });
  return db.collection(ENQUIRIES).doc(clean);
};

/** What the member sees of their own enquiry: no staff-only fields. */
export const toMemberEnquiry = (snap: DocumentSnapshot): Enquiry => {
  const d = snap.data() as any;
  return {
    id: snap.id,
    userUid: d.userUid,
    topic: d.topic,
    orderRef: d.orderRef ?? null,
    status: d.status,
    messages: (d.messages ?? []).map((m: any) => ({ by: m.by, text: m.text, at: m.at })),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    closedAt: d.closedAt ?? null,
  };
};

export const appendEnquiryMessage = (
  messages: EnquiryMessage[] | undefined,
  msg: EnquiryMessage & { staffId?: string; staffName?: string | null },
) => [...(messages ?? []), msg].slice(-ENQUIRY_MESSAGES_MAX);
