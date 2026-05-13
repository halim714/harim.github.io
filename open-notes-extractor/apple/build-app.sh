#!/bin/bash
# Apple Notes Bridge를 클릭 실행 가능한 .app으로 패키징
# 의존: node (PATH에 존재해야 함)
#
# 생성물: dist/Meki_Notes_Sync.app
# Gatekeeper: 미서명 → 최초 실행 시 우클릭 > 열기 필요
#             (바이럴 성장 후 Apple Developer $99 코드서명으로 전환)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="$SCRIPT_DIR/dist"
APP="$DIST/Meki_Notes_Sync.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "🔨 앱 번들 생성 중..."
rm -rf "$APP"
mkdir -p "$MACOS" "$RESOURCES"

# Info.plist
cat > "$CONTENTS/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>  <string>run</string>
  <key>CFBundleIdentifier</key>  <string>com.meki.notes-sync</string>
  <key>CFBundleName</key>        <string>Meki Notes Sync</string>
  <key>CFBundleVersion</key>     <string>1.0.0</string>
  <key>CFBundleShortVersionString</key> <string>1.0.0</string>
  <key>LSMinimumSystemVersion</key>     <string>12.0</string>
  <key>NSAppleEventsUsageDescription</key>
    <string>Apple Notes를 읽어 Meki로 가져옵니다.</string>
</dict>
</plist>
PLIST

# 실행 스크립트 — node PATH 탐색 포함
cat > "$MACOS/run" << RUNNER
#!/bin/bash
# node 실행 파일 탐색 (nvm, Homebrew, 시스템 경로)
for NODE_PATH in "\$HOME/.nvm/versions/node/\$(ls \$HOME/.nvm/versions/node 2>/dev/null | sort -V | tail -1)/bin/node" \
                 /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [ -x "\$NODE_PATH" ]; then
    exec "\$NODE_PATH" "$(dirname "$MACOS")/Resources/bridge-server.js"
  fi
done
osascript -e 'display alert "Meki Notes Sync" message "Node.js가 설치되어 있지 않습니다.\nhttps://nodejs.org 에서 설치해 주세요." as critical'
exit 1
RUNNER
chmod +x "$MACOS/run"

# 소스 파일 복사
cp "$SCRIPT_DIR/bridge-server.js" "$RESOURCES/"
cp "$SCRIPT_DIR/extract.js" "$RESOURCES/"
cp -r "$SCRIPT_DIR/../shared" "$RESOURCES/shared"

echo "✅ 생성 완료: $APP"
echo ""
echo "⚠️  최초 실행: Gatekeeper 차단 시 우클릭 > 열기 선택"
echo "   또는: xattr -dr com.apple.quarantine \"$APP\""
