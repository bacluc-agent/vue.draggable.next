import { readdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(root, "..");
const [tarball] = JSON.parse(
  execFileSync(
    "npm",
    ["pack", packageRoot, "--pack-destination", packageRoot, "--json"],
    { encoding: "utf8" }
  )
);
console.log(`Packed ${tarball.filename}`);
const installEnv = { ...process.env };
delete installEnv.NODE_ENV;

try {
  execFileSync(
    "npm",
    [
      "install",
      "--no-package-lock",
      "--no-save",
      `vuedraggable@file:../${tarball.filename}`,
    ],
    { cwd: root, env: installEnv, stdio: "inherit" }
  );
  execFileSync("npx", ["vite", "build"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  });

  const assets = path.join(root, "dist", "assets");
  const files = await readdir(assets);
  const scripts = files.filter((file) => file.endsWith(".js"));
  const maps = files.filter((file) => file.endsWith(".js.map"));
  if (!scripts.length || !maps.length) {
    throw new Error(`No JavaScript assets and source maps in ${assets}`);
  }
  for (const file of scripts) {
    const content = await readFile(path.join(assets, file), "utf8");
    if (content.includes('new Function("Vue"')) {
      throw new Error(`${file} contains new Function("Vue")`);
    }
  }
  const forbidden = [
    "vue/dist/vue.cjs.prod.js",
    "@vue/compiler-core",
    "@vue/compiler-dom",
  ];
  for (const file of maps) {
    const { sources } = JSON.parse(
      await readFile(path.join(assets, file), "utf8")
    );
    const matches = (sources || []).filter((source) =>
      forbidden.some((entry) => source.includes(entry))
    );
    if (matches.length) {
      throw new Error(`${file} contains forbidden sources: ${matches.join(", ")}`);
    }
  }
  console.log(
    `Verified ${scripts.length} JavaScript assets and ${maps.length} source maps.`
  );
} finally {
  await rm(path.join(packageRoot, tarball.filename), { force: true });
}
