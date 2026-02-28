// 认证中间件

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const logger = require('../../blockchain/utils/log-utils');

// 认证中间件
exports.authenticate = async (req, res, next) => {
    try {
        // 从请求头获取令牌
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            logger.warn('认证失败: 未提供认证令牌');
            return res.status(401).json({
                error: '未提供认证令牌',
                message: '请先登录'
            });
        }

        // 验证令牌
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (error) {
            logger.warn(`认证失败: 无效的认证令牌 - ${error.message}`);
            return res.status(401).json({
                error: '无效的认证令牌',
                message: '请重新登录'
            });
        }

        // 查找用户
        const user = await User.findById(decoded.id);
        
        if (!user) {
            logger.warn(`认证失败: 用户不存在 [用户ID: ${decoded.id}]`);
            return res.status(401).json({
                error: '用户不存在',
                message: '请重新登录'
            });
        }

        // 检查用户状态
        if (user.status !== 'ACTIVE') {
            logger.warn(`认证失败: 用户账号不可用 [用户ID: ${user.id}, 状态: ${user.status}]`);
            return res.status(403).json({
                error: '用户账号不可用',
                message: '请联系管理员'
            });
        }

        // 将用户和令牌信息添加到请求对象
        req.user = user;
        req.token = token;
        
    logger.info(`认证成功 [用户ID: ${user.id}, 用户名: ${user.name || user.email}, 角色: ${user.role}, 类型: ${user.accountType}]`);

        // 继续处理请求
        next();
    } catch (error) {
        logger.error(`认证过程发生错误: ${error.message}`, error);
        res.status(500).json({
            error: '认证失败',
            message: error.message || '未知错误'
        });
    }
};

// 角色权限验证中间件
exports.authorize = (...roles) => {
    return (req, res, next) => {
        try {
            // 检查用户角色是否在允许的角色列表中
            if (!roles.includes(req.user.role)) {
                logger.warn(`授权失败: 权限不足 [用户ID: ${req.user.id}, 角色: ${req.user.role}, 需要角色: ${roles.join(', ')}]`);
                return res.status(403).json({
                    error: '权限不足',
                    message: '您没有权限执行此操作'
                });
            }

            logger.info(`授权成功 [用户ID: ${req.user.id}, 角色: ${req.user.role}, 允许角色: ${roles.join(', ')}]`);
            
            // 继续处理请求
            next();
        } catch (error) {
            logger.error(`授权过程发生错误: ${error.message} [用户ID: ${req.user?.id}]`, error);
            res.status(500).json({
                error: '授权失败',
                message: error.message || '未知错误'
            });
        }
    };
};

// 工行认证中间件
exports.icbcAuthenticate = async (req, res, next) => {
    try {
        // 优先尝试使用现有的Bearer令牌（用户已登录的场景）
        const bearerToken = req.header('Authorization')?.replace('Bearer ', '');
        if (bearerToken) {
            try {
                const decoded = jwt.verify(bearerToken, process.env.JWT_SECRET || 'your-secret-key');
                const bearerUser = await User.findById(decoded.id);

                if (bearerUser && bearerUser.status === 'ACTIVE') {
                    req.user = bearerUser;
                    req.token = bearerToken;

                    logger.info(`工行认证成功: 使用现有会话 [用户ID: ${bearerUser.id}, 角色: ${bearerUser.role}]`);
                    return next();
                }
            } catch (bearerError) {
                logger.warn(`工行认证: Bearer令牌验证失败 [原因: ${bearerError.message}]`);
            }
        }

        // 实际实现中，这里应该调用工行的认证API进行验证
        // 这里简化处理，假设请求头中包含工行的认证信息

        const icbcToken = req.header('X-ICBC-Auth');

        if (!icbcToken) {
            logger.warn('工行认证失败: 未提供工行认证信息');
            return res.status(401).json({
                error: '未提供工行认证信息',
                message: '请使用工行App进行认证'
            });
        }

        // 验证工行令牌（简化实现）
        const isVerified = await verifyIcbcToken(icbcToken);

        if (!isVerified) {
            logger.warn(`工行认证失败: 无效的工行令牌 [令牌前几位: ${icbcToken.substring(0, 5)}...]`);
            return res.status(401).json({
                error: '工行认证失败',
                message: '请重新使用工行App进行认证'
            });
        }

        // 假设从工行认证信息中获取用户ID
        const icbcUserId = extractIcbcUserId(icbcToken);

        if (!icbcUserId) {
            logger.warn(`工行认证失败: 无法获取工行用户ID [令牌前几位: ${icbcToken.substring(0, 5)}...]`);
            return res.status(401).json({
                error: '无法获取工行用户ID',
                message: '认证信息无效'
            });
        }

        // 查找或创建本地用户
        let user = await User.findByIcbcUserId(icbcUserId);

        if (!user) {
            // 从工行API获取用户信息（简化实现）
            const icbcUserInfo = await getIcbcUserInfo(icbcToken);

            // 创建新用户
            user = new User({
                name: icbcUserInfo.name || '工行用户',
                email: icbcUserInfo.email || `${icbcUserId}@icbc.com`,
                icbc_account_id: icbcUserInfo.accountId,
                icbc_user_id: icbcUserId,
                password: Math.random().toString(36).substring(2), // 随机密码
                role: 'USER',
                account_type: 'PERSONAL',
                status: 'ACTIVE'
            });

            await user.save();

            logger.info(`工行认证成功: 创建新用户 [工行用户ID: ${icbcUserId}, 本地用户ID: ${user.id}]`);
        } else {
            // 更新最后登录时间
            await User.updateLastLogin(user.id);
            user.lastLogin = new Date();

            logger.info(`工行认证成功: 用户登录 [工行用户ID: ${icbcUserId}, 本地用户ID: ${user.id}]`);
        }

        // 将用户信息添加到请求对象
        req.user = user;

        // 继续处理请求
        next();
    } catch (error) {
        logger.error(`工行认证过程发生错误: ${error.message}`, error);
        res.status(500).json({
            error: '工行认证失败',
            message: error.message || '未知错误'
        });
    }
};

// 内部方法：验证工行令牌（模拟实现）
async function verifyIcbcToken(token) {
    try {
        // 实际实现中应该调用工行的认证API
        logger.debug(`验证工行令牌: ${token.substring(0, 5)}...`);
        return token.length > 10; // 简化判断
    } catch (error) {
        logger.error(`验证工行令牌时发生错误: ${error.message}`, error);
        return false;
    }
}

// 内部方法：从工行令牌中提取用户ID（模拟实现）
function extractIcbcUserId(token) {
    try {
        // 实际实现中应该解析令牌获取用户ID
        logger.debug(`从工行令牌中提取用户ID: ${token.substring(0, 5)}...`);
        return token.substring(0, 10); // 简化处理
    } catch (error) {
        logger.error(`从工行令牌提取用户ID时发生错误: ${error.message}`, error);
        return null;
    }
}

// 内部方法：获取工行用户信息（模拟实现）
async function getIcbcUserInfo(token) {
    try {
        // 实际实现中应该调用工行的用户信息API
        logger.debug(`获取工行用户信息: ${token.substring(0, 5)}...`);
        return {
            name: '工行用户' + Math.random().toString(36).substring(2, 8),
            email: 'user' + Math.random().toString(36).substring(2, 8) + '@icbc.com',
            accountId: 'ICBC' + Math.random().toString(36).substring(2, 10)
        };
    } catch (error) {
        logger.error(`获取工行用户信息时发生错误: ${error.message}`, error);
        throw error;
    }
}