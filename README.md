# Kinetosphere iOS RC9 — TestFlight 1.0 (8)

Synchronized with web v6.10.17. This iOS-only refinement keeps the working hosted HTTPS YouTube bridge and muscle-map routing from RC8, then adds three native presentation fixes:

- Player video card and right-side information card stretch to the same height on iPad/desktop-width layouts.
- Native iPad shell receives additional top safe-area clearance so the Kinetosphere header does not crowd the iPad/TestFlight window chrome.
- The canonical Kinetosphere orbit app icon is rendered to `resources/icon.png` and explicitly installed into the generated Xcode `AppIcon.appiconset` during Codemagic builds.

TestFlight build number: 8.

Do not deploy this ZIP to Cloudflare. The Cloudflare web baseline remains v6.10.17.


## RC10 build pipeline cleanup
- TestFlight build number is now derived automatically from the latest App Store Connect build and incremented by one.
- Publishing now uploads to App Store Connect without automatically submitting to TestFlight beta review, avoiding unnecessary post-processing failures during internal testing.


## RC12 — Smart Randomizer

Synchronized with web v6.10.18. Builder Smart Randomize now uses canonical identity, canonical-family relationships, movement-family diversity, muscle-load overlap, and provider diversity while preserving current Builder filters as hard constraints. The established hosted-YouTube iOS bridge, muscle-map routing, iPad polish, app icon, and automatic TestFlight build numbering are retained.


## RC13 — Builder UX + Smart Randomizer Preferences
- Synced with web v6.10.19.
- Smart Randomizer defaults: exact duplicate avoidance Maximum, similar movement avoidance High, provider diversity Low, muscle variety Off.
- Smart Randomizer can be disabled for plain random selection.
- Current Circuit drag handles support touch/pointer reordering on iOS.
- Current Circuit is the default circuit name.
- Mobile Builder order: Current Circuit, Saved Circuits, Exercise Library.
- Saved Circuits can collapse on mobile.
- Primary nav order: Build, Programs, Player, Discover, Settings.
- Player navigation and Launch Player use a yellow call-to-action treatment.
- User-facing Builder exercise cards no longer expose canonical metadata and suppress generic General Training labels.

## RC16 — Landscape Player + Prescription Precedence + YouTube Bridge Recovery
- Synced with web v6.10.22.
- Restores the hosted HTTPS YouTube bridge on native iOS to prevent error 153.
- Adds short-landscape iPhone Player geometry.
- Enforces prescription precedence so rep prescriptions do not inherit stale timers.
- Current Circuit/Saved Circuits are primary across desktop, iPad, and iPhone; exercise library is secondary.
- Fixes mobile Current Circuit field overflow and Player prescription/timer overlap.
- Saved Circuits explains when Guest mode prevents account-synced circuits from appearing.
- Smart Randomizer Preferences remain persistent and account-synced.
- Admin Media Health queue reads the new Supabase media_health_issues table.

## RC19 — Native layout regression recovery
- Synced with web v6.10.27.
- Restores native iOS safe-area header clearance across iPhone and iPad.
- Restores full-frame sizing for the hosted HTTPS YouTube bridge.
- Mobile Player tab now prepares the current Builder circuit automatically, matching web/iPad behavior.
- Adds viewport-height-aware iPad landscape Player geometry while keeping the video as the height authority.


RC19: native landscape Player now fits within 100dvh with a compact top navigation, height-authoritative 16:9 media stage, matching info card, and compact horizontal movement strip. Native muscle image API calls route through the deployed Kinetosphere Cloudflare origin.


RC19 reliability notes:
- Builder Choose Exercises picker now uses available viewport height instead of the legacy fixed 540px scroll box.
- Native iOS muscle images no longer depend on a CORS-sensitive /api/muscle-groups fetch; Worker API routes also emit CORS headers.
- Added interim Exercise & Health Disclaimer under Settings > About for later legal review.
- FUTURE: when providers supply licensed raw HLS/MP4 media, add native AirPlay routing / route picker and TV-optimized playback. Do not treat YouTube bridge content as provider-owned AirPlay media.


## RC21 — iOS Player aspect-ratio recovery + provider section collapse
- Native iPad landscape restores strict 16:9 video geometry; the information card matches the video height rather than stretching the row.
- Native iPhone landscape uses a height-aware 16:9 stage with reserved readable width for the information card and movement strip.
- Hosted YouTube bridge iframe is pinned to the full centered media surface.
- Programs / Flows provider sections can be expanded or collapsed; state is remembered for the current app session.
- Web Player geometry remains unchanged.

RC22 / v6.10.28: iPad-only Player header restoration. Native iPad landscape now retains the Kinetosphere logo and normal-size, right-aligned top navigation while iPhone keeps the compact landscape header. Player geometry from RC21 is unchanged.

