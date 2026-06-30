#!/usr/bin/env bash
# Runs ON the VM as root (invoked by deploy/deploy.sh via `sudo bash`).
# Args: <domain> <allow_ips>. allow_ips is a space-separated list of client IPs
# allowed through nginx. Syncs the shipped bundle into place, fixes the native
# module, applies migrations/seed, and (re)starts the service + nginx.
set -euo pipefail

DOMAIN="${1:?domain required}"
ALLOW_IPS="${2:?allow_ips required}"

APP_USER="apptracker"
APP_DIR="/opt/program-tracker"
DATA="/var/lib/program-tracker/app.db"
REL="/tmp/pt-release"

echo "==> Syncing bundle into $APP_DIR"
mkdir -p "$APP_DIR"
# Preserve the heavy/native bits across deploys: the VM's linux better-sqlite3 in the
# app bundle, and the .dbtools install.
rsync -a --delete \
  --exclude 'node_modules/better-sqlite3' \
  --exclude '.dbtools/node_modules' \
  "$REL"/ "$APP_DIR"/
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> Installing DB tooling (linux-arm64 better-sqlite3, drizzle-orm, tsx)"
runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR/.dbtools' && npm install --omit=dev --no-audit --no-fund --silent"

echo "==> Linking better-sqlite3 from the linux .dbtools install"
# Symlink (not copy) so Node resolves the real path under .dbtools/node_modules and
# finds better-sqlite3's sibling deps (bindings, file-uri-to-path) there too.
mkdir -p "$APP_DIR/node_modules"
rm -rf "$APP_DIR/node_modules/better-sqlite3"
ln -sfn ../.dbtools/node_modules/better-sqlite3 "$APP_DIR/node_modules/better-sqlite3"
chown -h "$APP_USER":"$APP_USER" "$APP_DIR/node_modules/better-sqlite3"

echo "==> Applying migrations + seed (as $APP_USER, so the DB file is app-owned)"
runuser -u "$APP_USER" -- env DATABASE_PATH="$DATA" \
  bash -c "cd '$APP_DIR/.dbtools' && ./node_modules/.bin/tsx db/migrate.ts && ./node_modules/.bin/tsx db/seed.ts"

echo "==> Installing systemd unit"
cp "$APP_DIR/.deploy/program-tracker.service" /etc/systemd/system/program-tracker.service
systemctl daemon-reload
systemctl enable program-tracker >/dev/null 2>&1 || true
systemctl restart program-tracker

echo "==> Installing nginx config (allow: $ALLOW_IPS)"
# One `allow <ip>;` directive per allowlisted IP, substituted for __ALLOW_RULES__.
# printf reuses its format for each word; the placeholder line is replaced by
# reading the rules file in (sed `r`) then deleting the placeholder (sed `d`).
ALLOW_FILE="$(mktemp)"
# shellcheck disable=SC2086  # word-splitting of the IP list is intentional
printf '    allow %s;\n' $ALLOW_IPS > "$ALLOW_FILE"
sed -e "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/.deploy/nginx-program-tracker.conf" \
  | sed -e "/__ALLOW_RULES__/r $ALLOW_FILE" -e "/__ALLOW_RULES__/d" \
  > /etc/nginx/conf.d/program-tracker.conf
rm -f "$ALLOW_FILE"
nginx -t
systemctl reload nginx

echo "==> Local health check"
sleep 1
for i in $(seq 1 15); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000/"; then break; fi
  sleep 1
done
code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)"
echo "    127.0.0.1:3000 -> $code"
if [ "$code" != "200" ]; then
  echo "ERROR: app not healthy. Recent logs:" >&2
  journalctl -u program-tracker -n 40 --no-pager >&2 || true
  exit 1
fi
echo "==> Remote deploy complete"
