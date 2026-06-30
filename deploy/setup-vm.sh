#!/usr/bin/env bash
# One-time VM preparation for the tracker (Amazon Linux 2023, arm64).
# Run from your machine (fill in your host/key):
#   ssh -i ~/.ssh/your_key ec2-user@<vm-ip> 'sudo bash -s' < deploy/setup-vm.sh
# Pass DOMAIN and EMAIL: DOMAIN=str.example.com EMAIL=you@example.com ...
# Idempotent: safe to re-run.
set -euo pipefail

DOMAIN="${DOMAIN:?set DOMAIN to your domain, e.g. str.example.com}"
EMAIL="${EMAIL:?set EMAIL for Let's Encrypt registration}"
APP_USER="apptracker"
APP_DIR="/opt/program-tracker"
DATA_DIR="/var/lib/program-tracker"
WEBROOT="/var/www/certbot"

echo "==> Installing Node.js 20, nginx, and build tools"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
fi
dnf install -y nodejs nginx gcc-c++ make python3 rsync

echo "==> Creating app user and directories"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR" "$WEBROOT"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$DATA_DIR"

echo "==> Installing a minimal :80 nginx server for the ACME challenge"
cat > /etc/nginx/conf.d/program-tracker.conf <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEBROOT}; }
    location / { return 200 'program-tracker: awaiting TLS setup\n'; }
}
NGINX
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> Locating certbot"
CERTBOT="$(command -v certbot || echo /usr/local/bin/certbot)"
if [ ! -x "$CERTBOT" ]; then
  echo "ERROR: certbot not found. Install it (pip per certbot.eff.org) and re-run." >&2
  exit 1
fi

if [ "${SKIP_CERT:-0}" = "1" ]; then
  echo "==> SKIP_CERT=1 — skipping certificate issuance (run again without it once DNS is ready)."
  echo "==> VM prep complete (no cert yet)."
  exit 0
fi

echo "==> Obtaining Let's Encrypt certificate for ${DOMAIN}"
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo "    Certificate already exists — skipping issuance."
else
  "$CERTBOT" certonly --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL" --no-eff-email
fi

echo "==> Setting up certbot auto-renewal (pip-installed certbot has no timer by default)"
cat > /etc/systemd/system/certbot-renew.service <<UNIT
[Unit]
Description=Renew Let's Encrypt certificates
[Service]
Type=oneshot
ExecStart=${CERTBOT} renew --quiet --deploy-hook "systemctl reload nginx"
UNIT
cat > /etc/systemd/system/certbot-renew.timer <<UNIT
[Unit]
Description=Run certbot renew twice daily
[Timer]
OnCalendar=*-*-* 03,15:00:00
RandomizedDelaySec=3600
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now certbot-renew.timer

echo "==> VM setup complete. Run deploy/deploy.sh next."
