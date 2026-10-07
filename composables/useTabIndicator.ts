/**
 * Sliding underline for a row of tabs.
 *
 * Give each tab a ref via `setTabRef(key, el)`, put the container in
 * `containerEl` (it must be `position: relative`), and bind `indicatorStyle`
 * to one absolutely positioned bar with `left-0`. Call `measure(activeKey)`
 * whenever the active tab changes; the bar translates/resizes to it.
 *
 * Uses offsetLeft/offsetWidth (relative to the container) so it is immune to
 * scrollbar or centering shifts between measurement and paint.
 */
export const useTabIndicator = (opts: { pad?: number } = {}) => {
  const pad = opts.pad ?? 0;

  const containerEl = ref<HTMLElement | null>(null);
  const tabEls = new Map<string, HTMLElement>();

  const setTabRef = (key: string, el: any) => {
    const node: HTMLElement | null = el?.$el ?? el ?? null;
    if (node) tabEls.set(key, node);
    else tabEls.delete(key);
  };

  const indicator = ref({ x: 0, w: 0, visible: false });
  const indicatorStyle = computed(() => ({
    transform: `translateX(${indicator.value.x}px)`,
    width: `${indicator.value.w}px`,
    opacity: indicator.value.visible ? 1 : 0,
  }));

  let lastKey: string | null = null;

  const measure = (activeKey: string | null) => {
    lastKey = activeKey;
    const el = activeKey ? tabEls.get(activeKey) : null;
    if (!containerEl.value || !el) {
      indicator.value = { ...indicator.value, visible: false };
      return;
    }
    indicator.value = {
      x: el.offsetLeft + pad,
      w: Math.max(0, el.offsetWidth - pad * 2),
      visible: true,
    };
  };

  const remeasure = () => measure(lastKey);

  onMounted(() => window.addEventListener("resize", remeasure));
  onBeforeUnmount(() => window.removeEventListener("resize", remeasure));

  return { containerEl, setTabRef, indicatorStyle, measure, remeasure };
};
