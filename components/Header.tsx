import React from "react";

interface HeaderProps {
  styles: Record<string, React.CSSProperties>;
}

export const Header: React.FC<HeaderProps> = ({ styles }) => {
  return (
    <header style={styles.header}>
      <div style={styles.title}>
        draw<b style={styles.titleAccent}>wave</b>
      </div>
      <div style={styles.tagline}>geometry becomes music</div>
    </header>
  );
};
