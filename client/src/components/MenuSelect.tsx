import { ChevronDownIcon } from "./icons";

// A pill that shows the current choice and opens the phone's own picker when tapped
// (a real <select> sits invisibly on top, so iOS shows its native menu).
export default function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <label className="menu-pill">
      <span>{current}</span>
      <ChevronDownIcon size={15} />
      <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
