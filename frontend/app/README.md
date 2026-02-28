# 工银溯藏前端 (React + Vite)

全新的工银溯藏前端基于 React、Vite 与 Ant Design 构建，涵盖管理员控制台与客户门户两大界面。

## 功能概览

- **统一登录入口**：管理员账号密码登录，客户通过工行手机银行扫码登录。
- **管理员控制台**：
  - 藏品创建、审批与所有权转移确认
  - 数据仪表盘展示链上运行态势
- **客户门户**：
  - 藏品认领、真伪验证
  - 藏品流转历史、检索与我的藏品管理

## 开发命令

```bash
pnpm install
pnpm dev
```

默认代理 API -> `http://localhost:3000`，可通过 `.env` 设置 `VITE_API_BASE_URL`。

```bash
pnpm build
pnpm preview
```

## 环境变量

在 `frontend/app/.env.local` 中配置：

```
VITE_API_BASE_URL=http://localhost:3000
```

## 目录结构

```
frontend/app/
├── index.html
├── package.json
├── public/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── router/
│   ├── services/
│   └── styles/
└── vite.config.js
```
