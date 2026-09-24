#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install Node.js, then run this launcher again."
  read -r -p "Press Return to close..." _
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing Decision Ledger dependencies..."
  npm ci
fi

web_url="http://127.0.0.1:5173/"
api_url="http://127.0.0.1:8787/api/health"
web_pid=""
api_pid=""

web_ready() {
  curl --silent --fail "$web_url" | grep -q "<title>Decision Ledger"
}

api_ready() {
  curl --silent --fail "$api_url" | grep -q '"model"'
}

cleanup() {
  if [ -n "$web_pid" ]; then kill "$web_pid" 2>/dev/null || true; fi
  if [ -n "$api_pid" ]; then kill "$api_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

if ! web_ready; then
  npm run dev:web &
  web_pid="$!"
fi

if ! api_ready; then
  npm run dev:api &
  api_pid="$!"
fi

for ((attempt=0; attempt<30; attempt++)); do
  if web_ready && api_ready; then
    echo "Decision Ledger is ready at $web_url"
    if [ "${DECISION_LEDGER_NO_OPEN:-0}" != "1" ]; then
      open "$web_url"
    fi
    if [ -n "$web_pid$api_pid" ]; then
      echo "Keep this window open while using Decision Ledger. Press Control-C to stop."
      wait
    fi
    exit 0
  fi
  sleep 1
done

echo "Decision Ledger did not start. Review the server messages above."
read -r -p "Press Return to close..." _
exit 1
