import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, onUnmounted } from "vue";

export const REPORT_TYPES = [
  {
    value: "auction_bail",
    label: "Auction Bail (winner didn't pay/collect)",
    penalty: 10,
  },
  {
    value: "scam_seller",
    label: "Scam - Seller took payment, didn't deliver",
    penalty: 25,
  },
  { value: "scam_buyer", label: "Scam - Buyer sent fake payment", penalty: 25 },
  { value: "ghosted_buyer", label: "Buyer ghosted on agreed deal", penalty: 5 },
  {
    value: "ghosted_seller",
    label: "Seller ghosted on agreed deal",
    penalty: 5,
  },
  { value: "other", label: "Other disruptive behaviour", penalty: 5 },
] as const;

export interface Report {
  id: string;
  reporterUid: string;
  reporterName: string;
  reportedUid: string;
  reportedName: string;
  type: string;
  description: string;
  evidenceUrls: string[];
  relatedItemId: string;
  relatedItemType: "card" | "auction" | "";
  status: "pending" | "approved" | "dismissed";
  penalty: number;
  createdAt: number;
  reviewedAt: number | null;
  reviewedBy: string | null;
  adminNote: string;
}

export const useReports = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const submitReport = async (report: {
    reportedUid: string;
    reportedName: string;
    type: string;
    description: string;
    evidenceUrls: string[];
    relatedItemId?: string;
    relatedItemType?: "card" | "auction" | "";
  }) => {
    if (!user.value) throw new Error("Not authenticated");

    const { profile } = useMyProfile();

    await addDoc(collection(firestore!, "reports"), {
      reporterUid: user.value.uid,
      reporterName:
        profile.value?.customName || user.value.displayName || "Anonymous",
      reportedUid: report.reportedUid,
      reportedName: report.reportedName,
      type: report.type,
      description: report.description,
      evidenceUrls: report.evidenceUrls,
      relatedItemId: report.relatedItemId || "",
      relatedItemType: report.relatedItemType || "",
      status: "pending",
      penalty: 0,
      createdAt: Date.now(),
      reviewedAt: null,
      reviewedBy: null,
      adminNote: "",
    });
  };

  return { submitReport };
};

// Admin: list all reports
export const useAdminReports = () => {
  const { firestore } = useFirebase();
  const reports = ref<Report[]>([]);
  const loading = ref(true);

  const q = query(
    collection(firestore!, "reports"),
    orderBy("createdAt", "desc"),
  );

  const unsubscribe: Unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      reports.value = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Report, "id">),
        id: d.id,
      }));
      loading.value = false;
    },
    () => {
      loading.value = false;
    },
  );

  onUnmounted(() => {
    unsubscribe();
  });

  const approveReport = async (
    reportId: string,
    penalty: number,
    adminNote: string,
  ) => {
    const { user } = useAuth();
    if (!user.value) return;

    const report = reports.value.find((r) => r.id === reportId);
    if (!report) return;

    // Update report status
    await updateDoc(doc(firestore!, "reports", reportId), {
      status: "approved",
      penalty,
      reviewedAt: Date.now(),
      reviewedBy: user.value.uid,
      adminNote,
    });

    // Apply penalty to reported user
    const { applyPenalty } = useTrustScore();
    await applyPenalty(report.reportedUid, penalty);
  };

  const dismissReport = async (reportId: string, adminNote: string) => {
    const { user } = useAuth();
    if (!user.value) return;

    await updateDoc(doc(firestore!, "reports", reportId), {
      status: "dismissed",
      reviewedAt: Date.now(),
      reviewedBy: user.value.uid,
      adminNote,
    });
  };

  const pendingReports = computed(() =>
    reports.value.filter((r) => r.status === "pending"),
  );

  const reviewedReports = computed(() =>
    reports.value.filter((r) => r.status !== "pending"),
  );

  return {
    reports,
    loading,
    pendingReports,
    reviewedReports,
    approveReport,
    dismissReport,
  };
};
