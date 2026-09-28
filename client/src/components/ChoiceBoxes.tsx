import type { ComponentType } from "react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon: ComponentType<{ size?: number }>;
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
        const Icon = opt.icon;
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
            <span className="choice-emoji">
              <Icon size={20} />
            </span>
            <span className="choice-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
