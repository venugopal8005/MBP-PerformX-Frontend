import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export const focusableElements = (container) =>
  Array.from(container?.querySelectorAll?.(FOCUSABLE_SELECTOR) || []).filter(
    (element) => element.getAttribute?.("aria-hidden") !== "true"
  );

export const containModalTab = ({ event, container }) => {
  if (event.key !== "Tab") return false;
  const elements = focusableElements(container);
  if (elements.length === 0) {
    event.preventDefault();
    container?.focus?.();
    return true;
  }
  const first = elements[0];
  const last = elements[elements.length - 1];
  const active = container?.ownerDocument?.activeElement || globalThis.document?.activeElement;
  if (!container?.contains?.(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
};

export const modalEscapeAllowed = ({ key, pending }) => key === "Escape" && !pending;

export const focusModalEntry = ({ container, initialFocus }) => {
  const target = initialFocus || focusableElements(container)[0] || container;
  target?.focus?.();
  return target || null;
};

export const restoreModalFocus = (element) => element?.focus?.();

export default function useModalFocusTrap({
  containerRef,
  initialFocusRef,
  pending,
  onClose,
}) {
  useEffect(() => {
    const previousFocus = globalThis.document?.activeElement;
    const container = containerRef.current;
    focusModalEntry({ container, initialFocus: initialFocusRef.current });
    return () => restoreModalFocus(previousFocus);
  }, [containerRef, initialFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (modalEscapeAllowed({ key: event.key, pending })) {
        event.preventDefault();
        onClose();
        return;
      }
      containModalTab({ event, container: containerRef.current });
    };
    globalThis.document?.addEventListener?.("keydown", handleKeyDown);
    return () => globalThis.document?.removeEventListener?.("keydown", handleKeyDown);
  }, [containerRef, onClose, pending]);
}
