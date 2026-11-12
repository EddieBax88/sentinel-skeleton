import { FIXED } from "../copy/strings";

export interface SwitcherLinkProps {
  /** Validated switcher URL, or null when none is configured. */
  href: string | null;
}

/** Link to the other app. Renders nothing when href is null. */
export function SwitcherLink({ href }: SwitcherLinkProps) {
  if (href === null) return null;
  return (
    <a
      href={href}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {FIXED.switcherLinkText}
    </a>
  );
}

export default SwitcherLink;
