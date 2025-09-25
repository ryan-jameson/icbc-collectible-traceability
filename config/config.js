// 项目配置文件

// 获取环境变量
const env = process.env.NODE_ENV || 'development';

// 基本配置
const baseConfig = {
    env,
    port: process.env.PORT || 3000,
    
    // MySQL 配置
    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'icbc-collectible',
        port: process.env.MYSQL_PORT || 3306,
        connectionLimit: process.env.MYSQL_CONNECTION_LIMIT || 10,
        waitForConnections: true,
        queueLimit: 0
    },
    
    // JWT 配置
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    
    // 区块链网络配置
    blockchain: {
        networkConfigPath: process.env.BLOCKCHAIN_CONFIG_PATH || '../blockchain/network/network-config.yaml',
        channelName: process.env.BLOCKCHAIN_CHANNEL || 'collectible-channel',
        chaincodeName: process.env.BLOCKCHAIN_CHAINCODE || 'collectible-chaincode',
        mspId: process.env.BLOCKCHAIN_MSP_ID || 'Org1MSP',
        userCertPath: process.env.BLOCKCHAIN_USER_CERT_PATH || '../blockchain/network/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem',
        userKeyPath: process.env.BLOCKCHAIN_USER_KEY_PATH || '../blockchain/network/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/'
    },
    
    // 工行API配置
    icbc: {
        apiBaseUrl: process.env.ICBC_API_BASE_URL || 'https://api.icbc.com.cn',
        appId: process.env.ICBC_APP_ID || 'your-icbc-app-id',
        apiKey: process.env.ICBC_API_KEY || 'your-icbc-api-key',
        merchantId: process.env.ICBC_MERCHANT_ID || 'your-icbc-merchant-id',
        callbackUrl: process.env.ICBC_CALLBACK_URL || 'http://localhost:3000/api/icbc/callback'
    },
    
    // 日志配置
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || './logs/app.log'
    },
    
    // 文件上传配置
    upload: {
        maxSize: process.env.UPLOAD_MAX_SIZE || 5 * 1024 * 1024, // 5MB
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    },
    
    // 缓存配置
    cache: {
        ttl: process.env.CACHE_TTL || 3600, // 1小时
        maxItems: process.env.CACHE_MAX_ITEMS || 1000
    },
    
    // 限流配置
    rateLimit: {
        windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000, // 15分钟
        maxRequests: process.env.RATE_LIMIT_MAX || 100 // 每个窗口最多100个请求
    },
    
    // 支付相关配置
    payment: {
        transactionFee: process.env.TRANSACTION_FEE || 5.0, // 交易手续费（元）
        currency: process.env.PAYMENT_CURRENCY || 'CNY',
        paymentMethods: ['icbc', 'wechat', 'alipay']
    }
};

// 开发环境特定配置
const developmentConfig = {
    ...baseConfig,
    logging: {
        level: 'debug',
        file: './logs/app-development.log'
    },
    // 开发环境下可以添加更多特定配置
};

// 测试环境特定配置
const testConfig = {
    ...baseConfig,
    port: 3001,
    mysql: {
        ...baseConfig.mysql,
        database: 'icbc-collectible-test'
    },
    logging: {
        level: 'warn',
        file: './logs/app-test.log'
    }
};

// 生产环境特定配置
const productionConfig = {
    ...baseConfig,
    logging: {
        level: 'error',
        file: './logs/app-production.log'
    },
    // 生产环境下可以添加更多特定配置
};

// 根据环境选择配置
const config = {
    development: developmentConfig,
    test: testConfig,
    production: productionConfig
}[env] || developmentConfig;

module.exports = config;