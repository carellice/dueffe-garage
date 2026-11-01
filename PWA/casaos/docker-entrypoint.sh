#!/bin/sh
# Garage serves plain HTTP inside the container: phones reach it in HTTPS through Tailscale
# ("tailscale serve" on the server, set up by installa.sh). Certificates of older setups are not used.
set -e
mkdir -p "${DATA_DIR:-/data}"
exec "$@"
