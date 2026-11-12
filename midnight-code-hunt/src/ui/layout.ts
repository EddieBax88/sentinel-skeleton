/** Shared layout classes: 44 px minimum targets and 8 px gaps (Req 15.4). */
export const TARGET_CLASS = "min-h-[44px] min-w-[44px]";
export const GAP_CLASS = "gap-2";
export const STACK_CLASS = `flex flex-col ${GAP_CLASS}`;
/** Stacks on mobile, reflows to a row from md: upward. */
export const REFLOW_CLASS = `flex flex-col ${GAP_CLASS} md:flex-row md:items-center`;
