#!/usr/bin/env bash
# Build the app locally, ship the standalone artifacts to the VM, and (re)start it
# behind nginx. Re-runnable for every update. Run from the repo root:
#   ./deploy/deploy.sh
#
# Prereqs (one-time): deploy/setup-vm.sh has been run on the VM (Node, nginx, user,
# dirs, TLS cert all in place). See docs/hosting-aws.md.
#
# Configure via env (e.g. in a local .env you `source` first — see .env.example):
#   DOMAIN     your domain (must already have a cert on the VM)
#   ALLOW_IPS  space-separated client IPs allowed to reach the app over HTTPS
#   SSH_HOST   the VM's IP / hostname (an Elastic IP is convenient)
#   SSH_USER   ssh user (default: ec2-user)
#   SSH_KEY    path to the ssh private key (default: ~/.ssh/id_ed25519)
set -euo pipefail

# --- config (override via env) ---
DOMAIN="${DOMAIN:?set DOMAIN, e.g. str.example.com}"
# Space-separated allowlist of client IPs that may reach the app over HTTPS.
ALLOW_IPS="${ALLOW_IPS:?set ALLOW_IPS, e.g. \"203.0.113.7\"}"
SSH_HOST="${SSH_HOST:?set SSH_HOST to the VM IP/hostname}"
SSH_USER="${SSH_USER:-ec2-user}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

cd "$REPO_ROOT"

echo "==> Building (next standalone)"
pnpm build

echo "==> Assembling artifact bundle"
# 1) standalone server + its traced node_modules (minus the darwin native addon)
cp -R .next/standalone/. "$STAGE"/
rm -rf "$STAGE"/node_modules/better-sqlite3
# Don't ship any local .env into the bundle — the systemd unit provides the runtime
# env (PORT/HOSTNAME/DATABASE_PATH), and a local .env may hold deploy-only config.
rm -f "$STAGE"/.env "$STAGE"/.env.*
# 2) static assets + public files the standalone server serves relative to itself
mkdir -p "$STAGE"/.next
cp -R .next/static "$STAGE"/.next/static
[ -d public ] && cp -R public "$STAGE"/public
# 3) DB tooling (linux better-sqlite3 source + migrate/seed run via tsx on the VM)
mkdir -p "$STAGE"/.dbtools
cp deploy/migrate/package.json "$STAGE"/.dbtools/package.json
cp -R src/db "$STAGE"/.dbtools/db
cp -R drizzle "$STAGE"/.dbtools/drizzle
# 4) deploy-side files (systemd unit, nginx conf, remote script)
mkdir -p "$STAGE"/.deploy
cp deploy/program-tracker.service deploy/nginx-program-tracker.conf deploy/remote-deploy.sh \
   "$STAGE"/.deploy/

echo "==> Shipping to $SSH_USER@$SSH_HOST:/tmp/pt-release"
rsync -az --delete -e "$SSH" "$STAGE"/ "$SSH_USER@$SSH_HOST":/tmp/pt-release/

echo "==> Running remote deploy"
# shellcheck disable=SC2029
$SSH "$SSH_USER@$SSH_HOST" "sudo bash /tmp/pt-release/.deploy/remote-deploy.sh '$DOMAIN' '$ALLOW_IPS'"

echo "==> Health check via https://$DOMAIN (from this allowlisted network)"
sleep 1
code="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)"
echo "    https://$DOMAIN -> $code"
if [ "$code" = "200" ]; then
  echo "==> Deploy OK"
else
  echo "==> WARNING: expected 200. Check 'journalctl -u program-tracker' on the VM." >&2
  exit 1
fi
