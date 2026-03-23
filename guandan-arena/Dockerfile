# ====================
# 阶段1: 构建
# ====================
FROM node:20-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制 pnpm 配置和根目录文件
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# 复制所有包的源代码（排除 test-agent）
COPY packages/shared/ packages/shared/
COPY packages/engine/ packages/engine/
COPY packages/server/ packages/server/
COPY packages/web/ packages/web/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 按依赖顺序构建：shared → engine/web → server
RUN pnpm --filter @guandan/shared run build && \
    pnpm --filter @guandan/engine run build && \
    pnpm --filter @guandan/web run build && \
    pnpm --filter @guandan/server run build

# ====================
# 阶段2: 运行时
# ====================
FROM node:20-alpine AS runtime

# 安装 pnpm 和 nginx
RUN npm install -g pnpm && \
    apk add --no-cache nginx

WORKDIR /app

# 复制 pnpm 配置文件
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# 复制各包的 package.json（用于安装生产依赖）
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 从 builder 阶段复制编译后的代码
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/engine/dist packages/engine/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/web/dist packages/web/dist

# 复制 nginx 配置
COPY nginx.conf /app/nginx.conf

# 创建数据目录（SQLite 数据库存储位置）
RUN mkdir -p /app/packages/server/data

# 复制启动脚本并设置可执行权限
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 暴露端口
EXPOSE 80 3000

# 启动服务
CMD ["/app/docker-entrypoint.sh"]
