#!/usr/bin/env bash
# Sets up VicisRota on a fresh Ubuntu server. Run from this folder as root:  ./install.sh
# Safe to run again: it keeps existing secrets and settings.
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then echo "Please run as root (or with sudo)."; exit 1; fi

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if command -v ufw >/dev/null 2>&1; then
  say "Opening the firewall for SSH and the website only..."
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
  ufw --force enable >/dev/null
fi

if [ ! -f .env ]; then
  say "A few questions"
  read -rp "Website address, without www [vicisrota.app]: " DOMAIN
  DOMAIN=${DOMAIN:-vicisrota.app}
  read -rp "Your email, for HTTPS certificate notices: " ACME_EMAIL
  secret() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48; }
  umask 077
  cat > .env <<ENV
# Made by install.sh on $(date -u +%Y-%m-%d). Keep this file private and backed up somewhere safe.
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
POSTGRES_ADMIN_PASSWORD=$(secret)
APP_DB_PASSWORD=$(secret)
BETTER_AUTH_SECRET=$(secret)
CRON_SECRET=$(secret)
# Set once you have a Sentry project, then run ./update.sh
NEXT_PUBLIC_SENTRY_DSN=
ENV
fi

if [ ! -f app.env ]; then
  umask 077
  cp app.env.example app.env
fi

./ensure-keys.sh
mkdir -p backups
. ./.env
say "Building and starting VicisRota (the first build takes a few minutes)..."
docker compose up -d --build
./log-admin-access.sh

say "Waiting for the site to answer..."
for _ in $(seq 1 60); do
  if docker compose exec -T web node -e "fetch('http://localhost:3000/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    say "VicisRota is running at https://$DOMAIN"
    echo "If the page does not load yet, check the DNS records point at this server (see docs/DEPLOY.md)."
    echo "Next: sign up on the site, then make yourself superadmin with:"
    echo "  ./superadmin.sh your@email"
    exit 0
  fi
  sleep 5
done
echo "The site did not start. Send the output of:  docker compose logs --tail=100 web migrate"
exit 1
