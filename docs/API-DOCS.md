# 「工银溯藏」API接口文档

## 1. 认证相关接口

### 1.1 用户注册

**URL**: `/api/auth/register`
**方法**: `POST`
**权限**: 公开
**请求体**: 
```json
{
  "name": "用户姓名",
  "email": "user@example.com",
  "password": "密码",
  "phone": "13800138000",
  "icbcAccountId": "工行账户ID",
  "icbcUserId": "工行用户ID"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "用户注册成功",
  "data": {
    "user": {
      "id": "用户ID",
      "name": "用户姓名",
      "email": "user@example.com",
      "role": "USER"
    },
    "token": "JWT令牌"
  }
}
```

### 1.2 用户登录

**URL**: `/api/auth/login`
**方法**: `POST`
**权限**: 公开
**请求体**: 
```json
{
  "email": "user@example.com",
  "password": "密码"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": "用户ID",
      "name": "用户姓名",
      "email": "user@example.com",
      "role": "USER"
    },
    "token": "JWT令牌"
  }
}
```

### 1.3 工行一键登录

**URL**: `/api/auth/login/icbc`
**方法**: `POST`
**权限**: 公开
**请求体**: 
```json
{
  "icbcToken": "工行认证令牌"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "工行一键登录成功",
  "data": {
    "user": {
      "id": "用户ID",
      "name": "用户姓名",
      "email": "user@example.com",
      "role": "USER"
    },
    "token": "JWT令牌"
  }
}
```

### 1.4 获取当前用户信息

**URL**: `/api/auth/me`
**方法**: `GET`
**权限**: 需要认证（JWT令牌）
**响应**: 
```json
{
  "success": true,
  "data": {
    "id": "用户ID",
    "name": "用户姓名",
    "email": "user@example.com",
    "phone": "13800138000",
    "role": "USER",
    "status": "ACTIVE",
    "lastLogin": "2023-07-01T12:00:00Z",
    "createdAt": "2023-06-01T12:00:00Z"
  }
}
```

### 1.5 刷新令牌

**URL**: `/api/auth/refresh`
**方法**: `POST`
**权限**: 需要认证（JWT令牌）
**响应**: 
```json
{
  "success": true,
  "message": "令牌刷新成功",
  "data": {
    "token": "新的JWT令牌"
  }
}
```

### 1.6 注销登录

**URL**: `/api/auth/logout`
**方法**: `POST`
**权限**: 需要认证（JWT令牌）
**响应**: 
```json
{
  "success": true,
  "message": "注销成功"
}
```

## 2. 藏品相关接口

### 2.1 创建藏品

**URL**: `/api/collectibles`
**方法**: `POST`
**权限**: 需要认证，品牌管理员、工行管理员或超级管理员权限
**请求体**: 
```json
{
  "name": "藏品名称",
  "type": "藏品类型",
  "brand": "品牌ID",
  "description": "藏品描述",
  "origin": "产地信息",
  "productionDate": "2023-01-01",
  "features": ["特征1", "特征2"],
  "images": ["图片URL1", "图片URL2"],
  "qrCode": "二维码信息",
  "authenticationCode": "防伪码",
  "initialOwner": "初始所有者ID"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "藏品创建成功",
  "data": {
    "id": "藏品ID",
    "blockchainId": "区块链ID",
    "name": "藏品名称",
    "type": "藏品类型",
    "brand": "品牌ID",
    "description": "藏品描述",
    "currentOwner": "初始所有者ID",
    "status": "AVAILABLE",
    "createdAt": "2023-07-01T12:00:00Z",
    "updatedAt": "2023-07-01T12:00:00Z"
  }
}
```

### 2.2 查询藏品详情

