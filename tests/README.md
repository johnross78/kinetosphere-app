# Prescription and timer characterization

Provider-access characterization and the blocked database-validation plan are
documented in [`security/README.md`](../security/README.md). Passing client tests
do not establish database authorization security.

`npm test` also runs the native build-preservation checks described in
[`docs/ios-build-process.md`](../docs/ios-build-process.md). Those checks use only
Node built-ins and do not require dependencies or Xcode to be installed.

Run `npm test` from the repository root using Node.js 22 or newer. No dependency
installation is required. The command uses Node's built-in test runner, assertions,
filesystem API, and VM.

The harness reads the current `www/index.html` and extracts actual function bodies
using explicit, unique neighboring source anchors. Missing/duplicate anchors and
unexpected boundaries fail with descriptive errors. Production functions are not
copied into tests or replaced with simplified implementations. Each case receives
fresh VM state. Only DOM elements and interval cancellation are test doubles; the
real movement inference, defaults, active-item resolution, timer configuration,
timer display, and stop functions execute.

Coverage includes repetitions, per-side movements, seconds/minutes, movement-derived
defaults, stale timer metadata on explicit non-timed defaults, embedded holds/tempo,
AMRAP, EMOM, missing exercises, timer reset state, interval cancellation, and mode
labels. These tests characterize configuration; they do not certify interval
accuracy, countdown audio, browser layout, or native video playback. Build-time
patch scripts are not applied or executed.

Two existing edge cases are recorded as passing characterization tests:

- Stored seconds take precedence over timed prescription text: a `30 sec`
  prescription can retain a 90-second exercise default or 60-second circuit row.
  This can display one duration while configuring another when metadata is stale.
- A hold-style movement name suppresses even an explicit countdown. Standalone
  timed holds therefore need product review alongside intentional embedded-hold
  suppression.

Neither behavior is fixed in this change. If product-approved behavior changes,
update the corresponding expectations deliberately. The extraction harness is a
temporary boundary until production functions can be imported from modules.
