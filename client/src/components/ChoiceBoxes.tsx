export interface Choice<T extends string> {
  value: T;
  label: string;
  emoji: string;
}

export default function ChoiceBoxes<T extends string>({
  options,
  value,
  onChange,
  allowDeselect,
  deselectValue,
}: {
  options: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  allowDeselect?: boolean;
  deselectValue?: T;
}) {
  return (
    <div className="choice-boxes">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`choice-box${selected ? " selected" : ""}`}
            onClick={() => {
              if (selected && allowDeselect && deselectValue !== undefined) {
                onChange(deselectValue);
              } else {
                onChange(opt.value);
              }
            }}
          >
            <span className="choice-emoji">{opt.emoji}</span>
            <span className="choice-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
