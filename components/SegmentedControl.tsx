import React from "react";

interface Option<T extends string> {
  id: T;
  label: string;
  color?: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  hideLabel?: boolean;
  options: Option<T>[];
  value: T;
  onChange: (val: T) => void;
  disabledIds?: Set<T>;
  onToggleDisable?: (id: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  hideLabel = false,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex items-center gap-2 max-w-full">
      {!hideLabel && label && (
        <span className="text-[10px] md:text-[11px] tracking-[0.09em] uppercase text-[var(--subtext)] mr-[2px] flex-none">
          {label}
        </span>
      )}
      <div className="flex border border-[var(--btn-border)] rounded-lg overflow-hidden max-w-full flex-none">
        {options.map((opt, i) => {
          const isSelected = value === opt.id;
          const hasColor = Boolean(opt.color);

          let bg = "transparent";
          let textColor = "var(--subtext)";

          if (isSelected) {
            if (hasColor) {
              bg = `${opt.color}25`;
              textColor = opt.color!;
            } else {
              bg = "var(--teal-active-bg)";
              textColor = "var(--teal-active-color)";
            }
          }

          return (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
              }}
              style={{
                background: bg,
                color: textColor,
              }}
              className={`dts-seg-btn px-2.5 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] tracking-[0.03em] font-mono cursor-pointer transition-all border-none rounded-none flex items-center gap-1.5 flex-none hover:bg-[var(--btn-hover-bg)] ${
                i < options.length - 1
                  ? "border-r border-r-[var(--btn-border)]"
                  : ""
              }`}
              title={
                hasColor
                  ? isSelected
                    ? `Active Tone (${opt.label})`
                    : `Select tone ${opt.label}`
                  : opt.label
              }
            >
              {hasColor && (
                <span
                  className="w-2 h-2 rounded-full inline-block flex-none"
                  style={{
                    backgroundColor: opt.color,
                    boxShadow: isSelected ? `0 0 6px ${opt.color}` : "none",
                  }}
                />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
