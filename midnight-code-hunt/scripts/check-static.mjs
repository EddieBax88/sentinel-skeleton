// Static source scan for the app. Walks src/ (comments included) and reports
// network calls, deep Core imports, test/fixture imports from non-test files,
// and fast-check imports from non-test files.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const NETWORK_WORDS = /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/;
const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** True for *.test.* files (e.g. foo.test.ts, foo.test.tsx). */
export function isTestFile(filePath) {
  return /\.test\.[^./\\]+$/.test(path.basename(filePath));
}

/** Recursively lists files under dir. Returns [] if dir does not exist. */
export function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/** Extracts every import/require specifier in the source text. */
export function extractSpecifiers(text) {
  const specs = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of text.matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}

function isFast(spec) {
  return spec === 'fast-check' || spec.startsWith('fast-check/');
}

function isDeepCore(spec) {
  return spec.includes('skeleton-core/') || spec.includes('packages/skeleton-core');
}

function intoTestOrFixtures(spec, filePath, rootDir) {
  const segments = (p) => p.split(/[\\/]+/);
  let resolved;
  if (spec.startsWith('.')) {
    resolved = path.resolve(path.dirname(filePath), spec);
    const rel = path.relative(rootDir, resolved);
    if (rel.startsWith('..')) return false;
    const parts = segments(rel);
    return parts[0] === 'test' || parts.includes('fixtures');
  }
  // Non-relative specifiers: bare "test/..." or aliased paths such as "@/test/...".
  const parts = segments(spec);
  return parts[0] === 'test' || parts.includes('test') || parts.includes('fixtures');
}

/**
 * Scans <rootDir>/src. Returns [{ file, rules: string[] }] for offending files.
 */
export function checkStatic(rootDir) {
  const srcDir = path.join(rootDir, 'src');
  const results = [];
  for (const file of walk(srcDir)) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    const test = isTestFile(file);
    const rules = [];
    if (NETWORK_WORDS.test(text)) rules.push('network-call');
    const specs = extractSpecifiers(text);
    if (specs.some(isDeepCore)) rules.push('deep-core-import');
    if (!test) {
      if (specs.some((s) => intoTestOrFixtures(s, file, rootDir))) rules.push('test-import');
      if (specs.some(isFast)) rules.push('fast-check-import');
    }
    if (rules.length > 0) results.push({ file, rules });
  }
  return results;
}

/** Runs the check, prints offenders, returns the exit code. */
export function run(rootDir, log = console.error) {
  const offenders = checkStatic(rootDir);
  for (const { file, rules } of offenders) log(`${file}: ${rules.join(', ')}`);
  return offenders.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.exit(run(rootDir));
}
