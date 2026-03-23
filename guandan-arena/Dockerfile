FROM node:20-alpine

# 安装 pnpm、nginx 和原生模块编译工具
RUN npm install -g pnpm && \
    apk add --no-cache nginx python3 make g++

WORKDIR /app

# 复制 pnpm 配置和根目录文件
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# 复制所有包的源代码（排除 test-agent）
COPY packages/shared/ packages/shared/
COPY packages/engine/ packages/engine/
COPY packages/server/ packages/server/
COPY packages/web/ packages/web/

# 安装依赖（编译 better-sqlite3 原生模块）
RUN pnpm install --frozen-lockfile

# 验证 better-sqlite3 原生模块已编译成功
RUN ls node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node

# 清理可能残留的构建产物
RUN rm -rf packages/*/dist packages/*/*.tsbuildinfo

# 1) 先构建 shared
RUN pnpm --filter @guandan/shared run build

# 2) 构建 engine：临时移除 references 并指向 shared/dist
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

# 清理编译工具和源代码减小镜像体积
RUN apk del python3 make g++ && \
    rm -rf packages/*/src packages/*/tsconfig* tsconfig.base.json

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
