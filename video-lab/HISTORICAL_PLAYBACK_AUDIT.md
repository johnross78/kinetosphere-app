# Historical YouTube Playback Regression Audit — November 13, 2026

## Confirmed source transitions

- **RC4** (`55aa709ab41d`): `@capgo/capacitor-youtube-player@8.2.17` supplied a main WKWebView Referer patch for direct YouTube playback.
- **RC5** (`e624a34139b7`): `@capgo/capacitor-youtube-player@8.3.3` introduced a native iOS YouTube player. The source includes calls such as `setPlayerFrame`, reflecting an attempt at inline native integration.
- **RC6** (`f8cfada96693`): switched plugin to **fullscreen/modal** presentation after the native inline overlay failed to render reliably. Its Codemagic config used **TestFlight build number 5**.
- **RC7** (`20be167f2fe4`): removed the plugin dependency and replaced native playback with an HTTPS YouTube bridge. Its Codemagic config used **TestFlight build number 6**.
- **RC23** (September 28 release notes): explicitly documented “shifted/pillarboxed native landscape rendering” in the hosted YouTube player.
- **October 6** (`3c3e1eec9506`, `f2cc3895f56f`, `661bf5537562`): adjusted bridge sizing, introduced cover behavior, then iframe overscan to counter an already-persistent YouTube gutter.

## What this does and does not prove

It proves a player architecture change took place between RC6 and RC7 and that the gutter was being reported by RC23. It **does not prove** the exact first occurrence or that RC7 alone caused the visual artifact.

The recent isolated native lab found:
- HTTPS bridge, simplified embed, and privacy-enhanced embed all play and show the black band in landscape.
- Embedded controls work in a clean native lab but failed in the full Circuit Player, implicating integration-specific hit testing or layout for that separate problem.
- Native direct YouTube embed returns Error 153 without a suitable client identity.
- YouTube fullscreen removes the black band; recreating the iframe after fullscreen removes it temporarily.

## Fastest historical check (no new build)

If App Store Connect/TestFlight still exposes previous builds, try TestFlight **build 5** (RC6) and then **build 6** (RC7), using the *same iPhone and similar exercise*. Keep in mind RC6 plays video fullscreen/modal, while RC7 plays inline, so the comparison identifies a behavior change, not a perfectly equivalent UI. Record screenshot/short video for each. Reinstall the current lab afterward.

If historical builds are not accessible, create a separate test branch that restores RC6's native-plugin configuration only in a lab app; do not revert the main application or production Cloudflare.

## Next engineering decision

Prioritize restoring responsive landscape controls using a known-good minimal iframe and identifying the extra hit-test layer(s) in the full Player. For the embedded black band, favor a repeatable comparison of the oldest RC7 bridge versus today's hosted bridge on the same device; avoid more ungrounded CSS changes.
