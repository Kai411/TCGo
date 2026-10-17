// Banners and microsites as the public sees them: read straight from
// Firestore (no sign-in needed), written only from Mint Condition through
// /api/mc/content. See shared/site-content.ts.

import { doc, getDoc } from "firebase/firestore";
import { emptyBanner, type Banner, type BannerPlacement, type Microsite } from "~/shared/site-content";

export const useListingBanner = (placement: BannerPlacement) => {
  // Kept for the session, so coming back to the Shop shows the banner at once
  // instead of popping it in above the grid after a read.
  const banner = useState<Banner | null>(`banner-${placement}`, () => null);
  const load = async () => {
    try {
      const { firestore } = useFirebase();
      const snap = await getDoc(doc(firestore, "banners", placement));
      banner.value = snap.exists() ? { ...emptyBanner(), ...(snap.data() as Banner) } : emptyBanner();
    } catch {
      // Rules not deployed yet, or offline: no banner is the right fallback.
      banner.value ??= emptyBanner();
    }
  };
  return { banner, load };
};

/** A published microsite, or null when there isn't one at that address. */
export const fetchMicrosite = async (slug: string): Promise<Microsite | null> => {
  try {
    const { firestore } = useFirebase();
    const snap = await getDoc(doc(firestore, "microsites", slug));
    if (!snap.exists()) return null;
    const m = snap.data() as Microsite;
    return m.published ? { ...m, slug } : null;
  } catch {
    // The rules deny unpublished pages, which reads as "not found" here.
    return null;
  }
};
