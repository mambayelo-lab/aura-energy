// Fermeture commune des pop-ups, panneaux et tiroirs : touche Échap, et clic à
// l'extérieur de l'élément `ref` quand il est fourni.
import { useEffect, useRef, type RefObject } from "react";

export function useDismiss(open: boolean, onClose: () => void, ref?: RefObject<HTMLElement | null>): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    const onDown = (e: MouseEvent) => { const el = ref?.current; if (el && e.target instanceof Node && !el.contains(e.target)) close.current(); };
    window.addEventListener("keydown", onKey);
    if (ref) document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open, ref]);
}
