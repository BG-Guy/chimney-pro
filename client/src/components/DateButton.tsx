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
  return (
    <div className="date-button-wrap">
      <div className="date-button" aria-hidden="true">
        <CalendarIcon size={16} />
        <span>{value ? formatDateShort(value) : placeholder}</span>
      </div>
      <input
        type="date"
        className="date-button-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={placeholder}
      />
    </div>
  );
}
