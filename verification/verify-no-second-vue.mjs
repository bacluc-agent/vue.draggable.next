import { rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(root, "..");
const result = JSON.parse(
  execFileSync("npm", ["pack", packageRoot, "--pack-destination", packageRoot, "--json"], {
    encoding: "utf8",
  })
);
const tarball = path.join(packageRoot, result[0].filename);

try {
  const installEnv = { ...process.env };
  delete installEnv.NODE_ENV;
  execFileSync("npm", ["install", "--no-package-lock", "--no-save", `vuedraggable@file:../${result[0].filename}`], {
    cwd: root,
    env: installEnv,
    stdio: "inherit",
  });
  execFileSync("npx", ["vite", "build"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  });
  execFileSync("node", ["assert-no-second-vue.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  await rm(tarball, { force: true });
}
