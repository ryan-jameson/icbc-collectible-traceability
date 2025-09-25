# 「工银溯藏」—— 基于区块链的藏品数字身份溯源系统

## 项目简介

「工银溯藏」是一款基于区块链技术的藏品数字身份溯源系统，旨在为藏品提供全生命周期的身份认证、流转记录和真伪验证服务。该系统结合工商银行的金融服务能力，为藏品交易提供安全、透明、不可篡改的数字化解决方案。

## 核心功能

### 1. 藏品数字身份创建
- 为每件藏品创建唯一的区块链身份标识
- 记录藏品的基本信息、特征、图片等详细数据
- 生成防伪码和二维码，方便查询验证

### 2. 藏品流转管理
- 记录藏品所有权的每一次转移
- 支持藏品的认领、转让、继承等多种流转方式
- 结合工商银行支付系统，支持安全交易

### 3. 藏品真伪验证
- 通过区块链上的不可篡改记录验证藏品真伪
- 支持多种验证方式：扫码验证、输入防伪码验证
- 展示藏品的完整流转历史，增强可信度

### 4. 品牌管理
- 管理参与藏品认证的品牌商信息
- 控制品牌商的藏品发布权限
- 监控品牌商的藏品流转情况

### 5. 用户管理
- 支持普通用户、品牌管理员、工行管理员、超级管理员等多种角色
- 集成工商银行一键登录功能
- 提供完整的用户认证和授权机制

## 技术栈

### 后端技术
- **Node.js**: 基于JavaScript的服务器端运行环境
- **Express.js**: 轻量级Web应用框架
- **MySQL**: 关系型数据库，存储业务数据
- **mysql2/promise**: MySQL客户端，提供异步数据库操作
- **Hyperledger Fabric**: 企业级区块链平台
- **JWT**: JSON Web Token，用于用户认证

### 前端技术
- 前端框架（待集成）：React.js / Vue.js
- 状态管理：Redux / Vuex
- UI组件库：Ant Design / Element UI
- API请求：Axios

### 部署与运维
- Docker：容器化部署
- Docker Compose：多容器应用编排
- Nginx：反向代理服务器
- GitHub Actions：持续集成/持续部署

## 项目结构

```
├── api/              # 后端API服务
│   ├── controllers/  # 控制器层，处理业务逻辑
│   ├── middleware/   # 中间件，处理认证、授权等
│   ├── models/       # 数据模型，定义数据结构
│   ├── routes/       # 路由定义
│   ├── services/     # 服务层，封装外部API调用
│   ├── package.json  # API服务依赖配置
│   └── server.js     # API服务入口文件
├── blockchain/       # 区块链相关代码和配置
│   ├── chaincode/    # 智能合约代码
│   ├── config/       # 区块链配置
│   ├── network/      # 区块链网络配置
│   ├── index.js      # 区块链模块入口文件
│   └── package.json  # 区块链模块依赖配置
├── config/           # 项目配置文件
│   └── config.js     # 项目主配置文件
├── docs/             # 项目文档
│   ├── API-DOCS.md        # API接口文档
│   └── PROJECT-STRUCTURE.md # 项目结构文档
├── frontend/         # 前端应用（待创建）
├── .gitignore        # Git忽略规则
├── README.md         # 项目说明文档（当前文件）
└── package.json      # 项目依赖配置
```

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- MySQL >= 5.7
- Docker >= 20.0.0 (用于区块链网络)
- npm >= 6.0.0 或 yarn >= 1.22.0

### 安装与配置

1. **克隆项目代码**
```bash
git clone https://github.com/your-organization/icbc-collectible.git
cd icbc-collectible
```

2. **安装依赖**
```bash
# 安装根目录依赖
npm install

# 安装API服务依赖
cd api
npm install

# 安装区块链模块依赖
cd ../blockchain
npm install
```

