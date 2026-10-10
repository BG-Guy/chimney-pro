import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const CLOSE_MS = 360;

// An iOS-style sheet: slides up when opened, slides back down when closed, and can be
// pulled down with a finger to dismiss (only while its content is scrolled to the top, so
// it never fights the sheet's own scrolling). `overlay` renders above the sheet, for a
// popup that belongs to it.
export default function BottomSheet({
  open,
  onClose,
  ariaLabel,
  children,
  overlay,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames so the off-screen starting position is painted before sliding up.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!mounted || !sheet || !backdrop) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let armed = false;
    let dragging = false;
    let offset = 0;

    const follow = (px: number) => {
      sheet.style.transition = "none";
      backdrop.style.transition = "none";
      sheet.style.transform = `translateY(${px}px)`;
      backdrop.style.opacity = String(Math.max(0, 1 - px / sheet.offsetHeight));
    };
    const release = (closing: boolean) => {
      sheet.style.transition = "";
      backdrop.style.transition = "";
      sheet.style.transform = closing ? "translateY(100%)" : "";
      backdrop.style.opacity = closing ? "0" : "";
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      armed = sheet.scrollTop <= 0;
      dragging = false;
      offset = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = performance.now();
    };
    const onMove = (e: TouchEvent) => {
      if (!armed) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!dragging) {
        // Scrolling up, or a sideways swipe (e.g. changing months) — leave it alone.
        if (dy < -4 || Math.abs(dx) > Math.abs(dy)) {
          armed = false;
          return;
        }
        if (dy < 8) return;
        dragging = true;
      }
      e.preventDefault();
      offset = Math.max(0, dy - 8);
      follow(offset);
    };
    const onEnd = () => {
      armed = false;
      if (!dragging) return;
      dragging = false;
      const velocity = offset / Math.max(1, performance.now() - startTime);
      const shouldClose = offset > sheet.offsetHeight * 0.25 || velocity > 0.6;
      release(shouldClose);
      if (shouldClose) onCloseRef.current();
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [mounted]);

  if (!mounted) return null;

  // Rendered into the phone frame rather than inside the scrolling page, so touches on
  // the backdrop can't scroll the page behind it.
  const host = document.querySelector(".phone-viewport") ?? document.body;
  return createPortal(
    <div className={`bs-root${shown ? " open" : ""}`}>
      <div ref={backdropRef} className="bs-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="bs-sheet" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <div className="sheet-handle" />
        {children}
      </div>
      {overlay}
    </div>,
    host
  );
}
