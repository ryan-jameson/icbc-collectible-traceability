// 工银溯藏API服务入口文件

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- 自动管理 .env 文件中的 JWT 密钥 (仅限开发环境) ---
const manageEnvKeys = () => {
    const envPath = path.resolve(__dirname, '..', '.env');
    const keysToEnsure = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    let envContent = '';

    try {
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        let keysAdded = false;
        for (const key of keysToEnsure) {
            if (!envContent.includes(`${key}=`)) {
                const randomValue = crypto.randomBytes(16).toString('hex');
                envContent += `\n${key}=${randomValue}`;
                keysAdded = true;
                console.log(`[自动配置] 检测到 ${key} 缺失, 已在 .env 文件中生成。`);
            }
        }

        if (keysAdded) {
            fs.writeFileSync(envPath, envContent.trim());
            console.log(`[自动配置] .env 文件已更新。`);
        }
    } catch (error) {
        console.error('[自动配置] 处理 .env 文件时出错:', error);
        process.exit(1); // 如果文件操作失败，则退出以防万一
    }
};

// 在加载其他配置之前执行
manageEnvKeys();

// 加载环境变量 - 在生成 .env 文件后立即加载
const dotenv = require('dotenv');
dotenv.config({
    path: path.resolve(__dirname, '..', '.env')
});
// --- 自动管理逻辑结束 ---

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('../config/config');

// 导入区块链模块
const blockchain = require('../blockchain');
const logger = require('../blockchain/utils/log-utils');

// 导入路由
const collectibleRoutes = require('./routes/collectible');
const userRoutes = require('./routes/user');
const brandRoutes = require('./routes/brand');
const authRoutes = require('./routes/auth');

// 导入MySQL连接工具
const { connectDB, closeDB } = require('./utils/db');

// 检查关键环境变量
if (!config.jwt.secret || !config.jwt.refreshSecret) {
    logger.error('致命错误: JWT_SECRET 和 JWT_REFRESH_SECRET 环境变量未设置。');
    logger.info('请在.env文件中或直接在启动脚本中设置这些变量。');
    process.exit(1);
}

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/public', express.static(path.join(__dirname, 'public')));

// 初始化区块链连接
const initializeBlockchain = async () => {
    try {
        logger.info('开始初始化区块链网络连接...');
        
        const success = await blockchain.initialize();
        if (success) {
            logger.info('成功连接到区块链网络');
        } else {
            logger.error('连接区块链网络失败，将在启动后重试');
        }
    } catch (error) {
        logger.logErrorDetails('初始化区块链网络', error);
    }
};

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/collectibles', collectibleRoutes);

// 健康检查端点
app.get('/api/health', async (req, res) => {
    try {
        // 检查区块链是否连接（简单检查）
        const blockchainConnected = typeof blockchain !== 'undefined';
        
        // 检查数据库连接状态
        let databaseStatus = 'disconnected';
        try {
            const { getPool } = require('./utils/db');
            const pool = getPool();
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();
            databaseStatus = 'connected';
        } catch (dbError) {
            logger.warn('数据库连接检查失败:', dbError);
        }
        
        res.status(200).json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            services: {
                api: 'running',
                database: databaseStatus,
                blockchain: blockchainConnected ? 'initialized' : 'not initialized'
            }
        });
        
        logger.debug('健康检查请求处理完成');
    } catch (error) {
        logger.error('健康检查请求处理失败:', error);
        res.status(500).json({
            status: 'DOWN',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// 根路径端点
app.get('/', (req, res) => {
    res.json({
        name: '工银溯藏API服务',
        version: '1.0.0',
        description: '基于区块链的藏品数字身份溯源系统API'
    });
});

// 404错误处理
app.use((req, res) => {
    res.status(404).json({
        error: '请求的资源不存在'
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    // 记录错误详情
    logger.logErrorDetails('API请求处理', err, {
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body
    });
    
    // 根据错误类型返回不同的状态码
    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
        error: statusCode === 500 ? '服务器内部错误' : '请求处理失败',
        message: err.message || '未知错误',
        errorCode: err.code || 'UNKNOWN_ERROR'
    });
});

// 启动服务器
const PORT = config.port || 3000;

const startServer = async () => {
    try {
        logger.info('开始启动工银溯藏API服务...');
        
        // 连接数据库
        await connectDB();
        
        // 初始化区块链连接
        await initializeBlockchain();
        
        // 启动服务器
        app.listen(PORT, () => {
            logger.info(`工银溯藏API服务已启动，监听端口: ${PORT}`);
        });
    } catch (error) {
        logger.logErrorDetails('启动API服务', error);
        process.exit(1);
    }
};

// 启动服务器
startServer();

// 优雅关闭处理
process.on('SIGINT', async () => {
    logger.info('开始优雅关闭服务器...');
    
    try {
        // 断开区块链连接
        if (blockchain) {
            await blockchain.disconnect();
        }
        
        // 关闭数据库连接
        await closeDB();
        logger.info('已关闭MySQL数据库连接');
        
        logger.info('服务器已成功关闭');
        process.exit(0);
    } catch (error) {
        logger.error('优雅关闭服务器时出错:', error);
        process.exit(1);
    }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
    process.exit(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', { reason, promise });
    process.exit(1);
});