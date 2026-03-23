#!/bin/sh
set -e

echo "Starting Guandan Arena..."

# 启动 nginx（后台）
nginx -c /app/nginx.conf -g 'daemon on;'
echo "Nginx started on port 80"

# 启动 Node.js server（前台，确保容器不退出）
cd /app/packages/server
echo "Starting Node.js server on port 3000..."
exec node dist/main.js
