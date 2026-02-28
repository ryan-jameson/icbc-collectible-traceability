# 工银溯藏前端（React 全新界面）

> 🚧 2025-10-05 起，`frontend/app` 目录提供全新的 React + Vite 前端工程，覆盖管理员与客户双端功能，并替换旧版纯脚本实现。旧版 SDK 文档继续保留在本文档下方以便回溯。

# 工银溯藏 - 区块链藏品数字身份溯源系统前端SDK

## 概述

本SDK为银行APP和Web应用提供了区块链藏品数字身份溯源系统的前端开发工具包，支持用户认证、藏品管理、品牌管理等核心功能。

## 文件结构

```
frontend/
├── config.js              # 配置文件
├── request.js             # HTTP请求工具类
├── auth.js                # 认证相关功能SDK
├── collectible.js         # 藏品相关功能SDK
├── brand.js               # 品牌相关功能SDK
├── utils.js               # 通用工具函数
├── index.js               # SDK主入口
├── index.html             # 演示页面
├── server.js              # 本地测试服务器
└── README.md              # 使用说明
```

## 快速开始

### 1. 环境要求

- **浏览器环境**：支持现代浏览器（Chrome 60+、Firefox 55+、Safari 11+、Edge 79+）
- **Node.js环境**：v12.0及以上版本
- **后端服务**：需要运行区块链藏品溯源系统的API服务和区块链网络

### 2. 安装依赖

本SDK不依赖第三方库，可以直接在项目中引入使用。

### 3. 使用方法

#### 浏览器环境

在HTML文件中按顺序引入SDK文件：

```html
<script src="/frontend/config.js"></script>
<script src="/frontend/utils.js"></script>
<script src="/frontend/request.js"></script>
<script src="/frontend/auth.js"></script>
<script src="/frontend/collectible.js"></script>
<script src="/frontend/brand.js"></script>
<script src="/frontend/index.js"></script>
```

引入后，可以通过全局变量访问SDK功能：

```javascript
// 配置API地址
window.config.API_BASE_URL = 'http://localhost:5000';

// 用户登录示例
window.auth.login({ email: 'test@example.com', password: '123456' })
  .then(userInfo => {
    console.log('登录成功:', userInfo);
    // 获取我的藏品
    return window.collectible.getMyCollectibles({ page: 1, limit: 10 });
  })
  .then(collectibles => {
    console.log('我的藏品:', collectibles);
  })
  .catch(error => {
    console.error('操作失败:', error);
  });
```

#### Node.js环境

在Node.js项目中，可以使用require引入SDK：

```javascript
// 引入SDK文件
const config = require('./frontend/config');
const utils = require('./frontend/utils');
const request = require('./frontend/request');
const auth = require('./frontend/auth');
const collectible = require('./frontend/collectible');
const brand = require('./frontend/brand');
const sdk = require('./frontend/index');

// 配置API地址
config.API_BASE_URL = 'http://localhost:5000';

// 用户登录示例
async function loginAndGetCollectibles() {
  try {
    const userInfo = await auth.login({ email: 'test@example.com', password: '123456' });
    console.log('登录成功:', userInfo);
    
    const collectibles = await collectible.getMyCollectibles({ page: 1, limit: 10 });
    console.log('我的藏品:', collectibles);
  } catch (error) {
    console.error('操作失败:', error);
  }
}

loginAndGetCollectibles();
```

### 4. 本地测试

使用提供的本地服务器快速测试SDK功能：

1. 确保已安装Node.js环境
2. 进入frontend目录
3. 运行服务器脚本：

```bash
node server.js
```

4. 打开浏览器，访问 http://localhost:3000

## 主要功能模块

### 1. 认证模块 (auth.js)

提供用户注册、登录、注销等认证相关功能：

- `login(credentials)` - 用户登录
- `register(userInfo)` - 用户注册
- `icbcLogin(params)` - 工行一键登录
- `getUserInfo()` - 获取当前用户信息
- `refreshToken()` - 刷新认证令牌
- `logout()` - 注销登录

### 2. 藏品模块 (collectible.js)

提供藏品的创建、查询、认领和转移等功能：

- `createCollectible(collectibleData)` - 创建藏品
- `getCollectibleDetails(collectibleId)` - 查询藏品详情
- `claimCollectible(collectibleId)` - 认领藏品
- `transferCollectible(collectibleId, targetUserId)` - 转移所有权
- `getCollectibleHistory(collectibleId)` - 查询流转历史
- `verifyCollectible(collectibleId)` - 验证真伪
- `searchCollectibles(query)` - 搜索藏品
- `getMyCollectibles(query)` - 获取我的藏品

### 3. 品牌模块 (brand.js)

提供品牌的创建、查询、更新等功能：

- `createBrand(brandData)` - 创建品牌
- `getBrandList(query)` - 获取品牌列表
- `getBrandDetails(brandId)` - 查询品牌详情
- `updateBrand(brandId, brandData)` - 更新品牌
- `enableBrand(brandId)` - 启用品牌
- `disableBrand(brandId)` - 禁用品牌
- `deleteBrand(brandId)` - 删除品牌
- `getBrandCollectibles(brandId, query)` - 获取品牌藏品

### 4. 工具模块 (utils.js)

提供日期格式化、存储管理、数据验证等通用工具函数：

- `formatDate(date, format)` - 日期格式化
- `storage.set(key, value, expire)` - 本地存储设置
- `storage.get(key)` - 本地存储获取
- `debounce(func, wait)` - 防抖函数
- `throttle(func, wait)` - 节流函数
- `deepClone(obj)` - 深拷贝
- `validateEmail(email)` - 邮箱验证
- `generateUUID()` - 生成UUID
- `encrypt(data, key)` - 加密数据
- `decrypt(data, key)` - 解密数据