**URL**: `/api/collectibles/:id`
**方法**: `GET`
**权限**: 公开
**响应**: 
```json
{
  "success": true,
  "data": {
    "id": "藏品ID",
    "blockchainId": "区块链ID",
    "name": "藏品名称",
    "type": "藏品类型",
    "brand": {
      "id": "品牌ID",
      "name": "品牌名称",
      "logo": "品牌Logo"
    },
    "description": "藏品描述",
    "origin": "产地信息",
    "productionDate": "2023-01-01",
    "features": ["特征1", "特征2"],
    "images": ["图片URL1", "图片URL2"],
    "qrCode": "二维码信息",
    "authenticationCode": "防伪码",
    "currentOwner": {
      "id": "所有者ID",
      "name": "所有者姓名"
    },
    "status": "OWNED",
    "createdAt": "2023-07-01T12:00:00Z",
    "updatedAt": "2023-07-02T12:00:00Z"
  }
}
```

### 2.3 认领藏品

**URL**: `/api/collectibles/:id/claim`
**方法**: `POST`
**权限**: 需要认证，使用工行认证
**请求体**: 
```json
{
  "icbcToken": "工行认证令牌",
  "verificationCode": "验证码"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "藏品认领成功",
  "data": {
    "id": "藏品ID",
    "name": "藏品名称",
    "currentOwner": "当前用户ID",
    "status": "OWNED",
    "lastTransactionId": "交易ID"
  }
}
```

### 2.4 转移藏品所有权

**URL**: `/api/collectibles/:id/transfer`
**方法**: `POST`
**权限**: 需要认证
**请求体**: 
```json
{
  "toUserId": "接收方用户ID",
  "transferReason": "转移原因"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "藏品所有权转移成功",
  "data": {
    "id": "藏品ID",
    "name": "藏品名称",
    "currentOwner": "接收方用户ID",
    "lastTransactionId": "交易ID"
  }
}
```

### 2.5 查询藏品流转历史

**URL**: `/api/collectibles/:id/history`
**方法**: `GET`
**权限**: 公开
**响应**: 
```json
{
  "success": true,
  "data": [
    {
      "id": "交易ID",
      "from": "原所有者ID",
      "to": "新所有者ID",
      "type": "TRANSFER",
      "timestamp": "2023-07-02T12:00:00Z",
      "description": "转移原因"
    },
    {
      "id": "交易ID",
      "from": "null",
      "to": "初始所有者ID",
      "type": "CREATE",
      "timestamp": "2023-07-01T12:00:00Z",
      "description": "创建藏品"
    }
  ]
}
```

### 2.6 验证藏品真伪

**URL**: `/api/collectibles/verify`
**方法**: `POST`
**权限**: 公开
**请求体**: 
```json
{
  "blockchainId": "区块链ID",
  "authenticationCode": "防伪码"
}
```
**响应**: 
```json
{
  "success": true,
  "data": {
    "authentic": true,
    "collectible": {
      "id": "藏品ID",
      "name": "藏品名称",
      "brand": "品牌名称",
      "currentOwner": "所有者姓名"
    },
    "message": "藏品验证为真"
  }
}
```

### 2.7 搜索藏品

**URL**: `/api/collectibles`
**方法**: `GET`
**权限**: 公开
**查询参数**: 
- `page`: 页码，默认1
- `limit`: 每页数量，默认10
- `search`: 搜索关键词
- `type`: 藏品类型
- `brand`: 品牌ID
- `status`: 藏品状态
- `sortBy`: 排序字段
- `sortOrder`: 排序顺序（asc/desc）

**响应**: 
```json
{
  "success": true,
  "data": [
    {
      "id": "藏品ID",
      "blockchainId": "区块链ID",
      "name": "藏品名称",
      "type": "藏品类型",
      "brand": "品牌名称",
      "status": "OWNED",
      "images": ["图片URL1"]
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pages": 10,
    "limit": 10
  }
}
```

## 3. 品牌相关接口

### 3.1 创建品牌

**URL**: `/api/brands`
**方法**: `POST`
**权限**: 需要认证，工行管理员或超级管理员权限
**请求体**: 
```json
{
  "name": "品牌名称",
  "logo": "品牌Logo URL",
  "description": "品牌描述",
  "contactPerson": "联系人",
  "contactEmail": "contact@brand.com",
  "contactPhone": "13800138000",
  "icbcContractId": "工行合同编号",
  "blockchainIdentity": "区块链身份标识",
  "cooperationStatus": "合作状态"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "品牌创建成功",
  "data": {
    "id": "品牌ID",
    "name": "品牌名称",
    "logo": "品牌Logo URL",
    "description": "品牌描述",
    "cooperationStatus": "PENDING",
    "active": true,
    "createdAt": "2023-07-01T12:00:00Z"
  }
}
```

