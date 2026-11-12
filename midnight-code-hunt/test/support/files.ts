import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

export function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules" && name !== "dist") walkFiles(p, out);
    } else out.push(p);
  }
  return out;
}

/** Non-test files under src/. */
export function sourceFiles(): string[] {
  return walkFiles(join(APP_ROOT, "src")).filter((p) => !TEST_FILE.test(p));
}

export const read = (p: string): string => readFileSync(p, "utf8");
