# Native Circuit Player promotion — Build 56 baseline

## Validated on physical iOS devices (user report, November 13, 2026)
- Build 56 launched without the Build 53 root-view crash.
- YouTube playback is properly contained in the existing video card.
- No landscape black band; YouTube playback controls respond.
- Player corners are rounded.
- Movement Details can be opened unobstructed; native video returns when closed.

## Promotion policy
- Source branch: `integration/ios-native-circuit-player-2026-11-13`.
- Promotion target: `development/step9-mobile-sync-2026-11-12` after simulator + TestFlight regression checks.
- Production website, Cloudflare Worker, and Supabase are not modified.
- Only the verified native bridge/controller scripts are transferred; prior standalone native video labs remain preserved in their investigation branches.
- The obsolete Build 51 direct-YouTube A/B patch is no longer invoked by the candidate iOS workflows.
- iOS workflows apply the bridge to the packaged `www/index.html` and the native controller after Capacitor sync; original source remains untouched.

## Must-fix next revision (not silently included in Build 56 promotion)
1. **iPad timer/video independence**: Pause on workout timer currently pauses the YouTube video. Inspect touch target overlays and timer-vs-video event routing.
2. **Final 10-second countdown video stop**: Video playback stops when the timer starts its last-ten-seconds cue. Diagnose audio-session, WebKit, and timer event effects separately.
3. **Movement cards**: Movement names are still not vertically aligned despite the preceding CSS change.
4. **Movement Details close affordance**: Provide a prominent fixed/visible X; close is presently insufficiently discoverable.
5. **Player heading**: Remove redundant `Current Circuit - 3 Rounds` wording but keep explicit progress counters.

## Acceptance criteria before treating iOS as release-ready
- Native video never overlays the timer, header, or modal.
- iPhone portrait + landscape and iPad portrait + landscape retain Build 56 video playback behavior.
- Exercise NEXT/PREV and audio controls correctly synchronize to the current native video.
- Pausing and resuming a timer does **not** pause/resume YouTube video unless explicitly requested.
- Countdown audio does **not** stop or reset YouTube playback.
- Hosted Cloudflare Stream, offline video, and browser-based web playback are unaffected.
