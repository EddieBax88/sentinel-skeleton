import { FOOTER_DISCLAIMER } from "../copy/strings";

/** Site footer showing the disclaimer word for word. */
export function Footer() {
  return (
    <footer className="border-t border-surface px-4 py-6 text-center text-sm text-muted">
      <p className="mx-auto max-w-2xl">{FOOTER_DISCLAIMER}</p>
    </footer>
  );
}

export default Footer;
