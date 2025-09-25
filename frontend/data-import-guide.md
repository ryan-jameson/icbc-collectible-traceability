# 工银溯藏系统 - 数据导入指南

本指南将帮助您在工银溯藏系统中导入用户数据库与藏品数据库进行测试。

## 导入脚本使用说明

系统提供了一个自动化的数据导入脚本，用于快速导入测试数据到 MySQL 数据库。

### 前提条件

在运行导入脚本前，请确保：

1. MySQL 数据库服务已启动
2. 项目已安装所有依赖
3. 已创建 `.env` 配置文件，其中包含正确的数据库连接信息

### 脚本介绍

脚本文件路径：`frontend/import-test-data.js`

该脚本会导入以下测试数据：

- **用户数据**：包含超级管理员、工行管理员、品牌管理员和普通用户四种角色的测试账号
- **品牌数据**：包含"工银金行家"和"国博文创"两个测试品牌
- **藏品数据**：根据品牌和预设模板生成多个测试藏品

### 运行脚本

1. 打开命令行工具，进入项目根目录

2. 安装必要的依赖（如果尚未安装）：

   ```bash
   npm install mysql2 bcryptjs dotenv
   ```

3. 运行导入脚本：

   ```bash
   node frontend/import-test-data.js
   ```

4. 脚本运行完成后，会显示导入成功的信息，包括测试账号的登录凭证

## 手动导入数据方法

如果您需要更灵活地导入特定数据，可以使用 MySQL 的原生工具进行手动导入。

### 使用 MySQL Workbench 导入数据

MySQL Workbench 是官方提供的 GUI 工具，支持可视化数据导入/导出：

1. 下载并安装 [MySQL Workbench](https://dev.mysql.com/downloads/workbench/)

2. 连接到您的 MySQL 数据库

3. 选择目标数据库（默认为 `collectible`）

4. 在顶部菜单中选择"Server" > "Data Import"

5. 选择"Import from Self-Contained File"，然后选择您的 SQL 数据文件

6. 点击"Start Import"按钮开始导入过程

### 使用 mysql 命令行工具

MySQL 提供了 `mysql` 命令行工具，用于导入 SQL 格式的数据：

#### 导入数据示例：

```bash
mysql -u root -p collectible < import_data.sql
```

### 使用 LOAD DATA INFILE 命令

对于 CSV 格式的数据文件，可以使用 MySQL 的 `LOAD DATA INFILE` 命令：

#### 导入用户数据示例：

```sql
LOAD DATA INFILE 'users.csv'
INTO TABLE users
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

## 数据结构说明

MySQL 数据库使用表结构存储数据，以下是主要表的结构说明：

### 用户表结构 (users)

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  icbcAccountId VARCHAR(255),
  icbcUserId VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 品牌表结构 (brands)

```sql
CREATE TABLE brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  logo VARCHAR(255),
  description TEXT,
  website VARCHAR(255),
  contactEmail VARCHAR(255) NOT NULL UNIQUE,
  contactPhone VARCHAR(20),
  blockchainMspId VARCHAR(255) NOT NULL UNIQUE,
  partnershipLevel VARCHAR(50),
  productCategories TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 藏品表结构 (collectibles)

```sql
CREATE TABLE collectibles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blockchainId VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  brand_id INT NOT NULL,
  designer VARCHAR(255),
  material VARCHAR(255),
  batchNumber VARCHAR(255),
  productionDate DATE,
  description TEXT,
  hash VARCHAR(255) NOT NULL UNIQUE,
  qrCodeUrl VARCHAR(255),
  currentOwner_id INT,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (currentOwner_id) REFERENCES users(id)
);
```

### 藏品流转历史表 (transfer_histories)

```sql
CREATE TABLE transfer_histories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collectible_id INT NOT NULL,
  from_user_id INT,
  to_user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  transactionId VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collectible_id) REFERENCES collectibles(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);
```

### 用户藏品关联表 (user_collectibles)

```sql
CREATE TABLE user_collectibles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  collectible_id INT NOT NULL,
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (collectible_id) REFERENCES collectibles(id),
  UNIQUE KEY unique_user_collectible (user_id, collectible_id)
);
```

## 自定义测试数据

如果您需要导入自己的测试数据，可以修改 `import-test-data.js` 文件中的 `testData` 对象，添加或修改相应的数据。

## 注意事项

1. 运行导入脚本前，请确保您已备份重要数据，因为脚本会清理现有数据

2. 导入脚本使用的是开发环境配置，生产环境请谨慎操作

3. 如果您遇到连接数据库失败的问题，请检查 `.env` 文件中的 MySQL 连接配置是否正确

4. 如需更多帮助，请联系系统管理员

## 常见问题

**Q: 运行脚本时出现 "Cannot find module" 错误怎么办？**
A: 请确保已安装所有必要的依赖，可以使用 `npm install` 命令安装项目依赖。

**Q: 如何查看已导入的数据？**
A: 您可以使用 MySQL Workbench 或通过 `mysql` 命令行工具连接数据库查看数据。

**Q: 导入的数据无法在前端界面显示怎么办？**
A: 请确保 API 服务已启动，并且数据库连接配置正确。您可以检查 API 服务的日志输出获取更多信息。