## 配置说明

通过修改 `config.js` 文件可以配置SDK的行为：

- `API_BASE_URL` - API基础地址
- `TIMEOUT` - 请求超时时间（毫秒）
- `STORAGE_KEYS` - 存储键名配置
- `LOG_LEVEL` - 日志级别
- `CACHE_ENABLED` - 是否启用缓存
- `RETRY_ENABLED` - 是否启用重试
- `RETRY_CONFIG` - 重试配置
- `ICBC_CONFIG` - 工行相关配置

## 开发指南

### 1. 错误处理

SDK使用Promise处理异步操作，建议使用try/catch或then/catch处理可能的错误：

```javascript
try {
  const result = await auth.login(credentials);
  // 处理成功结果
} catch (error) {
  // 处理错误
  console.error('错误码:', error.code);
  console.error('错误信息:', error.message);
}
```

### 2. 事件监听

部分模块支持事件监听，可以注册回调函数处理特定事件：

```javascript
// 监听认证状态变化
auth.on('authChange', (isAuthenticated) => {
  console.log('认证状态变化:', isAuthenticated);
  if (!isAuthenticated) {
    // 跳转到登录页面
  }
});

// 监听藏品创建成功事件
collectible.on('collectibleCreated', (collectibleData) => {
  console.log('新藏品创建成功:', collectibleData);
  // 显示成功提示
});
```

### 3. 缓存管理

SDK内置了请求缓存机制，可以提高性能：

```javascript
// 配置缓存
config.CACHE_ENABLED = true;
config.CACHE_TTL = 60000; // 缓存1分钟

// 清除特定缓存
request.cache.remove('/api/collectibles');

// 清除所有缓存
request.cache.clear();
```

### 4. 跨域请求

在浏览器环境中，可能会遇到跨域问题。后端API需要配置CORS，或者在开发环境中使用代理：

```javascript
// 配置代理
config.USE_PROXY = true;
config.PROXY_URL = 'http://localhost:3001';
```

## 安全注意事项

1. 不要在前端代码中暴露敏感信息
2. 使用HTTPS协议进行生产环境部署
3. 定期更新JWT令牌
4. 避免在本地存储中保存敏感数据
5. 对用户输入进行验证和清理

## 常见问题

### 1. 无法连接到API服务

- 检查API_BASE_URL配置是否正确
- 确认后端服务是否正常运行
- 检查网络连接和防火墙设置
- 确认CORS配置是否正确

### 2. 认证失败

- 检查用户名和密码是否正确
- 确认JWT令牌是否过期
- 检查令牌存储是否正常

### 3. 藏品创建失败

- 确认用户是否已登录并有创建权限
- 检查必填参数是否完整
- 确认品牌ID是否存在

## 示例代码

### 完整的用户登录和获取藏品流程

```javascript
// 初始化SDK
window.sdk.init();

// 用户登录
window.auth.login({ email: 'test@example.com', password: '123456' })
  .then(loginResponse => {
    console.log('登录成功:', loginResponse);
    
    // 获取当前用户信息
    return window.auth.getUserInfo();
  })
  .then(userInfo => {
    console.log('用户信息:', userInfo);
    
    // 获取我的藏品
    return window.collectible.getMyCollectibles({ page: 1, limit: 10 });
  })
  .then(collectibles => {
    console.log('我的藏品列表:', collectibles);
    
    // 如果有藏品，获取第一个藏品的详情
    if (collectibles.items && collectibles.items.length > 0) {
      const firstCollectibleId = collectibles.items[0]._id;
      return window.collectible.getCollectibleDetails(firstCollectibleId);
    }
  })
  .then(collectibleDetails => {
    if (collectibleDetails) {
      console.log('藏品详情:', collectibleDetails);
      
      // 验证藏品真伪
      return window.collectible.verifyCollectible(collectibleDetails._id);
    }
  })
  .then(verificationResult => {
    if (verificationResult) {
      console.log('真伪验证结果:', verificationResult.isAuthentic ? '真品' : '赝品');
    }
  })
  .catch(error => {
    console.error('操作过程中发生错误:', error);
  });
```

### 创建品牌和藏品流程

```javascript
// 创建品牌
window.brand.createBrand({
  name: '测试品牌',
  description: '这是一个测试品牌',
  contact: '张三',
  phone: '13800138000',
  email: 'contact@example.com'
})
.then(brandResponse => {
  console.log('品牌创建成功:', brandResponse);
  
  // 使用新创建的品牌创建藏品
  return window.collectible.createCollectible({
    name: '测试藏品',
    description: '这是一个测试藏品',
    brandId: brandResponse._id,
    batchNumber: 'TEST-2023-001',
    productionDate: new Date().toISOString()
  });
})
.then(collectibleResponse => {
  console.log('藏品创建成功:', collectibleResponse);
  
  // 获取藏品流转历史
  return window.collectible.getCollectibleHistory(collectibleResponse._id);
})
.then(historyResponse => {
  console.log('藏品流转历史:', historyResponse);
})
.catch(error => {
  console.error('操作失败:', error);
});
```

## 更新日志

### 版本 1.0.0
- 初始版本
- 实现用户认证功能
- 实现藏品管理功能
- 实现品牌管理功能
- 提供基础工具函数
- 支持浏览器和Node.js环境

## 联系我们

如有任何问题或建议，请联系系统管理员或技术支持团队。