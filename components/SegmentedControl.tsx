import React from "react";

interface Option<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (val: T) => void;
  styles: Record<string, React.CSSProperties>;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  styles,
}: SegmentedControlProps<T>) {
  return (
    <div style={styles.group}>
      <span style={styles.groupLabel}>{label}</span>
      <div style={styles.seg}>
        {options.map((opt, i) => (
          <button
            key={opt.id}
            className="dts-seg-btn"
            onClick={() => onChange(opt.id)}
            style={{
              ...styles.segBtn,
              ...(i < options.length - 1 ? styles.segBtnBorder : {}),
              ...(value === opt.id ? styles.segBtnActiveTeal : {}),
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