### 3.2 获取品牌列表

**URL**: `/api/brands`
**方法**: `GET`
**权限**: 需要认证
**查询参数**: 
- `page`: 页码，默认1
- `limit`: 每页数量，默认10
- `search`: 搜索关键词
- `status`: 合作状态
- `sortBy`: 排序字段
- `sortOrder`: 排序顺序（asc/desc）

**响应**: 
```json
{
  "success": true,
  "data": [
    {
      "id": "品牌ID",
      "name": "品牌名称",
      "logo": "品牌Logo URL",
      "description": "品牌描述",
      "cooperationStatus": "ACTIVE",
      "active": true
    }
  ],
  "pagination": {
    "total": 20,
    "page": 1,
    "pages": 2,
    "limit": 10
  }
}
```

### 3.3 获取品牌详情

**URL**: `/api/brands/:id`
**方法**: `GET`
**权限**: 需要认证
**响应**: 
```json
{
  "success": true,
  "data": {
    "id": "品牌ID",
    "name": "品牌名称",
    "logo": "品牌Logo URL",
    "description": "品牌描述",
    "contactPerson": "联系人",
    "contactEmail": "contact@brand.com",
    "contactPhone": "13800138000",
    "icbcContractId": "工行合同编号",
    "blockchainIdentity": "区块链身份标识",
    "cooperationStatus": "ACTIVE",
    "active": true,
    "createdAt": "2023-07-01T12:00:00Z",
    "updatedAt": "2023-07-02T12:00:00Z"
  }
}
```

### 3.4 更新品牌信息

**URL**: `/api/brands/:id`
**方法**: `PUT`
**权限**: 需要认证，工行管理员或超级管理员权限
**请求体**: 
```json
{
  "name": "品牌名称",
  "logo": "品牌Logo URL",
  "description": "品牌描述",
  "contactPerson": "联系人",
  "contactEmail": "contact@brand.com",
  "contactPhone": "13800138000",
  "icbcContractId": "工行合同编号",
  "blockchainIdentity": "区块链身份标识",
  "cooperationStatus": "合作状态"
}
```
**响应**: 
```json
{
  "success": true,
  "message": "品牌信息更新成功",
  "data": {
    "id": "品牌ID",
    "name": "品牌名称",
    "logo": "品牌Logo URL",
    "description": "品牌描述",
    "updatedAt": "2023-07-03T12:00:00Z"
  }
}
```

### 3.5 启用/禁用品牌

**URL**: `/api/brands/:id/status`
**方法**: `PATCH`
**权限**: 需要认证，工行管理员或超级管理员权限
**请求体**: 
```json
{
  "active": true
}
```
**响应**: 
```json
{
  "success": true,
  "message": "品牌已启用",
  "data": {
    "id": "品牌ID",
    "name": "品牌名称",
    "active": true,
    "updatedAt": "2023-07-03T12:00:00Z"
  }
}
```

### 3.6 删除品牌

**URL**: `/api/brands/:id`
**方法**: `DELETE`
**权限**: 需要认证，超级管理员权限
**响应**: 
```json
{
  "success": true,
  "message": "品牌删除成功",
  "data": {
    "id": "品牌ID",
    "name": "品牌名称"
  }
}
```

## 4. 错误处理

所有API接口在出现错误时，返回统一的错误响应格式：

```json
{
  "success": false,
  "error": "错误类型",
  "message": "错误描述"
}
```

常见的错误码：
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未认证，需要登录
- `403 Forbidden`: 无权限访问
- `404 Not Found`: 资源不存在
- `409 Conflict`: 资源冲突（如用户名已存在）
- `500 Internal Server Error`: 服务器内部错误

## 5. 认证机制

API使用JWT（JSON Web Token）进行身份认证。认证成功后，需要在请求头中添加：

```
Authorization: Bearer {token}
```

部分接口需要特定角色权限才能访问，具体权限要求详见各接口说明。