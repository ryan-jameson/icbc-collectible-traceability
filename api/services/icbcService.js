// 工行服务接口封装

const axios = require('axios');
const config = require('../../config/config');

// 工行API基础URL
const ICBC_API_BASE_URL = config.icbc.apiBaseUrl || 'https://api.icbc.com.cn';

// 创建axios实例
const icbcApiClient = axios.create({
    baseURL: ICBC_API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.icbc.apiKey}`,
        'X-ICBC-App-Id': config.icbc.appId
    }
});

/**
 * 验证工行账户信息
 * @param {string} icbcAccountId - 工行账户ID
 * @param {string} icbcUserId - 工行用户ID
 * @returns {Promise<boolean>} - 返回验证结果
 */
exports.verifyAccount = async (icbcAccountId, icbcUserId) => {
    try {
        const response = await icbcApiClient.post('/account/verify', {
            icbcAccountId,
            icbcUserId
        });
        
        return response.data.success && response.data.valid;
    } catch (error) {
        console.error('工行账户验证失败:', error);
        
        // 在开发环境下，返回模拟成功结果
        if (config.env === 'development') {
            return true;
        }
        
        return false;
    }
};

/**
 * 使用工行令牌进行身份验证
 * @param {string} icbcToken - 工行认证令牌
 * @returns {Promise<object|null>} - 返回工行用户信息或null
 */
exports.authenticateWithIcbc = async (icbcToken) => {
    try {
        const response = await icbcApiClient.post('/auth/verify-token', {
            token: icbcToken
        });
        
        if (response.data.success && response.data.userInfo) {
            return {
                icbcUserId: response.data.userInfo.userId,
                icbcAccountId: response.data.userInfo.accountId,
                name: response.data.userInfo.name,
                email: response.data.userInfo.email,
                phone: response.data.userInfo.phone,
                avatar: response.data.userInfo.avatar
            };
        }
        
        return null;
    } catch (error) {
        console.error('工行令牌验证失败:', error);
        
        // 在开发环境下，返回模拟用户信息
        if (config.env === 'development') {
            return {
                icbcUserId: 'ICBC' + Date.now(),
                icbcAccountId: '622202' + Math.random().toString().slice(2, 13),
                name: '工行用户' + Math.random().toString().slice(2, 5),
                email: 'icbc_user_' + Date.now() + '@icbc.com',
                phone: '138' + Math.random().toString().slice(2, 10)
            };
        }
        
        return null;
    }
};

/**
 * 获取用户工行账户余额
 * @param {string} icbcAccountId - 工行账户ID
 * @returns {Promise<number|null>} - 返回余额或null
 */
exports.getAccountBalance = async (icbcAccountId) => {
    try {
        const response = await icbcApiClient.get(`/account/${icbcAccountId}/balance`);
        
        if (response.data.success && response.data.balance !== undefined) {
            return response.data.balance;
        }
        
        return null;
    } catch (error) {
        console.error('获取工行账户余额失败:', error);
        
        // 在开发环境下，返回模拟余额
        if (config.env === 'development') {
            return Math.floor(Math.random() * 100000) + 10000;
        }
        
        return null;
    }
};

/**
 * 发起工行支付请求
 * @param {string} fromAccountId - 付款方账户ID
 * @param {string} toAccountId - 收款方账户ID
 * @param {number} amount - 支付金额
 * @param {string} description - 支付描述
 * @returns {Promise<object|null>} - 返回支付结果或null
 */
exports.initiatePayment = async (fromAccountId, toAccountId, amount, description) => {
    try {
        const response = await icbcApiClient.post('/payment/initiate', {
            fromAccountId,
            toAccountId,
            amount,
            description,
            currency: 'CNY',
            timestamp: new Date().toISOString()
        });
        
        if (response.data.success && response.data.paymentId) {
            return {
                paymentId: response.data.paymentId,
                status: response.data.status,
                timestamp: response.data.timestamp,
                transactionId: response.data.transactionId
            };
        }
        
        return null;
    } catch (error) {
        console.error('发起工行支付请求失败:', error);
        
        // 在开发环境下，返回模拟支付结果
        if (config.env === 'development') {
            return {
                paymentId: 'PAY' + Date.now(),
                status: 'SUCCESS',
                timestamp: new Date().toISOString(),
                transactionId: 'TXN' + Date.now()
            };
        }
        
        return null;
    }
};

/**
 * 查询工行交易记录
 * @param {string} icbcAccountId - 工行账户ID
 * @param {object} filters - 过滤条件
 * @returns {Promise<Array>} - 返回交易记录列表
 */
exports.getTransactionHistory = async (icbcAccountId, filters = {}) => {
    try {
        const { startDate, endDate, type, page = 1, limit = 20 } = filters;
        
        const params = {
            accountId: icbcAccountId,
            startDate,
            endDate,
            type,
            page,
            limit
        };
        
        const response = await icbcApiClient.get('/transactions', { params });
        
        if (response.data.success && Array.isArray(response.data.transactions)) {
            return response.data.transactions;
        }
        
        return [];
    } catch (error) {
        console.error('查询工行交易记录失败:', error);
        
        // 在开发环境下，返回模拟交易记录
        if (config.env === 'development') {
            return [
                {
                    transactionId: 'TXN' + (Date.now() - 86400000),
                    type: 'DEBIT',
                    amount: 500.00,
                    description: '藏品购买',
                    timestamp: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    transactionId: 'TXN' + (Date.now() - 172800000),
                    type: 'CREDIT',
                    amount: 1000.00,
                    description: '工资入账',
                    timestamp: new Date(Date.now() - 172800000).toISOString()
                }
            ];
        }
        
        return [];
    }
};

/**
 * 生成工行扫码支付二维码
 * @param {string} merchantId - 商户ID
 * @param {number} amount - 支付金额
 * @param {string} orderId - 订单ID
 * @returns {Promise<string|null>} - 返回二维码图片URL或null
 */
exports.generateQrCode = async (merchantId, amount, orderId) => {
    try {
        const response = await icbcApiClient.post('/payment/qrcode/generate', {
            merchantId,
            amount,
            orderId,
            currency: 'CNY',
            expireTime: 300, // 有效期5分钟
            timestamp: new Date().toISOString()
        });
        
        if (response.data.success && response.data.qrCodeUrl) {
            return response.data.qrCodeUrl;
        }
        
        return null;
    } catch (error) {
        console.error('生成工行扫码支付二维码失败:', error);
        
        // 在开发环境下，返回模拟二维码URL
        if (config.env === 'development') {
            return 'https://example.com/qrcode?orderId=' + orderId;
        }
        
        return null;
    }
};

/**
 * 验证工行签名
 * @param {string} data - 需要验证的数据
 * @param {string} signature - 签名
 * @returns {Promise<boolean>} - 返回验证结果
 */
exports.verifySignature = async (data, signature) => {
    try {
        const response = await icbcApiClient.post('/security/verify-signature', {
            data,
            signature
        });
        
        return response.data.success && response.data.valid;
    } catch (error) {
        console.error('验证工行签名失败:', error);
        
        // 在开发环境下，返回模拟验证结果
        if (config.env === 'development') {
            return true;
        }
        
        return false;
    }
};

/**
 * 获取工行API状态
 * @returns {Promise<object>} - 返回API状态信息
 */
exports.getApiStatus = async () => {
    try {
        const response = await icbcApiClient.get('/status');
        
        if (response.data.success) {
            return {
                status: 'UP',
                version: response.data.version,
                uptime: response.data.uptime,
                timestamp: new Date().toISOString()
            };
        }
        
        return {
            status: 'DOWN',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('获取工行API状态失败:', error);
        
        // 在开发环境下，返回模拟状态
        if (config.env === 'development') {
            return {
                status: 'UP',
                version: '1.0.0',
                uptime: '86400',
                timestamp: new Date().toISOString()
            };
        }
        
        return {
            status: 'DOWN',
            timestamp: new Date().toISOString()
        };
    }
};