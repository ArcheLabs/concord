import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";

const pkgFiles = globSync("packages/*/package.json", { cwd: new URL(".", import.meta.url).pathname });

for (const pkgFile of pkgFiles) {
  const abs = new URL(pkgFile, import.meta.url).pathname;
  const pkg = JSON.parse(readFileSync(abs, "utf8"));

  // Skip packages that already have the dist/ setup
  if (pkg.main && pkg.main === "./dist/index.js") {
    console.log(`[skip]  ${pkg.name} — already patched`);
    continue;
  }

  // Skip packages without exports or with exports already pointing to dist
  if (!pkg.exports) {
    console.log(`[skip]  ${pkg.name} — no exports`);
    continue;
  }

  let changed = false;
  const newExports = {};
  for (const [key, val] of Object.entries(pkg.exports)) {
    if (typeof val === "string" && val.includes("src/index.ts")) {
      newExports[key] = {
        types: val.replace(/src\/index\.ts$/, "dist/index.d.ts"),
        default: val.replace(/src\/index\.ts$/, "dist/index.js"),
      };
      changed = true;
    } else {
      newExports[key] = val;
    }
  }

  if (changed) {
    pkg.main = "./dist/index.js";
    pkg.types = "./dist/index.d.ts";
    pkg.exports = newExports;
    pkg.files = ["dist"];
    writeFileSync(abs, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`[patch] ${pkg.name} — exports rewritten to dist/`);
  } else {
    console.log(`[skip]  ${pkg.name} — exports already correct`);
  }
}
