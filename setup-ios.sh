#!/usr/bin/env bash
set -euo pipefail
npm install
if [ ! -d ios ]; then
  npx cap add ios
fi
npx cap sync ios
APPICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$APPICON_DIR"
cp resources/icon.png "$APPICON_DIR/AppIcon-512@2x.png"
cat > "$APPICON_DIR/Contents.json" <<'JSON'
{
  "images" : [
    {
      "filename" : "AppIcon-512@2x.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON
/usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" ios/App/App/Info.plist 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" ios/App/App/Info.plist
printf '\nKinetosphere iOS shell is ready. Open it with: npx cap open ios\n'
