import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const httpFrameworks = new Set(["fastify", "express", "koa", "hapi"]);
const forbiddenDependencyPrefixes = ["@fastify/", "@nestjs/", "vibly-", "@vibly/"];
const forbiddenProductNames = ["coordinator-api", "vibly-"];
const allowedPublishedConcordPrefix = "@vibly-ai/concord-";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

describe("repo boundary invariants", () => {
  it("keeps concord packages free of HTTP framework dependencies", () => {
    const offenders = packageJsonFiles(join(repoRoot, "packages")).flatMap((file) => {
      const json = readPackageJson(file);
      const deps = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
      return Object.keys(deps)
        .filter((dep) => httpFrameworks.has(dep) || forbiddenDependencyPrefixes.slice(0, 2).some((prefix) => dep.startsWith(prefix)))
        .map((dep) => `${relative(repoRoot, file)}:${dep}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps concord packages from depending on vibly product packages", () => {
    const offenders = packageJsonFiles(repoRoot).flatMap((file) => {
      if (file.includes("/node_modules/")) return [];
      const json = readPackageJson(file);
      const deps = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
      return Object.keys(deps)
        .filter(
          (dep) =>
            dep.startsWith("vibly-") ||
            dep.startsWith("@vibly/") ||
            (dep.startsWith("@vibly-ai/") && !dep.startsWith(allowedPublishedConcordPrefix)),
        )
        .map((dep) => `${relative(repoRoot, file)}:${dep}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps apps as CLI/script demos without HTTP listeners", () => {
    const offenders = sourceFiles(join(repoRoot, "apps"))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return /(server|app|fastify)\.listen\s*\(/.test(text);
      })
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });

  it("keeps package and app names out of product namespaces", () => {
    const offenders = packageJsonFiles(repoRoot).flatMap((file) => {
      if (file.includes("/node_modules/")) return [];
      const json = readPackageJson(file);
      const name = String(json.name ?? "");
      const dir = relative(repoRoot, file).split("/").slice(0, -1).join("/");
      const hasForbiddenName =
        forbiddenProductNames.some((forbidden) => name.includes(forbidden)) && !name.startsWith(allowedPublishedConcordPrefix);
      const hasForbiddenDir = forbiddenProductNames.some((forbidden) => dir.includes(forbidden));
      const hasForbiddenScopedName =
        name.startsWith("@vibly-ai/") && !name.startsWith(allowedPublishedConcordPrefix);
      const hasForbiddenProductName = hasForbiddenName || hasForbiddenDir || hasForbiddenScopedName;
      return hasForbiddenProductName ? [`${relative(repoRoot, file)}:${name}`] : [];
    });

    expect(offenders).toEqual([]);
  });
});

function readPackageJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
}

function packageJsonFiles(root: string): string[] {
  return walk(root).filter((file) => file.endsWith("package.json") && !file.includes("/dist/") && !file.includes("/node_modules/"));
}

function sourceFiles(root: string): string[] {
  return walk(root).filter((file) => /\.(ts|tsx|js|mjs)$/.test(file) && !file.includes("/dist/") && !file.includes("/node_modules/"));
}

function walk(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    if (entry.isDirectory()) files.push(...walk(path));
    if (entry.isFile() && statSync(path).isFile()) files.push(path);
  }
  return files;
}
