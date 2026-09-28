# ESM entry for vuedraggable 4.1.0 bundles a second Vue

`vuedraggable@4.1.0` declares `"module": "dist/vuedraggable.umd.js"`. That file
is a UMD bundle, so a bundler that honours `module` and resolves `vue` to a
`require` condition takes its CommonJS branch,
`factory(require("vue"), require("sortablejs"))`, and gets Vue's **full
production CommonJS build** instead of the runtime-only one. The consumer's
output bundle then contains a second, complete Vue plus `@vue/compiler-core` and
`@vue/compiler-dom`, and its source map lists `vue/dist/vue.cjs.prod.js`. The
package has no `exports` map, so a consumer cannot steer bundlers elsewhere from
the package side.

`main` has to stay for UMD/CDN consumers, so a bundler that resolves only `main`
still gets the UMD and still pulls in Vue's full CommonJS build (measured
724,504 B with webpack 4 forced to `mainFields: ["main"]`). Only the
consumer-side alias in remedy 3 helps there.

## Environment

- Package: `vuedraggable@4.1.0`
- Vue: `3.5.x`
- Bundler: Vite 6.4.3 (minimal app) and webpack 5 (control), production mode
- Node.js: 20.x
- Filing target: [SortableJS/Vue.Draggable issues](https://github.com/SortableJS/Vue.Draggable/issues),
  the repository `CONTRIBUTING.md` points at. `mytheresa/vue.draggable.next`,
  which published 4.1.0, is archived and cannot take a new issue.

Reproduced with Vite and webpack 5. webpack 4 does not reproduce it: it ignores
the `exports` map and resolves `vue` through Vue's own `module` field, which is
already runtime-only (234,390 B, no duplicate). Rollup and esbuild were not
measured.

- jsfiddle: to be created by @BacLuc — the source below is paste-ready

`CONTRIBUTING.md` asks for a [jsfiddle](http://jsfiddle.net/) (or similar online
tool) containing a sample demonstrating the bug. This defect has **no runtime
symptom** — nothing misbehaves; it is only observable in a production bundle's
size and in source-map `sources`, which an online editor's preview cannot show.
The minimal source below is paste-ready for such a tool, and the measuring
command runs anywhere in under a minute.

## Reproduction

Minimal app source — paste into an online editor's JS panel, or save as
`src/main.js` of a Vite Vue 3 app:

```js
import { createApp, h } from "vue";
import Draggable from "vuedraggable";

createApp({
  render: () => h(Draggable, { itemKey: "id", modelValue: [{ id: 1 }] }),
}).mount("#app");
```

From the app root, with no configuration beyond the defaults:

```bash
npm i vue@^3.5.0 vuedraggable@4.1.0
npx vite build --sourcemap
cat dist/assets/*.js | wc -c
grep -c 'new Function("Vue"' dist/assets/*.js
# read only each map's JSON "sources" - sourcesContent legitimately mentions @vue/compiler-dom
node -e 'const fs=require("fs"),d="dist/assets",bad=/vue\/dist\/vue\.cjs\.prod\.js|@vue\/compiler-core|@vue\/compiler-dom/;const m=fs.existsSync(d)?fs.readdirSync(d).filter(f=>f.endsWith(".map")):[];if(!m.length)console.log("no source maps in "+d);for(const f of m){const h=(JSON.parse(fs.readFileSync(d+"/"+f,"utf8")).sources||[]).filter(s=>bad.test(s));console.log(f+": "+(h.length?h.join(" "):"clean"))}'
```

A/B toggle with no publish and no rebuild of `vuedraggable` — the 4.1.0 tarball
already ships the ESM source (`files` includes `src/*`), so pointing the
installed package at it is the entire fix:

```bash
node -e 'const f="node_modules/vuedraggable/package.json";const fs=require("fs");const p=JSON.parse(fs.readFileSync(f));p.module="src/vuedraggable.js";fs.writeFileSync(f,JSON.stringify(p,null,2)+"\n")'
npx vite build --sourcemap
cat dist/assets/*.js | wc -c
grep -c 'new Function("Vue"' dist/assets/*.js
# read only each map's JSON "sources" - sourcesContent legitimately mentions @vue/compiler-dom
node -e 'const fs=require("fs"),d="dist/assets",bad=/vue\/dist\/vue\.cjs\.prod\.js|@vue\/compiler-core|@vue\/compiler-dom/;const m=fs.existsSync(d)?fs.readdirSync(d).filter(f=>f.endsWith(".map")):[];if(!m.length)console.log("no source maps in "+d);for(const f of m){const h=(JSON.parse(fs.readFileSync(d+"/"+f,"utf8")).sources||[]).filter(s=>bad.test(s));console.log(f+": "+(h.length?h.join(" "):"clean"))}'
```

## Actual result

The app resolves one `vue` for itself and `vuedraggable` drags a second, full
Vue — template compiler included — into the same output bundle.

## Expected result

`module` resolves to ESM, Vue stays a peer-only external, and the app ships
exactly one Vue with no compiler payload.

## Requested remedies

1. Point `module` at an ESM entry — `src/vuedraggable.js` is already plain ESM —
   while preserving `main` and `types` for UMD/CJS and TypeScript consumers. Do
   not add an `exports` map: consumers deep-import paths such as
   `vuedraggable/src/util/console` and a restrictive map would break them.
2. Give the Vue external an AMD name, and declare the external in this repo
   instead of relying on the framework. `@vue/cli-service`'s lib build
   (`resolveLibConfig`) appends `vue: { commonjs: "vue", commonjs2: "vue",
   root: "Vue" }` to the externals itself — with **no `amd` key** — so
   `dist/vuedraggable.umd.js` declares
   `external {"commonjs":"vue","commonjs2":"vue","root":"Vue"}` while its AMD
   branch reads `define([, "sortablejs"], factory)`. The hole in that array
   makes an AMD loader call the factory with shifted arguments, so Vue is
   undefined and RequireJS consumers of the UMD file get a throw. Declaring
   `vue` in `vue.config.js`'s `NODE_ENV === "production"` externals as
   `{ commonjs: "vue", commonjs2: "vue", amd: "vue", root: "Vue" }` makes the
   external explicit, emits `define(["vue", "sortablejs"], factory)`, and also
   keeps Vue external under `--inline-vue`, which drops the framework's entry.
3. Document the consumer-side alias that avoids the duplicate for consumers
   still on 4.1.0 or older, i.e. any release whose `module` entry is not ESM
   source. The match must be exact, and each bundler spells exactness
   differently — `"^vue$"` is **not** a pattern in either tool; it is a request
   for a module literally named `^vue$` and silently matches nothing:

   ```js
   // vite.config.js — a string find is compared literally, so use a RegExp
   import { defineConfig } from "vite";

   export default defineConfig({
     resolve: {
       alias: [
         { find: /^vue$/, replacement: "vue/dist/vue.runtime.esm-bundler.js" },
       ],
     },
   });
   ```

   ```js
   // webpack.config.js — a trailing $ on the key marks an exact match
   module.exports = {
     resolve: {
       alias: { "vue$": "vue/dist/vue.runtime.esm-bundler.js" },
     },
   };
   ```

   Never alias the bare `vue` request: that also rewrites `vue/compiler-sfc` and
   `vue/jsx-runtime` and breaks the build.

## A/B evidence

These measurements come from the ecamp3 production build in
[ecamp3#10878](https://github.com/ecamp/ecamp3/pull/10878), not from this
repository's verification app.

| Marker                                                  |      Before |       After |
| ------------------------------------------------------- | ----------: | ----------: |
| `vuedraggable.umd-*.js` chunk                           |   179,869 B |    96,995 B |
| `new Function("Vue")` in `dist/assets/*.js`             |           1 |           0 |
| maps whose `sources` contain `vue/dist/vue.cjs.prod.js` |           1 |           0 |
| maps whose `sources` contain `@vue/compiler-core`       |           1 |           0 |
| maps whose `sources` contain `@vue/compiler-dom`        |           1 |           0 |
| Total `dist/assets/*.js`                                | 9,690,308 B | 9,592,331 B |

The build command was `vite build`; `NODE_ENV=production` is Vite's default mode
and makes no byte-level difference. Map checks read only the JSON `sources`
array, never `sourcesContent`. ecamp3's own unit suite was unchanged: **1275
passed | 237 skipped**; this repository's suite is unchanged at 267 tests in 10
suites.

Running the reproduction above in a plain Vite 6 app, with no alias and no
configuration, reproduces the same markers at a much smaller scale. Its only
variable is the `module` toggle from the A/B step — the alias is not involved:

| Marker                                                  |      Before |       After |
| ------------------------------------------------------- | ----------: | ----------: |
| `new Function("Vue")` in `dist/assets/*.js`             |           1 |           0 |
| maps whose `sources` contain `vue/dist/vue.cjs.prod.js` |           1 |           0 |
| maps whose `sources` contain `@vue/compiler-core`       |           1 |           0 |
| maps whose `sources` contain `@vue/compiler-dom`        |           1 |           0 |
| Total `dist/assets/*.js`                                |   313,762 B |   115,999 B |

Those two totals are `cat dist/assets/*.js | wc -c` from that minimal app — the
`src/main.js` snippet above in a fresh Vite 6 Vue 3 project, one output chunk,
no `vite.config.js` — measured with Vue 3.5.43 and Vite 6.4.3. They are not
ecamp3's totals from the table above, and not this repository's `verification/`
app either, which builds the packed tarball through `@vitejs/plugin-vue`.
Absolute totals move with the tool patch versions: the same app on Vite 6.0.5
totals 313,416 B before and 115,994 B after. The marker rows do not move — 1
before and 0 after on every version measured.

## References

- Merged upstream A/B measurement: [ecamp/ecamp3#10878](https://github.com/ecamp/ecamp3/pull/10878)
- BacLuc's write-up of the same A/B in his own fork: [bacluc-agent/ecamp3#48](https://github.com/bacluc-agent/ecamp3/pull/48)
- Archived source repository, which published 4.1.0: [mytheresa/vue.draggable.next](https://github.com/mytheresa/vue.draggable.next)
- [Vue package bundler alias](https://github.com/vuejs/core/blob/main/packages/vue/package.json)
