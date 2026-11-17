# iOS build preparation and native video preservation

Baseline: development commit `2d0185f50d2b0b6cb0e14ffb89efa031732ef64b`,
including merged PR #1. This change does not merge the Option 6.2 design branch.

## Before this change

Both Codemagic workflows installed dependencies using `npm install`, then:

1. Ran `activate-native-circuit-bridge.mjs` against source `www/index.html`.
2. Ran `apply-step10-player-refinements.mjs` against the same file.
3. Ran `cap add ios` if needed, then `cap sync ios` with `webDir: www`.
4. Ran `activate-native-circuit-controller.mjs`, appending Swift to
   `ios/App/App/AppDelegate.swift` and changing Main.storyboard's controller class.
5. Copied the app icon and wrote its asset catalog metadata.
6. Validated the Xcode project and compiled the simulator or signed IPA.

TestFlight additionally set the encryption declaration, queried the latest build
number, incremented it with a minimum of 58, ran `agvtool`, applied provisioning,
and used the existing App Store Connect publishing integration.

`setup-ios.sh` installed dependencies, added/synced iOS, installed the icon, and set
the encryption declaration. It omitted all three active native/refinement scripts.
Plain `npm run cap:sync` also omitted those steps. Local output could therefore
differ materially from Codemagic output.

## Shared procedure now

Use Node 22+ (Codemagic remains pinned to its existing Node v22.11.0) and macOS with
the existing Xcode toolchain for full preparation:

```sh
npm ci --no-audit --no-fund
npm run ios:prepare
```

`npm run ios:prepare` runs the entire `npm test` suite, then:

1. Recreates only `dist/ios-build/` and copies `www/` into its `www/` child.
2. Applies the original bridge and Step 10 scripts there, in their original order.
3. Sets `KINETOSPHERE_IOS_BUILD=1` for its Capacitor subprocesses. The config then
   selects `dist/ios-build/www`; without that flag the default remains `www`.
4. Runs the locally installed, locked Capacitor CLI to add iOS if absent and sync it.
5. Integrates the unchanged controller body into generated AppDelegate.swift and
   selects it in Main.storyboard using the existing mechanism.
6. Installs the same icon/asset metadata and checks that packaged index.html equals
   the prepared HTML.

Both Codemagic workflows and `setup-ios.sh` now use this shared procedure. Signing,
App Store Connect configuration, compilation commands, publishing configuration,
and build-number rules are unchanged. The local wrapper retains its encryption
declaration; CI retains the prior simulator/TestFlight distinction.

For portable generation without installing dependencies or creating an iOS project:

```sh
npm test
npm run ios:prepare:web
```

The web-only command does not run tests itself. Full preparation intentionally
requires macOS and does not compile, sign, or publish. `setup-ios.sh` installs locked
dependencies first and can be invoked with `bash setup-ios.sh`.

### Important local workflow rules

- Use `npm run ios:prepare` after web edits. Plain `cap:sync`, `cap:copy`, or adding
  iOS directly do not perform native preparation and can replace the packaged assets
  with the unprepared default `www/`. Existing generic commands remain for
  compatibility; they are not the supported native-player build procedure.
- `ios/`, `dist/`, and `node_modules/` are generated and ignored at repository root.
  Retain `native/ios/` and test fixtures in version control.
- Repeating shared preparation refreshes staged assets and accepts an already
  integrated, identical controller. Unexpected/stale native integration fails
  clearly; use a clean checkout/generated iOS project after preserving any local
  native work. Never silently overwrite native edits.
- Historical scripts remain available but must not run in addition to shared
  preparation. The preliminary design branch will need a deliberate build-step
  reconciliation later; it has not been integrated here.

## Native source extraction and its deliberate limit

`native/ios/KSNativeCircuitController.swift` is now directly reviewable Swift with
UIKit, WebKit, and Capacitor imports. Its integration body is byte-for-byte identical
to the previous embedded string. The script strips only that import prefix and
appends the same fragment to AppDelegate.swift, which retains its original imports
plus the same WebKit import insertion.

