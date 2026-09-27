# ESM entry for vuedraggable 4.1.0 bundles a second Vue

## Environment

- Package: `vuedraggable@4.1.0`
- Vue: `3.5.x`
- Bundler: Vite 6 / Rollup, production mode
- Node.js: 20.x
- Equivalent online Vue 3 reproduction: [Vue 3 vuedraggable example](https://stackblitz.com/edit/vue3-app-zspw1h?file=src/App.vue)

## Reproduction

1. Create a Vue 3 application with Vite.
2. Install `vue@^3.5.0` and `vuedraggable@4.1.0`.
3. Import the default component from `vuedraggable` and build with
   `NODE_ENV=production vite build`.
4. Inspect the generated JavaScript and source maps.

## Actual result

Because `module` points to `dist/vuedraggable.umd.js`, the bundler takes the
UMD/CJS path and resolves `require("vue")` to Vue's full CommonJS production
build. The application contains a second Vue runtime/compiler payload.

## Expected result

The `module` entry should resolve to ESM, and Vue should remain a peer-only
external. The application should contain one runtime Vue and no compiler
payload pulled in by vuedraggable.

## Requested remedies

1. Point `module` at an ESM entry (the existing `src/vuedraggable.js` is plain
   ESM), while preserving `main` for UMD/CJS consumers.
2. Keep Vue external in production library builds, mapping CommonJS,
   CommonJS2, AMD, and browser-global `Vue` forms.
3. Document the exact `^vue$` alias to
   `vue/dist/vue.runtime.esm-bundler.js` as a workaround for releases through
   4.1.0, without rewriting `vue/compiler-sfc` or `vue/jsx-runtime`.

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

The build used `NODE_ENV=production` and the command `vite build`. Map checks
read only the JSON `sources` array, never `sourcesContent`. The unit baseline
was unchanged: **1275 passed | 237 skipped**.

## References

- [Review write-up](https://github.com/bacluc-agent/ecamp3/pull/48)
- [Archived source repository](https://github.com/mytheresa/vue.draggable.next)
- [Vue package bundler alias](https://github.com/vuejs/core/blob/main/packages/vue/package.json)

This is a ready-to-file report. It has not been filed upstream.
