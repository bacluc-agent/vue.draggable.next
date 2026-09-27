import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(root, "dist", "assets");
const files = await readdir(assets);
const scripts = files.filter((file) => file.endsWith(".js"));
const maps = files.filter((file) => file.endsWith(".js.map"));

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
  const map = JSON.parse(await readFile(path.join(assets, file), "utf8"));
  const matches = (map.sources || []).filter((source) =>
    forbidden.some((entry) => source.includes(entry))
  );
  if (matches.length) {
    throw new Error(
      `${file} contains forbidden sources: ${matches.join(", ")}`
    );
  }
}

console.log(
  `Verified ${scripts.length} JavaScript assets and ${maps.length} source maps.`
);