Compiling this as a separate Xcode target source is deferred. That would require
verified file/target membership across Capacitor's generated project variants.
Keeping the established AppDelegate/storyboard mechanism avoids that extra risk.
Do not also add the standalone file to the target: that would duplicate the class.
A later PR can move compilation membership after simulator and device validation.

Preserved contracts include:

- The existing Capacitor root web view and asynchronous installation lifecycle.
- A dedicated second WKWebView, inline playback settings, 16:9 constraints, rounded
  clipping, and one-point frame inset.
- DOM selector `#playerArea .video-wrap`, CSS viewport coordinates, native scaling
  by `web.bounds.width / viewportWidth`, and layout/rotation/scroll observers.
- `ksNativeVideo` channel and `load`, `frame`, `modal`, `stop`, `audio` messages.
  JavaScript's existing `ready` message remains unhandled by Swift.
- Movement Details/Training Notes overlay hiding, exercise synchronization,
  mute/unmute, offline/Stream transitions, and stop lifecycle.
- The HTTPS hosted YouTube bridge, referrer, and existing Step 10 audio changes.

## Automated evidence and baseline maintenance

`tests/ios-build.test.mjs` validates controller/script baseline hashes, generated
HTML equality, generated JavaScript syntax, protocol and selector presence,
repeatable output, source immutability, native fixture generation, safe repeated
integration, and failure on unexpected native inputs. It also checks lockfile/root
dependency agreement and shared local/CI entry points. The 40 prescription tests
remain unchanged.

`tests/fixtures/ios/` contains AppDelegate/Main.storyboard from the locked Capacitor
8.0.0 CLI's `ios-spm-template.tar.gz`. These are transformation fixtures, not a
compiled native application. `ios-build-baseline.json` records hashes obtained from
the original pre-change patch sequence and controller string at the baseline commit.
Intentional future application/bridge changes require reviewing and updating those
hashes against independently generated expected output; do not regenerate them
automatically just to silence a failure.

## Reproducibility limits and remaining risks

The npm v3 lockfile records exact resolved versions and integrity hashes; `npm ci`
rejects manifest drift. All direct dependency versions, including Capacitor 8.0.0,
are unchanged. No frontend framework was added. The first lock resolves historical
transitive ranges today; it cannot reconstruct an undocumented past CI install.
Installation reports a deprecated transitive `tar@6.2.1`; dependency remediation
requires a separate compatibility review rather than an unrequested upgrade.

This improves dependency/source reproducibility, not bit-for-bit IPA reproducibility.
Apple tooling, signing, generated native dependencies, and remote YouTube/Stream
services remain outside the npm lock. The browser still loads floating Supabase and
Stream SDK URLs. The hosted bridge remains a remote compatibility dependency.
Existing bridge readiness, privileged-message, and audio-session risks are unchanged.

## Validation before merge

Automated results for this PR: 45 tests passed on both Node v22.11.0 (the configured
CI version) and v24.22.1, with no failures or skips. Locked `npm ci`, portable web
preparation, installed CLI config loading for both webDir selections, `npm ls`,
build-script/generated inline JavaScript syntax checks, shell syntax, YAML parsing,
and `git diff --check` succeeded. Application `www/` and PR #1's tests are unchanged.

This Linux environment cannot compile UIKit/WebKit/Xcode code. Source equality and
fixture tests are not native validation. Before merge, on macOS:

1. Run `npm ci`, `npm test`, and shared preparation from a clean checkout using the
   pinned CI toolchain; compile the unsigned simulator target without publishing.
2. Repeat preparation and confirm generated files remain consistent, Swift compiles,
   the storyboard resolves the class, the app icon appears, and the app launches.
3. On available development-signed iPhone/iPad devices, verify portrait/landscape,
   video containment/no black band, responsive YouTube controls, NEXT/PREV, mute,
   Movement Details/Training Notes, timer pause/resume and final countdown cues,
   Stream/offline transitions, and background/foreground behavior.

Do not run the TestFlight publishing workflow as a validation shortcut. No workflow
has been triggered, and no deployment or Supabase change is part of this assignment.
