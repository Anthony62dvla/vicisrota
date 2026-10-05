#!/usr/bin/env bash
# Adds the keys for free app notifications (Web Push) to .env if they are not there yet.
# Made once and then kept: changing them would turn off notifications on everyone's phones.
# Run by install.sh and update.sh; safe to run again.
set -euo pipefail
cd "$(dirname "$0")"
if ! grep -q '^VAPID_PRIVATE_KEY=.' .env; then
  keys=$(docker run --rm node:22-bookworm-slim node -e '
    const { generateKeyPairSync } = require("crypto");
    const jwk = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ format: "jwk" });
    const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
    console.log("VAPID_PUBLIC_KEY=" + pub + "\nVAPID_PRIVATE_KEY=" + jwk.d);
  ')
  sed -i '/^VAPID_PUBLIC_KEY=/d; /^VAPID_PRIVATE_KEY=/d' .env
  printf '# Keys for app notifications, made by ensure-keys.sh. Keep them: new keys turn off notifications on every phone.\n%s\n' "$keys" >> .env
  echo "Added the keys for app notifications to .env"
fi
