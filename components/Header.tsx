import React from "react";
import Link from "next/link";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="flex-none flex items-center justify-between px-3 md:px-6 pt-2.5 md:pt-4 pb-1.5 md:pb-2.5 gap-2.5 md:gap-4">
      <Link
        href="/"
        className="text-[22px] md:text-[28px] font-bold tracking-[-0.03em] leading-none flex items-baseline select-none no-underline hover:opacity-90 transition-opacity"
      >
        <span className="font-['Dazed'] text-[var(--text-app)] tracking-tighter">
          dizzy
        </span>
        <b className="font-['Elsie'] italic text-[#f6ab3e] font-extralight tracking-tighter -ml-0.5">
          wave
        </b>
      </Link>
      <div className="flex items-center gap-2.5 md:gap-3.5">
        <div className="text-[8px] md:text-[11px] tracking-[0.06em] uppercase text-[var(--subtext)] whitespace-nowrap ">
          the sound of your imagination
        </div>
        <button
          onClick={onToggleTheme}
          style={{
            borderColor: "var(--btn-border)",
            background: "var(--btn-hover-bg)",
            color: "var(--play-btn-color)",
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full border cursor-pointer transition-all hover:scale-105"
          aria-label="Toggle dark/light theme"
          title={
            theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
          }
        >
          {theme === "dark" ? (
            <svg
              className="w-4.5 h-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f6ab3e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg
              className="w-4.5 h-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f6ab3e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};
