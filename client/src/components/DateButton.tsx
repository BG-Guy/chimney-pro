import { useRef } from "react";
import { CalendarIcon } from "./icons";

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DateButton({
  value,
  onChange,
  placeholder = "Select date",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.focus();
    }
  }

  return (
    <div className="date-button-wrap">
      <button type="button" className="date-button" onClick={openPicker}>
        <CalendarIcon size={16} />
        <span>{value ? formatDateShort(value) : placeholder}</span>
      </button>
      <input
        ref={inputRef}
        type="date"
        className="date-button-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
