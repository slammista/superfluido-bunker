"use client";

// Decorative SVG HUD overlay — draws itself on mount, inspired by background_main.png
export function CircuitHud({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      {/* Top-left corner bracket */}
      <path
        className="circuit-line"
        style={{ animationDelay: "0ms" }}
        d="M 0 60 L 0 12 Q 0 8 4 8 L 40 8 L 40 2 L 80 2"
      />
      {/* Top-left inner detail */}
      <path
        className="circuit-line"
        style={{ animationDelay: "80ms" }}
        d="M 24 8 L 24 20 Q 24 24 28 24 L 48 24"
      />
      <circle className="circuit-dot" cx="48" cy="24" r="2.5" style={{ animationDelay: "160ms" }} />
      <circle className="circuit-dot" cx="24" cy="8" r="2" style={{ animationDelay: "120ms" }} />

      {/* Horizontal center line */}
      <path
        className="circuit-line"
        style={{ animationDelay: "200ms" }}
        d="M 160 4 L 480 4"
      />
      <circle className="circuit-dot" cx="160" cy="4" r="2" style={{ animationDelay: "280ms" }} />

      {/* Right side bracket */}
      <path
        className="circuit-line"
        style={{ animationDelay: "100ms" }}
        d="M 1440 60 L 1440 12 Q 1440 8 1436 8 L 1380 8 L 1380 2 L 1300 2"
      />
      <path
        className="circuit-line"
        style={{ animationDelay: "180ms" }}
        d="M 1400 8 L 1400 20 Q 1400 24 1396 24 L 1360 24"
      />
      <circle className="circuit-dot" cx="1360" cy="24" r="2.5" style={{ animationDelay: "260ms" }} />
      <circle className="circuit-dot" cx="1440" cy="8" r="2" style={{ animationDelay: "140ms" }} />

      {/* Right horizontal line */}
      <path
        className="circuit-line"
        style={{ animationDelay: "220ms" }}
        d="M 1280 4 L 960 4"
      />
      <circle className="circuit-dot" cx="1280" cy="4" r="2" style={{ animationDelay: "300ms" }} />
    </svg>
  );
}
