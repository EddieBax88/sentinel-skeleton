export type TableValue = {
  readonly value: number;
  /** Non-empty; names the NEC table, e.g. "Table 314.16(A)". */
  readonly source: string;
  /** Founder-audit flag; defaults to false at construction time. */
  readonly nfpa_checked: boolean;
};
