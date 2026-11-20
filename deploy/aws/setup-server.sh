#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 EC2 machine for the RepoLens backend.
# Usage (on the server):   bash setup-server.sh api.example.com   [chat-model]
#   api.example.com = the HTTPS address of the backend, e.g. 13-201-45-6.sslip.io
#   chat-model      = qwen2.5-coder:7b (default, needs >= 8 GB RAM) or qwen2.5-coder:1.5b (4 GB)
set -euo pipefail

API_DOMAIN="${1:?Give the backend domain, e.g. bash setup-server.sh 13-201-45-6.sslip.io}"
CHAT_MODEL="${2:-qwen2.5-coder:7b}"
APP_DIR=/opt/repolens

echo "==> 1/6 System packages + Java 21"
sudo apt-get update -y
sudo apt-get install -y openjdk-21-jre-headless curl gnupg debian-keyring debian-archive-keyring apt-transport-https

echo "==> 2/6 Swap (4 GB) so the AI model never runs the machine out of memory"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> 3/6 Ollama (local AI) + models"
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
sudo systemctl enable --now ollama
sleep 3
ollama pull nomic-embed-text
ollama pull "$CHAT_MODEL"

echo "==> 4/6 Caddy (HTTPS reverse proxy, free certificate from Let's Encrypt)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y caddy
fi
sed "s/API_DOMAIN/${API_DOMAIN}/" "$(dirname "$0")/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> 5/6 App folder + service user"
id repolens >/dev/null 2>&1 || sudo useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin repolens
sudo mkdir -p "$APP_DIR/storage"
if [ ! -f "$APP_DIR/.env" ]; then
  sudo cp "$(dirname "$0")/backend.env.example" "$APP_DIR/.env"
  sudo sed -i "s|^OLLAMA_CHAT_MODEL=.*|OLLAMA_CHAT_MODEL=${CHAT_MODEL}|; s|API_DOMAIN|${API_DOMAIN}|g" "$APP_DIR/.env"
fi
sudo chown -R repolens:repolens "$APP_DIR"
sudo chmod 600 "$APP_DIR/.env"
sudo cp "$(dirname "$0")/repolens.service" /etc/systemd/system/repolens.service
sudo systemctl daemon-reload
sudo systemctl enable repolens

echo "==> 6/6 Done."
echo "Next: fill in $APP_DIR/.env   (sudo nano $APP_DIR/.env)"
echo "      copy the jar to $APP_DIR/app.jar, then: sudo systemctl restart repolens"
