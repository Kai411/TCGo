/**
 * One full-screen photo viewer for the whole app (components/ImageLightbox.vue,
 * mounted once in app.vue). Pages hand it the photos and the one tapped:
 *
 *   const { openLightbox } = useLightbox();
 *   openLightbox(allImages.value, i);
 *
 * Page zoom is blocked on touch devices (plugins/no-zoom.client.ts), so this
 * is where people pinch to look closely at a card.
 */
export const useLightbox = () => {
  const state = useState("lightbox", () => ({ open: false, images: [] as string[], index: 0 }));

  const openLightbox = (images: string[], index = 0) => {
    const list = images.filter(Boolean);
    if (!list.length) return;
    state.value = { open: true, images: list, index: Math.min(Math.max(index, 0), list.length - 1) };
  };

  const closeLightbox = () => {
    state.value = { ...state.value, open: false };
  };

  return { lightbox: state, openLightbox, closeLightbox };
};
