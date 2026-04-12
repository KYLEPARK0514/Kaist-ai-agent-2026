#!/bin/bash
# Azure App Service (Linux) — General settings → Startup Command:
#   bash /home/site/wwwroot/startup.sh
set -euo pipefail
cd /home/site/wwwroot
python -m pip install -q --no-cache-dir -r requirements.txt
exec python kaist-ai-functions/server.py
