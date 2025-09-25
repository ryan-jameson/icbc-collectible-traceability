// MySQL数据库连接工具

const mysql = require('mysql2/promise');
const logger = require('../../blockchain/utils/log-utils');
const config = require('../../config/config');

let pool;

// 连接数据库
exports.connectDB = async () => {
    try {
        // 从配置文件获取MySQL配置
        const host = config.mysql.host;
        const user = config.mysql.user;
        const password = config.mysql.password;
        const database = config.mysql.database;
        const port = config.mysql.port;
        const connectionLimit = config.mysql.connectionLimit;
        
        logger.info(`开始连接MySQL数据库: ${host}:${port}/${database}`);
        
        // 首先连接到 MySQL 服务器（不指定数据库）
        const tempConnection = await mysql.createConnection({
            host,
            user,
            password,
            port
        });
        
        // 检查并创建数据库
        const [databases] = await tempConnection.execute(`SHOW DATABASES LIKE '${database}'`);
        if (databases.length === 0) {
            logger.info(`数据库 ${database} 不存在，正在创建...`);
            await tempConnection.execute(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            logger.info(`数据库 ${database} 创建成功`);
        }
        
        await tempConnection.end();
        
        // 现在创建连接池，连接到指定的数据库
        pool = mysql.createPool({
            host,
            user,
            password,
            database,
            port,
            waitForConnections: config.mysql.waitForConnections,
            connectionLimit: connectionLimit,
            queueLimit: config.mysql.queueLimit
        });
        
        // 测试连接
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        logger.info('成功连接到MySQL数据库');
        
        // 初始化表结构
        await initializeTables();
        
        return true;
    } catch (error) {
        logger.error('连接MySQL数据库失败:', error);
        process.exit(1);
    }
};

// 获取数据库连接池
exports.getPool = () => {
    if (!pool) {
        throw new Error('MySQL数据库连接尚未初始化');
    }
    return pool;
};

// 关闭数据库连接
exports.closeDB = async () => {
    if (pool) {
        await pool.end();
        logger.info('MySQL数据库连接已关闭');
    }
};

// 初始化表结构
const initializeTables = async () => {
    try {
        const pool = exports.getPool();
        
        // 创建users表
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                phone VARCHAR(20),
                icbc_account_id VARCHAR(50) NOT NULL UNIQUE,
                icbc_user_id VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                salt VARCHAR(255),
                role ENUM('USER', 'BRAND_ADMIN', 'ICBC_ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
                status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
                last_login DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // 创建brands表
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS brands (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                logo VARCHAR(255),
                description TEXT,
                website VARCHAR(255),
                contact_email VARCHAR(100) NOT NULL,
                contact_phone VARCHAR(20),
                blockchain_msp_id VARCHAR(50) NOT NULL UNIQUE,
                partnership_level ENUM('PLATINUM', 'GOLD', 'SILVER', 'BRONZE') NOT NULL DEFAULT 'SILVER',
                partnership_start_date DATE NOT NULL,
                partnership_end_date DATE,
                status ENUM('ACTIVE', 'INACTIVE', 'PENDING', 'TERMINATED') NOT NULL DEFAULT 'PENDING',
                created_by INT,
                approved_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        
        // 创建collectibles表
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS collectibles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                blockchain_id VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                brand_id INT NOT NULL,
                designer VARCHAR(100) NOT NULL,
                material VARCHAR(100) NOT NULL,
                batch_number VARCHAR(50) NOT NULL,
                production_date DATE NOT NULL,
                description TEXT,
                hash VARCHAR(255) NOT NULL UNIQUE,
                qr_code_url VARCHAR(255),
                nfc_id VARCHAR(50) UNIQUE,
                current_owner_id INT,
                status ENUM('ACTIVE', 'INACTIVE', 'LOAN', 'INSURED') NOT NULL DEFAULT 'ACTIVE',
                estimated_value DECIMAL(10, 2) DEFAULT 0,
                last_valuation_date DATE,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
                FOREIGN KEY (current_owner_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        
        // 创建transfer_histories表
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS transfer_histories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                collectible_id INT NOT NULL,
                from_user VARCHAR(50) NOT NULL,
                to_user VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                type ENUM('CLAIM', 'TRANSFER', 'INSURANCE', 'LOAN') NOT NULL DEFAULT 'TRANSFER',
                transaction_id VARCHAR(100),
                FOREIGN KEY (collectible_id) REFERENCES collectibles(id) ON DELETE CASCADE
            )
        `);
        
        // 创建user_collectibles关联表
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS user_collectibles (
                user_id INT NOT NULL,
                collectible_id INT NOT NULL,
                PRIMARY KEY (user_id, collectible_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (collectible_id) REFERENCES collectibles(id) ON DELETE CASCADE
            )
        `);
        
        logger.info('MySQL表结构初始化完成');
    } catch (error) {
        logger.error('MySQL表结构初始化失败:', error);
        throw error;
    }
};