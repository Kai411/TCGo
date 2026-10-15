// Put the on-screen keyboard away.
//
// Tapping the keyboard's own search key runs the search and leaves the
// keyboard up, covering the results it just fetched. On a phone that is half
// the screen, so the answer arrives underneath the thing that asked for it.
//
// Nothing dismisses a mobile keyboard except losing focus, so this blurs the
// field. It's the whole trick — but doing it in one place means every search
// box behaves the same way rather than each one remembering separately.

export const useDismissKeyboard = () => {
  /**
   * @param el the field to blur. Falls back to whatever is focused, which
   *        covers handlers that never held a ref to their own input.
   */
  const dismissKeyboard = (el?: HTMLElement | null) => {
    if (!import.meta.client) return;

    const target =
      el ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!target) return;

    // Only blur something a keyboard would be open for. Blurring a button
    // after a click would strip focus from where a keyboard user is, which
    // is a real regression in exchange for nothing.
    const tag = target.tagName;
    const typeable =
      tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    if (!typeable) return;

    target.blur();
  };

  return { dismissKeyboard };
};
