# 🎮 掼蛋竞技场 (Guandan Arena)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0-339933?logo=node.js)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-Private-red)]()

一个功能完整的在线掼蛋游戏平台，支持多人实时对战、观战模式和完整的游戏规则引擎。

## ✨ 功能特性

- 🎯 **完整游戏规则** - 支持标准掼蛋规则，包括万能牌、牌型识别、升级计分等
- 👥 **多人对战** - 支持四人实时联机对战
- 👀 **观战系统** - WebSocket 实时观战，支持多人同时观看
- 📊 **排行榜** - 玩家数据统计和排名系统
- 🎨 **现代化 UI** - 基于 Ant Design 的美观界面，支持亮色/暗色主题
- 💾 **数据持久化** - SQLite 数据库存储游戏记录和玩家数据
- 🧪 **完善测试** - 使用 Vitest 进行单元测试

## 🏗️ 项目架构

本项目采用 **Monorepo** 架构，使用 pnpm workspace 管理多个子包：

```
guandan-arena/
├── packages/
│   ├── engine/        # 🎲 游戏核心引擎
│   │   ├── combo-detector.ts    # 牌型识别
│   │   ├── combo-comparator.ts  # 牌型比较
│   │   ├── validator.ts         # 出牌校验
│   │   ├── scoring.ts           # 计分系统
│   │   └── game.ts              # 游戏流程管理
│   │
│   ├── server/        # 🔌 后端服务
│   │   ├── app.ts               # Express 应用
│   │   ├── db/                  # 数据库层 (Drizzle ORM)
│   │   ├── routes/              # API 路由
│   │   └── ws/                  # WebSocket 服务
│   │
│   ├── web/           # 🖥️ 前端界面
│   │   ├── src/
│   │   │   ├── components/      # React 组件
│   │   │   ├── pages/           # 页面组件
│   │   │   └── services/        # API 服务
│   │   └── vite.config.ts
│   │
│   └── shared/        # 📦 共享代码
│       └── types/               # TypeScript 类型定义
│
├── start.sh           # 🚀 一键启动脚本
└── pnpm-workspace.yaml
```

## 🛠️ 技术栈

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Ant Design** - UI 组件库
- **React Router** - 路由管理

### 后端
- **Express** - Web 框架
- **WebSocket (ws)** - 实时通信
- **SQLite** - 数据库
- **Drizzle ORM** - 数据库 ORM
- **TypeScript** - 类型安全

### 游戏引擎
- **纯 TypeScript 实现** - 无依赖的游戏逻辑引擎
- **完整掼蛋规则** - 牌型识别、规则校验、计分系统

### 开发工具
- **Vitest** - 单元测试框架
- **pnpm** - 包管理器
- **TSC** - TypeScript 编译器

## 📋 系统要求

- **Node.js**: >= 18.0.0
- **pnpm**: 最新版本
- **浏览器**: 支持 ES6+ 的现代浏览器

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd guandan-arena
```

### 2. 安装依赖

```bash
# 安装 pnpm (如果还没安装)
npm install -g pnpm

# 安装所有依赖
pnpm install
```

### 3. 启动开发环境

**方式一：一键启动（推荐）**

```bash
npm start
# 或
sh start.sh
```

这将同时启动前端和后端服务：
- 🖥️ **前端**: http://localhost:5173
- 🔌 **后端**: http://localhost:3000

**方式二：分别启动**

```bash
# 终端 1 - 启动后端
pnpm --filter @guandan/server dev

# 终端 2 - 启动前端
pnpm --filter @guandan/web dev
```

### 4. 访问应用

打开浏览器访问 http://localhost:5173 即可开始游戏！

## 📦 构建部署

### 构建所有包

```bash
pnpm build
```

### 构建单个包

```bash
# 构建游戏引擎
pnpm --filter @guandan/engine build

# 构建后端服务
pnpm --filter @guandan/server build

# 构建前端应用
pnpm --filter @guandan/web build
```

### 生产环境运行

```bash
# 启动后端服务
cd packages/server
pnpm start

# 前端构建产物部署到静态服务器
# packages/web/dist/
```

## 🧪 测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm --filter @guandan/engine test

# 监听模式
pnpm --filter @guandan/engine test:watch
```

## 🎮 游戏规则简介

掼蛋是一种流行的扑克牌游戏，主要规则：

- 👥 **四人游戏** - 对家组队，两两对抗
- 🃏 **升级制** - 从 2 开始打，先打到 A 的队伍获胜
- 🎯 **万能牌** - 当前级别的牌为万能牌，可替代任意牌
- 🎴 **牌型丰富** - 支持单牌、对子、三张、炸弹、同花顺等多种牌型
- 📈 **计分升级** - 根据完成名次决定升级档数

## 📚 API 文档

### HTTP API

```
GET  /health              # 健康检查
GET  /api/rooms           # 获取房间列表
POST /api/rooms           # 创建房间
GET  /api/rooms/:id       # 获取房间详情
POST /api/rooms/:id/join  # 加入房间
```

### WebSocket API

```
ws://localhost:3000/ws/spectate/:roomId
```

观战消息格式：
```typescript
{
  type: 'game-state' | 'player-action' | 'round-end',
  data: { ... }
}
```

## 🗂️ 项目脚本

```json
{
  "start": "sh start.sh",           // 🚀 一键启动开发环境
  "build": "pnpm -r run build",     // 📦 构建所有包
  "dev": "pnpm -r --parallel run dev",  // 🔧 并行启动所有开发服务
  "test": "pnpm -r run test",       // 🧪 运行所有测试
  "lint": "pnpm -r run lint",       // 🔍 代码检查
  "typecheck": "pnpm -r exec tsc --noEmit",  // ✅ 类型检查
  "clean": "pnpm -r exec rm -rf dist node_modules"  // 🧹 清理构建产物
}
```

## 🤝 开发指南

### 代码风格

- 使用 **TypeScript** 进行类型安全开发
- 遵循 **ESLint** 规范
- 使用 **Prettier** 格式化代码（如已配置）

### 提交规范

建议遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 测试相关
chore: 构建/工具链更新
```

### 目录结构说明

- `packages/engine/` - 独立的游戏引擎，不依赖其他包
- `packages/shared/` - 共享类型定义，被其他所有包引用
- `packages/server/` - 后端服务，依赖 engine 和 shared
- `packages/web/` - 前端应用，依赖 shared

## 📄 许可证

本项目为私有项目。

## 👨‍💻 维护者

如有问题或建议，请联系项目维护团队。

---

**祝您游戏愉快！** 🎉
