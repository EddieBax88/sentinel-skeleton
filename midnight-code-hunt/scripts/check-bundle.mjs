// Bundle scan: fails if fast-check appears anywhere under dist/.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from './check-static.mjs';

/** Scans <rootDir>/dist. Returns the paths of files containing fast-check. */
export function checkBundle(rootDir) {
  return walk(path.join(rootDir, 'dist')).filter((file) =>
    readFileSync(file, 'utf8').includes('fast-check'),
  );
}

/** Runs the check, prints offenders, returns the exit code. */
export function run(rootDir, log = console.error) {
  const offenders = checkBundle(rootDir);
  for (const file of offenders) log(`${file}: fast-check found in bundle`);
  return offenders.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.exit(run(rootDir));
}
