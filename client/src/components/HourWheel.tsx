import { useEffect, useRef } from "react";

const ITEM_H = 40;
const VISIBLE = 5;

// An iOS-style scroll wheel: the list snaps one row at a time and whatever sits in the
// middle band is the value. Built on native scroll snapping, so momentum and flicking feel
// like the phone's own picker.
export default function HourWheel<T extends number>({
  values,
  value,
  onChange,
  format,
  ariaLabel,
}: {
  values: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const lastEmitted = useRef(value);

  // Keep the wheel on the current value when it's changed from outside (e.g. the end hour
  // bumped forward because the start moved past it).
  useEffect(() => {
    const el = ref.current;
    if (!el || (lastEmitted.current === value && el.dataset.ready)) return;
    const index = Math.max(0, values.indexOf(value));
    el.scrollTo({ top: index * ITEM_H, behavior: el.dataset.ready ? "smooth" : "auto" });
    el.dataset.ready = "1";
    lastEmitted.current = value;
  }, [value, values]);

  // The bottom sheet starts a pull-to-dismiss on touchstart; a spin of the wheel must not
  // count as one. Native listeners, because the sheet's own listener is native too.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.stopPropagation();
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("touchmove", stop, { passive: true });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function handleScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const index = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      const next = values[index];
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        onChange(next);
      }
    }, 90);
  }

  function step(delta: number) {
    const index = Math.min(values.length - 1, Math.max(0, values.indexOf(value) + delta));
    lastEmitted.current = values[index];
    onChange(values[index]);
    ref.current?.scrollTo({ top: index * ITEM_H, behavior: "smooth" });
  }

  return (
    <div className="wheel" style={{ height: ITEM_H * VISIBLE }}>
      <div className="wheel-band" style={{ height: ITEM_H, top: ITEM_H * Math.floor(VISIBLE / 2) }} />
      <div
        ref={ref}
        className="wheel-scroll"
        role="spinbutton"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuetext={format(value)}
        onScroll={handleScroll}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(-1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            step(1);
          }
        }}
        style={{ paddingBlock: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            tabIndex={-1}
            className={`wheel-item${v === value ? " selected" : ""}`}
            style={{ height: ITEM_H }}
            onClick={() => step(i - values.indexOf(value))}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