3. **配置环境变量**
创建`.env`文件，根据实际情况配置环境变量：
```env
# 基本配置
NODE_ENV=development
PORT=3000

# MySQL配置
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=collectible
MYSQL_PORT=3306

# JWT配置
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# 区块链配置
BLOCKCHAIN_CONFIG_PATH=../blockchain/network/network-config.yaml
BLOCKCHAIN_CHANNEL=mychannel
BLOCKCHAIN_CHAINCODE=collectible-chaincode

# 工行API配置
ICBC_API_BASE_URL=https://api.icbc.com.cn
ICBC_APP_ID=your-icbc-app-id
ICBC_API_KEY=your-icbc-api-key
```

4. **启动MySQL服务**
```bash
# 本地MySQL服务启动示例
sudo systemctl start mysql
# 或使用Docker启动MySQL
docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=collectible -p 3306:3306 mysql:5.7
```

5. **启动区块链网络**
```bash
# 进入区块链网络目录
cd blockchain/network
# 启动网络（具体命令根据网络配置而定）
# 示例（使用Hyperledger Fabric的byfn脚本）
./network.sh up createChannel -c mychannel -ca
```

6. **部署智能合约**
```bash
# 在区块链网络目录下
./network.sh deployCC -c mychannel -ccn collectible-chaincode -ccp ../chaincode -ccl javascript
```

7. **启动API服务**
```bash
# 返回API服务目录
cd ../../api
# 启动服务
npm start
# 或使用开发模式启动（支持热重载）
npm run dev
```

## 使用指南

### API接口调用

系统提供了丰富的API接口，详细的接口文档请参考`docs/API-DOCS.md`文件。主要包括以下几类接口：

1. **认证接口**：用户注册、登录、信息查询等
2. **藏品接口**：创建藏品、查询藏品、转移所有权等
3. **品牌接口**：管理参与的品牌商信息

### 藏品创建与流转流程

1. **创建藏品**：品牌管理员或工行管理员登录系统，创建新藏品信息，系统自动在区块链上生成唯一标识
2. **分配藏品**：将创建的藏品分配给初始所有者
3. **认领藏品**：用户通过工行认证后，认领属于自己的藏品
4. **转移藏品**：藏品所有者可以将藏品转让给其他用户
5. **验证藏品**：任何人都可以通过系统验证藏品的真伪和流转历史

## 安全措施

1. **多重身份认证**：支持密码登录和工行一键登录，采用JWT进行身份验证
2. **权限控制**：基于角色的访问控制（RBAC），严格控制各功能模块的访问权限
3. **数据加密**：敏感数据存储加密，传输过程采用HTTPS加密
4. **区块链防伪**：利用区块链的不可篡改特性，确保藏品信息和流转记录的真实性
5. **异常监控**：实时监控系统运行状态和异常行为

## 开发与贡献

1. **开发流程**
   - Fork项目仓库
   - 创建功能分支（`git checkout -b feature/your-feature`）
   - 提交代码（`git commit -am 'Add some feature'`）
   - 推送到分支（`git push origin feature/your-feature`）
   - 创建Pull Request

2. **代码规范**
   - 遵循JavaScript/Node.js代码规范
   - 提交前运行`npm run lint`检查代码质量
   - 确保测试用例通过

3. **文档更新**
   - 代码更新时同步更新相关文档
   - 新增功能时更新API文档和使用说明

## 故障排查

1. **数据库连接失败**
   - 检查MySQL服务是否正常运行
   - 确认MySQL连接配置（主机、端口、用户名、密码、数据库名）正确

2. **区块链网络问题**
   - 检查Docker容器是否正常运行（`docker ps -a`）
   - 查看区块链日志（`docker logs container_name`）
   - 确认网络配置文件正确

3. **API请求错误**
   - 检查请求参数是否符合要求
   - 确认认证令牌是否有效
   - 查看API服务日志，定位具体错误信息

## 版权信息

© 2023 工商银行. All Rights Reserved.

## 联系方式

如有任何问题或建议，请联系项目负责人：
- 邮箱：project@icbc.com
- 电话：400-123-4567