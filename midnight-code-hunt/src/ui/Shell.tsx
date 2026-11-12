import { useCallback, useState, type ReactNode } from "react";
import { SWITCHER_URL } from "../config";
import { Footer } from "./Footer";
import { Bat } from "./motifs/Bat";
import { Cobweb } from "./motifs/Cobweb";
import { Moon } from "./motifs/Moon";
import { AnnouncerContext, type Announce } from "./providers";
import { SwitcherLink } from "./SwitcherLink";
import { GAP_CLASS } from "./layout";

export interface ShellProps {
  /** Text of the single <h1> for this screen. */
  title: string;
  children: ReactNode;
}

/**
 * Page frame for every screen: one <h1>, decorative motifs, switcher link,
 * <main> landmark, footer, and the single polite live region. The live
 * region is rendered on first mount, so it exists before any announcement.
 */
export function Shell({ title, children }: ShellProps) {
  const [message, setMessage] = useState("");
  const announce = useCallback<Announce>((next) => setMessage(next), []);

  return (
    <AnnouncerContext.Provider value={announce}>
      <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
        <Cobweb className="left-0 top-0" />
        <Moon className="right-4 top-4" />
        <Bat className="right-24 top-28 md:right-40" />
        <header
          className={`mx-auto flex w-full max-w-3xl flex-col px-4 pt-4 md:flex-row md:items-center md:justify-between ${GAP_CLASS}`}
        >
          <h1 className="text-2xl font-bold text-primary md:text-3xl">{title}</h1>
          <SwitcherLink href={SWITCHER_URL} />
        </header>
        <main className={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 ${GAP_CLASS}`}>
          {children}
        </main>
        <Footer />
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {message}
        </div>
      </div>
    </AnnouncerContext.Provider>
  );
}

export default Shell;