RC23 / v6.10.29: iPad Player header now uses the exact normal Builder header geometry. Portrait iPhone explicitly releases landscape card-height constraints so prescription and controls remain inside the info card. Hosted YouTube bridge now resizes its internal player on orientation/viewport changes to prevent shifted/pillarboxed native landscape rendering.


RC24 / v6.10.30: Between-round and between-set rest states are now authoritative standalone Player pages on native iOS, preventing the movement Player from leaking underneath on iPad. iPhone landscape now uses a dedicated composition rather than compressed iPad/desktop rules: compact top navigation, strict 16:9 video stage, independent readable control card, normal-flow prescription/controls, horizontal movement strip, and vertical page scrolling only when needed. iPad Player geometry remains frozen apart from the standalone rest-state fix.

## RC25 / v6.10.31 — iPhone Landscape Fit + Startup Cache + Program UX
- Dedicated height-budgeted iPhone landscape Player fit mode: logo restored, nav right-aligned, 16:9 media flush-left, readable info card, contained progress counters, and fully reachable movement ribbon without requiring browser zoom gestures.
- Program/Flow intro playback now exposes Mute/Unmute before movement 1; audio state continues into the workout.
- Provider Expand/Collapse button moved directly beside the provider name.
- Local-first startup: cached exercise library renders before migration/cloud work; signed-in local circuits hydrate immediately after identity is known, while provider/cloud reconciliation continues in the background.
- iPad and iPhone portrait layout rules remain isolated from the iPhone-landscape fit mode.


## RC26 / v6.10.32 — iPhone landscape Player card revamp
- iPhone landscape uses a new 58/42 media/control split.
- Media stays strict 16:9 and is the dominant visual surface.
- Round/movement metrics are locked in normal flow as the control-card footer.
- Movement ribbon is a separate sibling row below the cards and cannot be overlapped by progress metrics.
- iPad and portrait iPhone rules are unchanged.

## RC29 / v6.10.35 — Player reliability + final landscape refinements
- RC27/RC28 remain the visual baseline; RC29 is additive and tightly scoped.
- iPhone portrait Player is intentionally preserved.
- iPhone landscape keeps the RC28 50/50 Muscles Worked / prescription composition, enlarges only the anatomy artwork, overscans the hosted YouTube bridge to eliminate the residual left gutter, and raises the movement cards inside the ribbon so their lower prescription line is no longer clipped.
- iPad landscape anchors Next / Previous / Restart / Round / Movement as a bottom footer cluster, leaving the middle of the card available for the prescription/timer.
- Player prescription text now shrinks only as needed to fit its available box, including long empty-state/help messages.
- Locally launched/randomized circuits are persisted immediately and protected from a background cloud-sync race that could temporarily replace the active Player circuit with an older/empty cloud setting.

## RC30 / v6.10.36 — iPhone landscape YouTube edge cleanup
- RC29 remains the full Player baseline.
- This release changes only the native iPhone-landscape hosted YouTube frame.
- The residual left black gutter is cropped after render while preserving the bridge at the correct 16:9 stage size.
- Portrait iPhone, iPad, Cloudflare-hosted media, offline media, Player controls, anatomy layout, ribbon layout, and circuit-hydration logic are unchanged.

## RC31 / v6.10.37 — sustainable iPhone landscape YouTube lifecycle fix
- RC29 remains the Player/layout baseline and iPad behavior is unchanged.
- Removes reliance on phone-landscape crop/scale compensation as the primary fix.
- Native iPhone landscape recreates the hosted HTTPS YouTube bridge only after the orientation/visual viewport has settled, forcing YouTube to initialize against the final landscape dimensions.
- RC31 CSS then restores the bridge iframe to a clean 100% × 100% fill with no transform.
- The runtime is explicitly excluded from native iPad shells and does not alter portrait iPhone, Cloudflare Stream, offline media, Player controls, anatomy layout, ribbon layout, or circuit-hydration behavior.

## RC32 / v6.10.38 — iPhone landscape safe-area YouTube correction
- RC29 remains the Player/layout baseline; iPad behavior remains unchanged.
- RC31's iPhone rotation/bridge-reload runtime is no longer injected.
- The hosted YouTube frame now uses the actual iOS landscape safe-area insets reported by the device instead of fixed percentage crop/scale values.
- Left and right safe-area insets are handled independently so either landscape orientation is supported.
- Portrait iPhone, iPad, Cloudflare Stream, offline media, Player controls, anatomy layout, ribbon layout, timers, and circuit-hydration behavior are unchanged.

