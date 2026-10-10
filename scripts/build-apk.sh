#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=========================================="
echo "🚀 BabaShop Automated APK Build Pipeline"
echo "=========================================="

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/Users/harry/Library/Android/sdk}"
export PATH="/opt/homebrew/bin:${JAVA_HOME}/bin:${PATH}"

echo "📍 Using Java Home: ${JAVA_HOME}"
echo "📍 Using Android SDK: ${ANDROID_HOME}"

# 0. Clean any previous APKs from assets to avoid recursive bundling
rm -f "${ROOT_DIR}/client/babaShop/src/assets/downloads/"*.apk "${ROOT_DIR}/client/babaShop/dist/assets/downloads/"*.apk "${ROOT_DIR}/client/babaShop/android/app/src/main/assets/public/assets/downloads/"*.apk 2>/dev/null || true

# 1. Build Angular Client (production build)
echo ""
echo "📦 Step 1/4: Building Angular production frontend..."
cd "${ROOT_DIR}/client/babaShop"
npm run build:mobile

# 2. Sync Capacitor Android project
echo ""
echo "📱 Step 2/4: Syncing Capacitor assets to Android project..."
npx cap sync android

# 3. Build APK with Gradle
echo ""
echo "🔨 Step 3/4: Building Android APK with Gradle..."
cd "${ROOT_DIR}/client/babaShop/android"
./gradlew clean assembleDebug

# 4. Copy APK to server and client download locations
echo ""
echo "🚚 Step 4/4: Deploying APK to server download destinations..."
APK_SRC="${ROOT_DIR}/client/babaShop/android/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "${APK_SRC}" ]; then
  echo "❌ Error: Built APK not found at ${APK_SRC}"
  exit 1
fi

DEST_PATHS=(
  "${ROOT_DIR}/BabaShop-v2.1.apk"
  "${ROOT_DIR}/BabaShop-latest.apk"
  "${ROOT_DIR}/server/public/downloads/BabaShop-v2.1.apk"
  "${ROOT_DIR}/server/public/downloads/BabaShop-latest.apk"
  "${ROOT_DIR}/server/public/assets/downloads/BabaShop-v2.1.apk"
  "${ROOT_DIR}/server/public/assets/downloads/BabaShop-latest.apk"
  "${ROOT_DIR}/client/babaShop/src/assets/downloads/BabaShop-v2.1.apk"
  "${ROOT_DIR}/client/babaShop/src/assets/downloads/BabaShop-latest.apk"
  "${ROOT_DIR}/client/babaShop/dist/assets/downloads/BabaShop-v2.1.apk"
  "${ROOT_DIR}/client/babaShop/dist/assets/downloads/BabaShop-latest.apk"
)

for dest in "${DEST_PATHS[@]}"; do
  mkdir -p "$(dirname "${dest}")"
  cp -f "${APK_SRC}" "${dest}"
  echo "  ✅ Copied to: ${dest}"
done

APK_SIZE=$(ls -lh "${ROOT_DIR}/BabaShop-v2.1.apk" | awk '{print $5}')
echo ""
echo "=========================================="
echo "🎉 SUCCESS: Latest BabaShop APK generated!"
echo "📦 File Size: ${APK_SIZE}"
echo "📅 Date: $(date)"
echo "📲 Version: v2.1 Latest"
echo "=========================================="
