## Angular 14 to 17 Upgrade Assessment

Current app:
- Angular CLI/build-angular `14.2.x`
- Angular core/router/forms/common `14.3.x`
- Angular Material/CDK `14.2.x`
- RxJS `7.5.x`
- TypeScript `4.7.x`

Upgrade goal:
- Move safely from Angular 14 to 17 using stepwise upgrades:
  - 14 -> 15
  - 15 -> 16
  - 16 -> 17

### What Can Break

1. Angular CLI workspace config
- `angular.json` still uses legacy builders:
  - `@angular-devkit/build-angular:tslint`
  - `@angular-devkit/build-angular:protractor`
- These are obsolete in modern Angular and should be removed or replaced.
- Build/test targets may need schema updates during each step.

2. Deprecated tooling still in repo
- `codelyzer`
- `tslint`
- `protractor`
- These are effectively dead in Angular 17 workflows.
- We should plan to remove or quarantine them during upgrade.

3. Legacy polyfills and browser setup
- `main.ts` imports `hammerjs`
- `polyfills.ts` includes:
  - `classlist.js`
  - duplicate `web-animations-js`
  - `zone.js/dist/zone`
- Angular 17 browser/polyfill expectations are different.
- `zone.js/dist/zone` path and extra legacy browser polyfills are likely cleanup points.

4. Bootstrap Material Design + jQuery dependency
- App depends on:
  - `bootstrap-material-design`
  - `jquery`
  - `popper.js`
- These are outside normal Angular Material patterns.
- They may still compile, but they increase runtime risk and bundling friction during upgrade.

5. Old Material Dashboard template structure
- The app is based on Creative Tim Material Dashboard Angular 2.x.
- It has a lot of global styles, overrides, and theme assumptions.
- Upgrading Angular Material/Angular compiler may expose template or style fragility.

6. `::ng-deep` heavy styling
- Repo has many `::ng-deep` selectors.
- These are deprecated and not ideal long-term.
- They may still work, but they are a maintenance risk while upgrading.

7. PerfectScrollbar integration
- `PerfectScrollbar` is initialized manually in admin layout.
- This is not an Angular blocker by itself, but can cause runtime issues after routing or lifecycle changes.

8. TypeScript jumps
- Current TypeScript is `4.7.x`
- Angular 17 expects a newer TypeScript line.
- This can surface stricter template/type issues in existing components.

9. Mixed/legacy config
- `package.json` engine field is ancient:
  - node `6.11.1`
  - npm `3.10.9`
- This is inaccurate now and should be updated.
- Workspace still has older file layout like `src/tsconfig.app.json`.

10. Test and lint pipeline drift
- Current app builds, but test/lint setup is legacy.
- Angular 17 migration may leave tests/lint in a broken or removed state unless intentionally modernized.

### What Looks Good

1. RxJS is already on `7.5.x`
- This reduces migration pain.

2. App is on Ivy-era Angular already
- Not upgrading from View Engine.

3. No `MatLegacy` imports found
- Good sign for Angular Material migration.

4. No `entryComponents` or old `HttpModule` usage found
- Good sign for modern compatibility.

### Recommended Upgrade Order

1. Prep cleanup
- remove duplicate or obsolete config
- fix builder config issues
- update engine metadata
- reduce obvious legacy friction

2. Angular 14 -> 15
- Angular core/cli/material/cdk/compiler/devkit
- run build after each step

3. Angular 15 -> 16
- update TypeScript and zone.js as required
- verify routing and Material components

4. Angular 16 -> 17
- finalize Angular CLI/workspace changes
- remove lingering deprecated setup

### Risk Areas to Watch Closely During Migration

- `angular.json` builders and schema changes
- global theme/style imports
- jQuery/bootstrap-material-design runtime behavior
- navbar/sidebar scroll behaviors
- dialog/table-heavy pages using Angular Material
- dashboard and POS pages due to customization density

### First Upgrade Prep Tasks

1. Create a dedicated upgrade branch
2. Remove or isolate obsolete lint/e2e builders
3. Update package metadata and note actual supported Node version
4. Clean up legacy polyfills enough to keep migration smooth
5. Run a clean Angular 14 baseline build before version bumps

