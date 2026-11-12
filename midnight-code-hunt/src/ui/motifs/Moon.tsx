/** Decorative crescent moon. Inline SVG, painted with currentColor, sits behind content. */
export function Moon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className={`pointer-events-none absolute -z-10 h-24 w-24 opacity-30 ${className}`}
    >
      <path
        fill="currentColor"
        d="M62 8a42 42 0 1 0 30 70A36 36 0 0 1 62 8z"
      />
    </svg>
  );
}
