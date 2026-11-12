# Kinetosphere Step 9.0 - Native Source Sync Candidate

- Copied the **Step 8.4** web application into Capacitor `www/`, replacing outdated RC39-era web artifacts.
- Preserved Capacitor iOS, Codemagic signing, native resources and existing build scripts as a starting point.
- Removed automatic `postinstall` execution of `scripts/apply-player-layout.mjs`. That legacy RC38 script rewrote `index.html` and `mobile-shell.css` during every `npm install`, risking reversion of Step 8.4 and layout patches. Script retained as an explicit `npm run legacy:apply-rc38-layout` command ONLY (do not run in regular builds).
- Source files have undergone ZIP integrity and inline JavaScript syntax checks; NOT yet compiled in Xcode or tested on physical devices.
- No changes made to GitHub, Cloudflare production, Supabase or Codemagic.

## Before first TestFlight
1. Commit the package to a dedicated sync branch; do not silently overwrite main.
2. Build `ios-simulator` on Codemagic, then internal `ios-testflight` after simulator checks pass.
3. Inspect the actual iPhone landscape player; desktop/browser responsive emulation is not sufficient.
4. Make the same `www/` source the basis of the Android Capacitor project (Android toolchain not yet configured here).
