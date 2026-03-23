# ====================
# 阶段1: 构建
# ====================
FROM node:20-alpine AS builder

# 安装 pnpm 和原生模块编译工具（better-sqlite3 需要 python3/make/g++）
RUN npm install -g pnpm && \
    apk add --no-cache python3 make g++

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

# 清理可能残留的构建产物
RUN rm -rf packages/*/dist packages/*/*.tsbuildinfo

# 1) 先构建 shared
RUN pnpm --filter @guandan/shared run build

# 2) 构建 engine：临时移除 references 并指向 shared/dist，避免 Docker 中的 TS6305
RUN node -e "\
  var fs=require('fs'),f='packages/engine/tsconfig.json';\
  var c=JSON.parse(fs.readFileSync(f));\
  delete c.references;\
  c.compilerOptions.paths={'@guandan/shared':['../shared/dist/index.d.ts']};\
  fs.writeFileSync(f,JSON.stringify(c,null,2));" && \
    pnpm --filter @guandan/engine run build

# 3) 构建 server 和 web
RUN pnpm --filter @guandan/server run build && \
    pnpm --filter @guandan/web run build

# ====================
# 阶2: 运行时
# ====================
FROM node:20-alpine AS runtime

# 安装 nginx
RUN apk add --no-cache nginx

WORKDIR /app

# 从 builder 复制 node_modules（包含已编译的 better-sqlite3 原生模块）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/engine/node_modules ./packages/engine/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# 复制 package.json 文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/engine/package.json ./packages/engine/
COPY --from=builder /app/packages/server/package.json ./packages/server/

# 复制编译后的代码
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
