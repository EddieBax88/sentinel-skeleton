/** Decorative bat silhouette. Inline SVG, painted with currentColor, sits behind content. */
export function Bat({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 60"
      className={`pointer-events-none absolute -z-10 h-10 w-20 opacity-30 ${className}`}
    >
      <path
        fill="currentColor"
        d="M60 14l5 8 7-3c6-8 16-12 28-12-6 6-8 12-8 18 4 2 7 5 8 10-6-3-11-3-16 1-4-4-9-4-13 0l-11 18-11-18c-4-4-9-4-13 0-5-4-10-4-16-1 1-5 4-8 8-10 0-6-2-12-8-18 12 0 22 4 28 12l7 3 5-8z"
      />
    </svg>
  );
}
