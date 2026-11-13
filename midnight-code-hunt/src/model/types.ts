import type { CodeTrailDef, TrailLevel } from "@sentinel/skeleton-core";

export type MethodId = "index" | "toc";
export type NodeLevel = "keyword" | TrailLevel;

/** correct: on a declared valid trail. moved: on the movedFrom (2023) route only. wrong: a decoy. */
export type OptionRole = "correct" | "moved" | "wrong";

type NonEmpty<T> = readonly [T, ...T[]];

type NodeBase = {
  /** Graded value: equals the Core trail step value (or the trail keyword). 1-200 chars. */
  readonly value: string;
  /** Heading number or letter shown with the Short_Description. */
  readonly designator?: string;
  /** Key into the Checked_Names_File of the node's edition. */
  readonly nameKey?: string;
  readonly role: OptionRole;
  /** Founder content: one sentence of 1-300 characters explaining why this pick is right. Only on `correct` Options; never a fork sentence. */
  readonly why?: string;
  /** The next level's options. Absent means the path ends here. */
  readonly next?: NonEmpty<OptionNode>;
};

/** Every Article node, decoys included, carries a required has-Parts marker. */
export type ArticleNode = NodeBase & {
  readonly level: "article";
  readonly hasParts: boolean;
};
export type OtherNode = NodeBase & {
  readonly level: Exclude<NodeLevel, "article">;
  readonly hasParts?: undefined;
};
export type OptionNode = ArticleNode | OtherNode;

/** Root list: all nodes have level "keyword". */
export type OptionTree = NonEmpty<OptionNode>;

/** Display-only table walk; never a graded pick. */
export type TableWalk = {
  readonly column: string; // 1-100 chars after trim
  readonly row: string;
  readonly value: string;
};

export type DrillRecord = {
  /** Built with defineCodeTrail; keeps the Core meaning and limits. */
  readonly def: CodeTrailDef;
  readonly question: string; // 1-500 after trim
  readonly answer: string; // plain paraphrase, 1-500
  readonly citation: string; // 1-200, names an article, section, or table
  readonly founder_checked: boolean;
  readonly index_checked: boolean;
  readonly wrongOptionsReviewed: boolean;
  readonly chapterForkSentence?: string; // exactly one sentence, 1-300
  readonly articleForkSentence?: string;
  readonly tableWalk?: TableWalk;
  readonly trees: { readonly toc: OptionTree; readonly index?: OptionTree };
};

/** Typed identity, like defineCodeTrail. */
export function defineDrill(record: DrillRecord): DrillRecord {
  return record;
}
