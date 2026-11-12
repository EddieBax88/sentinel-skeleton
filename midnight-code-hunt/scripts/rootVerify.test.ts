// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// Validates: Requirements 1.5, 1.12
const rootPkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
  workspaces: string[];
  scripts: Record<string, string>;
};

const tempDirs: string[] = [];

function makeWorkspace(appVerify: string): string {
  const dir = mkdtempSync(join(tmpdir(), "root-verify-"));
  tempDirs.push(dir);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "tmp-root",
      private: true,
      workspaces: ["app"],
      scripts: { verify: rootPkg.scripts.verify },
    }),
  );
  mkdirSync(join(dir, "app"));
  writeFileSync(
    join(dir, "app", "package.json"),
    JSON.stringify({
      name: "tmp-app",
      version: "0.0.0",
      private: true,
      scripts: { verify: appVerify },
    }),
  );
  return dir;
}

function runRootVerify(cwd: string) {
  return spawnSync("npm", ["run", "verify"], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, npm_config_offline: "true", npm_config_audit: "false" },
  });
}

afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

describe("root verify propagation", () => {
  it("real root package.json lists midnight-code-hunt and runs workspace verify scripts", () => {
    expect(rootPkg.workspaces).toContain("midnight-code-hunt");
    expect(rootPkg.scripts.verify).toBe("npm run verify --workspaces --if-present");
  });

  it("exits non-zero when a workspace verify script fails", () => {
    const result = runRootVerify(makeWorkspace('node -e "process.exit(1)"'));
    expect(result.status).not.toBe(0);
  }, 70_000);

  it("exits zero when a workspace verify script passes", () => {
    const result = runRootVerify(makeWorkspace('node -e "process.exit(0)"'));
    expect(result.status).toBe(0);
  }, 70_000);
});