## RC33 / v6.10.39 — first-rotation viewport stabilization
- RC29 remains the Player/layout baseline; iPad behavior remains unchanged.
- Supersedes RC30–RC32 phone-landscape crop/safe-area compensation with a viewport-first fix.
- Native iPhone now forces WKWebView to discard a stale portrait layout viewport during rotation, then waits for visualViewport/window dimensions and scale to stabilize.
- The hosted HTTPS YouTube bridge is recreated only after the final landscape viewport is confirmed, so it initializes against the correct dimensions.
- Hosted YouTube iframe geometry returns to a clean 100% × 100% fill with no percentage crop or safe-area expansion.
- The runtime is explicitly excluded from native iPad shells and does not alter iPhone portrait, Cloudflare Stream, offline media, Player controls, anatomy layout, ribbon layout, timers, or circuit hydration.

## RC34 / v6.10.40 — native iPhone rotation stabilization
- RC29 remains the Player/layout baseline; iPad behavior remains unchanged.
- RC33's web-only viewport stabilization runtime is no longer injected.
- After Capacitor generates/syncs iOS, the build now patches the native shell with an iPhone-only CAPBridgeViewController subclass.
- The native controller waits for UIKit's orientation transition completion, then repeatedly normalizes the WKWebView scroll-view insets and zoom scale while the transition settles.
- The native controller dispatches a rotation-settled event back to the web layer only when the Player is active.
- Hosted YouTube is rebuilt once on that native-settled event, against the final WKWebView geometry.
- Codemagic now verifies that both the custom bridge controller and storyboard wiring exist before compiling.
- iPad is explicitly excluded from the native normalization path. Portrait Player geometry, RC29 controls/anatomy/ribbon, circuit hydration, Cloudflare Stream, and offline media are unchanged.

## RC35 / v6.10.41 — restore stable landscape baseline
- RC29 is restored as the authoritative Player/layout baseline.
- RC30–RC34 phone-landscape crop, safe-area, viewport, and native post-rotation experiments are retired from the build path.
- Postinstall now purges stale RC30–RC33 CSS blocks and removes RC31/RC33/RC34 runtime script tags so they cannot survive from prior iterations.
- The RC34 custom native bridge controller is no longer applied by Codemagic or local iOS setup.
- UIKit/WKWebView is allowed to keep the correct landscape geometry it already reaches immediately after rotation instead of being re-normalized afterward.
- iPad behavior remains unchanged.
- The remaining left black strip is treated as a separate hosted-YouTube bridge-source issue rather than a Player geometry problem.

## RC36 / v6.10.42 — diagnostic-only iPhone rotation build
- No Player geometry changes from the RC29/RC35 stable baseline.
- Adds an iPhone-only on-screen diagnostic overlay showing orientation, innerWidth/innerHeight, visualViewport width/height/scale/offset, document/client sizes, app/player/workout-shell sizes, DPR, screen size, and safe-area insets.
- Captures multiple samples for several seconds after orientation changes so the stale first-landscape state can be compared against the later corrected state.
- iPad is excluded.
- This build is intended to identify the exact stale dimension/scale before any further layout or native changes.

## RC37 / v6.10.43 — iPhone landscape overflow root-cause fix
- RC36 diagnostics identified the bad first-landscape state as horizontal page overflow, not a stale native viewport: the visual viewport was correct at roughly 874×402 / scale 1 while the page/app expanded to roughly 1040px wide.
- WKWebView later auto-scaled that oversized page down, which only appeared to be a delayed viewport correction.
- RC37 removes the RC36 diagnostic overlay.
- iPhone landscape now forces the app/header/Player rows to remain shrinkable and within the true viewport, including border-box sizing for safe-area padding and min-width containment for header navigation and Player children.
- RC29 remains the Player layout baseline; iPad remains unchanged.
- The residual left black strip remains a separate hosted-YouTube bridge issue.

## RC38 / v6.10.44 — circuit state integrity + iPhone landscape info-card reflow
- RC37 remains the frozen iPhone landscape viewport/overflow baseline.
- Clear Circuit now explicitly invalidates the persisted activeCircuit locally and in account cloud settings so a previously cleared circuit cannot resurrect after a hard close/startup sync.
- A short-lived local clear marker protects an explicit clear across any in-flight cloud reconciliation and is removed once deletion is confirmed.
- Preparing/launching a new circuit clears the explicit-clear marker normally.
- iPhone landscape muscle-group copy now wraps within the actual half-card width instead of retaining taller-layout sizing.
- iPhone landscape prescription/timer text is refit after render, resize, visualViewport resize, and orientation changes against the measured prescription cell.
- Rapid muscle artwork is constrained to the shorter landscape card so it cannot force the right-side information card out of proportion.
- iPad remains unchanged.
- RC37 viewport containment remains unchanged.
- The hosted YouTube black-strip investigation remains isolated to the Cloudflare bridge and is not modified by this app RC.

