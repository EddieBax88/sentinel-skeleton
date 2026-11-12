/** Decorative corner cobweb. Inline SVG, stroked with currentColor, sits behind content. */
export function Cobweb({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className={`pointer-events-none absolute -z-10 h-32 w-32 opacity-25 ${className}`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <path d="M0 0L100 0M0 0L90 40M0 0L65 65M0 0L40 90M0 0L0 100" />
        <path d="M25 0Q22 18 0 25" />
        <path d="M50 0Q44 36 0 50" />
        <path d="M75 0Q66 54 0 75" />
        <path d="M100 0Q88 72 0 100" />
      </g>
    </svg>
  );
}
