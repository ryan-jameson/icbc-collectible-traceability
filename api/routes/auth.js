// 认证路由定义

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const logger = require('../../blockchain/utils/log-utils');
const icbcService = require('../services/icbcService');
const icbcLoginSession = require('../services/icbcLoginSession');

const normalizeAccountType = (accountType, fallback = 'PERSONAL') => {
    const upper = (accountType || '').toString().toUpperCase();
    if (upper === 'ENTERPRISE') {
        return 'ENTERPRISE';
    }
    if (upper === 'PERSONAL') {
        return 'PERSONAL';
    }
    return fallback;
};

const TEST_LOGIN_EMAILS = {
    PERSONAL: process.env.TEST_PERSONAL_LOGIN_EMAIL || 'user@example.com',
    ENTERPRISE: process.env.TEST_ENTERPRISE_LOGIN_EMAIL || 'enterprise@example.com'
};

const formatUserResponse = (user) => {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountType: user.accountType,
        icbcAccountId: user.icbcAccountId,
        icbcUserId: user.icbcUserId,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
};

const resolveFrontendLoginBaseUrl = () => {
    const candidates = [
        process.env.ICBC_LOGIN_QR_BASE_URL,
        process.env.FRONTEND_BASE_URL,
        process.env.APP_FRONTEND_URL,
        process.env.PUBLIC_FRONTEND_URL,
        process.env.VITE_PUBLIC_URL,
        process.env.REACT_APP_PUBLIC_URL
    ].filter(Boolean);

    const base = candidates.length > 0 ? candidates[0] : 'http://localhost:5173';
    return base.endsWith('/') ? base.slice(0, -1) : base;
};

const createError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const generateUserToken = (user) => jwt.sign(
    { id: user.id, role: user.role, accountType: user.accountType },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
);

const ensureTestUserExists = async (normalizedAccountType) => {
    let user = await User.findFirstByAccountType(normalizedAccountType, 'USER');
    if (user) {
        return user;
    }

    const fallbackEmailCandidate = TEST_LOGIN_EMAILS[normalizedAccountType];
    if (fallbackEmailCandidate) {
        const existingFallbackUser = await User.findByEmail(fallbackEmailCandidate);
        if (existingFallbackUser) {
            return existingFallbackUser;
        }
    }

    const seedInfo = buildFallbackIcbcUserInfo(normalizedAccountType);
    let finalEmail = fallbackEmailCandidate || seedInfo.email || `${normalizedAccountType.toLowerCase()}_${Date.now()}@example.com`;

    const duplicate = await User.findByEmail(finalEmail);
    if (duplicate) {
        finalEmail = seedInfo.email || `${normalizedAccountType.toLowerCase()}_${Date.now()}@example.com`;
    }

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = process.env.TEST_USER_DEFAULT_PASSWORD || 'icbcLogin123!';
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const newUser = new User({
        name: seedInfo.name || (normalizedAccountType === 'ENTERPRISE' ? '企业测试用户' : '个人测试用户'),
        email: finalEmail,
        phone: seedInfo.phone || null,
        icbc_account_id: seedInfo.icbcAccountId || `ICBC${Date.now()}`,
        icbc_user_id: seedInfo.icbcUserId || `ICBCUSER${Date.now()}`,
        password: hashedPassword,
        salt,
        role: 'USER',
        account_type: normalizedAccountType,
        status: 'ACTIVE'
    });

    await newUser.save();
    logger.info(`自动创建测试登录用户 [ID: ${newUser.id}, 类型: ${normalizedAccountType}, 邮箱: ${newUser.email}]`);

    return newUser;
};

const resolveTestUserByAccountType = async (normalizedAccountType) => ensureTestUserExists(normalizedAccountType);

const buildFallbackIcbcUserInfo = (normalizedAccountType, seed = '') => {
    const suffixSeed = seed ? seed.toString().slice(-6) : Math.random().toString(36).slice(2, 8);
    return {
        icbcUserId: `ICBC${Date.now()}`,
        icbcAccountId: `ICBC${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`,
        name: normalizedAccountType === 'ENTERPRISE' ? '企业客户' : '个人客户',
        email: `${normalizedAccountType.toLowerCase()}_${suffixSeed}@example.com`,
        phone: '138' + Math.random().toString().slice(2, 10)
    };
};

const fetchIcbcUserInfo = async (normalizedAccountType, icbcToken = null) => {
    if (icbcToken) {
        try {
            const info = await icbcService.authenticateWithIcbc(icbcToken);
            if (info) {
                return info;
            }
        } catch (error) {
            logger.error(`工行认证令牌校验失败: ${error.message}`, error);
        }
    }

    return buildFallbackIcbcUserInfo(normalizedAccountType, icbcToken || undefined);
};

const syncUserProfileWithIcbcInfo = async (user, normalizedAccountType, icbcUserInfo = {}) => {
    let shouldPersist = false;

    if (normalizedAccountType && user.accountType !== normalizedAccountType) {
        user.accountType = normalizedAccountType;
        shouldPersist = true;
    }

    if (icbcUserInfo.icbcAccountId && !user.icbcAccountId) {
        user.icbcAccountId = icbcUserInfo.icbcAccountId;
        shouldPersist = true;
    }

    if (icbcUserInfo.icbcUserId && !user.icbcUserId) {
        user.icbcUserId = icbcUserInfo.icbcUserId;
        shouldPersist = true;
    }

    if (icbcUserInfo.phone && !user.phone) {
        user.phone = icbcUserInfo.phone;
        shouldPersist = true;
    }

    if (icbcUserInfo.name && !user.name) {
        user.name = icbcUserInfo.name;
        shouldPersist = true;
    }

    if (shouldPersist) {
        await user.save();
    }

    return user;
};

const completeIcbcLoginFlow = async (normalizedAccountType, { icbcToken = null, icbcUserInfo = null, testUserId = null } = {}) => {
    let resolvedUser = null;

    if (testUserId) {
        resolvedUser = await User.findById(testUserId);
        if (!resolvedUser) {
            throw createError('ICBC_TEST_USER_NOT_FOUND', `未找到ID为 ${testUserId} 的用户`);
        }
        if (resolvedUser.role !== 'USER') {
            throw createError('ICBC_TEST_USER_ROLE_INVALID', '仅支持以客户身份模拟授权，请选择客户角色的用户ID');
        }
    } else {
        resolvedUser = await resolveTestUserByAccountType(normalizedAccountType);
    }

    const resolvedIcbcUserInfo = icbcUserInfo || await fetchIcbcUserInfo(normalizedAccountType, icbcToken);

    await syncUserProfileWithIcbcInfo(resolvedUser, normalizedAccountType, resolvedIcbcUserInfo);
    await User.updateLastLogin(resolvedUser.id);

    const refreshedUser = await User.findById(resolvedUser.id);
    const token = generateUserToken(refreshedUser);

    return {
        user: refreshedUser,
        token,
        icbcUserInfo: resolvedIcbcUserInfo
    };
};

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            role,
            icbcAccountNumber,
            phone,
            accountType
        } = req.body;

        if (!username || !email || !password || !role || !icbcAccountNumber) {
            logger.warn('用户注册失败: 缺少必要字段');
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请填写所有必填字段'
            });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            logger.warn(`用户注册失败: 用户已存在 [邮箱: ${email}]`);
            return res.status(400).json({
                success: false,
                error: '用户已存在',
                message: '该邮箱已被注册'
            });
        }

        const existingAccount = await User.findByIcbcAccountId(icbcAccountNumber);
        if (existingAccount) {
            logger.warn(`用户注册失败: 工行账户已绑定 [账户: ${icbcAccountNumber}]`);
            return res.status(400).json({
                success: false,
                error: '工行账户已绑定',
                message: '该工行账户已绑定到其他用户'
            });
        }

        // TODO: 集成实际的工行账户校验逻辑

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const generatedIcbcUserId = `ICBCUSER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const normalizedAccountType = normalizeAccountType(accountType, role === 'USER' ? 'PERSONAL' : 'ENTERPRISE');

        const newUser = new User({
            name: username,
            email,
            phone: phone || null,
            icbc_account_id: icbcAccountNumber,
            icbc_user_id: generatedIcbcUserId,
            password: hashedPassword,
            salt,
            role,
            account_type: normalizedAccountType,
            status: 'ACTIVE'
        });

        await newUser.save();

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role, accountType: newUser.accountType },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        logger.info(`用户注册成功 [ID: ${newUser.id}, 用户名: ${username}, 邮箱: ${email}, 角色: ${role}]`);

        res.status(201).json({
            success: true,
            message: '用户注册成功',
            data: {
                user: formatUserResponse(newUser),
                token
            }
        });
    } catch (error) {
        logger.error(`用户注册失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '注册失败',
            message: error.message || '未知错误'
        });
    }
});

// 通用登录处理函数
const performLogin = async (req, res, allowedRoles = null) => {
    try {
        const { email, password } = req.body;
        
        // 验证必填字段
        if (!email || !password) {
            logger.warn('用户登录失败: 缺少必要字段');
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请提供邮箱和密码'
            });
        }
        
        // 查找用户
        const foundUser = await User.findByEmail(email);
        
        if (!foundUser) {
            logger.warn(`用户登录失败: 用户不存在 [邮箱: ${email}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '邮箱或密码错误'
            });
        }
        
        // 检查用户是否被禁用
        if (foundUser.status !== 'ACTIVE') {
            logger.warn(`用户登录失败: 用户已被禁用 [邮箱: ${email}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '您的账户已被禁用'
            });
        }

        if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(foundUser.role)) {
            logger.warn(`用户登录失败: 角色不允许登录此端点 [邮箱: ${email}, 角色: ${foundUser.role}]`);
            return res.status(403).json({
                success: false,
                error: '权限不足',
                message: '当前登录入口不适用于您的角色'
            });
        }
        
        // 验证密码
        const isMatch = await bcrypt.compare(password, foundUser.password);
        
        if (!isMatch) {
            logger.warn(`用户登录失败: 密码错误 [邮箱: ${email}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '邮箱或密码错误'
            });
        }
        
        // 生成令牌
        const token = jwt.sign(
            { id: foundUser.id, role: foundUser.role, accountType: foundUser.accountType },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        logger.info(`用户登录成功 [ID: ${foundUser.id}, 用户名: ${foundUser.name}, 邮箱: ${email}]`);

        return res.status(200).json({
            success: true,
            message: '登录成功',
            data: {
                user: formatUserResponse(foundUser),
                token
            }
        });
    } catch (error) {
        logger.error(`用户登录失败: ${error.message} [邮箱: ${req.body?.email}]`, error);
        return res.status(500).json({
            success: false,
            error: '登录失败',
            message: error.message || '未知错误'
        });
    }
};

// 用户登录（通用）
router.post('/login', (req, res) => performLogin(req, res));

// 管理员登录
router.post('/admin/login', (req, res) =>
    performLogin(req, res, ['SUPER_ADMIN', 'ICBC_ADMIN', 'BRAND_ADMIN'])
);

// 客户登录
router.post('/client/login', (req, res) =>
    performLogin(req, res, ['USER'])
);

// 创建工行扫码登录会话
router.post('/login/icbc/init', async (req, res) => {
    try {
        const { accountType } = req.body;
        const normalizedAccountType = normalizeAccountType(accountType, 'PERSONAL');

        const session = icbcLoginSession.createSession({ accountType: normalizedAccountType });
        const baseUrl = resolveFrontendLoginBaseUrl();
        const qrContent = `${baseUrl}/icbc-authorize?sessionId=${session.sessionId}`;

        logger.info(`创建工行扫码登录会话成功 [Session: ${session.sessionId}, AccountType: ${normalizedAccountType}]`);

        return res.status(201).json({
            success: true,
            data: {
                ...session,
                accountType: normalizedAccountType,
                qrContent
            }
        });
    } catch (error) {
        logger.error(`创建工行扫码登录会话失败: ${error.message}`, error);
        return res.status(500).json({
            success: false,
            error: 'CREATE_SESSION_FAILED',
            message: error.message || '创建扫码登录会话失败'
        });
    }
});

// 查询工行扫码登录会话状态
router.get('/login/icbc/status', async (req, res) => {
    try {
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_SESSION_ID',
                message: '请提供 sessionId'
            });
        }

        const session = icbcLoginSession.getSession(sessionId, { includeSensitive: true });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'SESSION_NOT_FOUND',
                message: '扫码登录会话不存在或已过期'
            });
        }

        if (session.status === 'AUTHORIZED' && session.token && session.user) {
            const payload = icbcLoginSession.consumeAuthorizedSession(sessionId);
            if (!payload) {
                return res.status(200).json({
                    success: true,
                    data: {
                        status: 'AUTHORIZED_PENDING',
                        accountType: session.accountType
                    }
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    status: 'AUTHORIZED',
                    token: payload.token,
                    user: payload.user,
                    accountType: payload.accountType
                }
            });
        }

        if (session.status === 'EXPIRED') {
            icbcLoginSession.clearSession(sessionId);
            return res.status(200).json({
                success: true,
                data: {
                    status: 'EXPIRED',
                    accountType: session.accountType
                }
            });
        }

        if (session.status === 'FAILED') {
            icbcLoginSession.clearSession(sessionId);
            return res.status(200).json({
                success: true,
                data: {
                    status: 'FAILED',
                    accountType: session.accountType,
                    error: session.error || 'UNKNOWN_ERROR',
                    errorMessage: session.errorMessage || null
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                status: session.status,
                accountType: session.accountType,
                createdAt: new Date(session.createdAt).toISOString(),
                expiresAt: new Date(session.expiresAt).toISOString()
            }
        });
    } catch (error) {
        logger.error(`查询工行扫码登录状态失败: ${error.message}`, error);
        return res.status(500).json({
            success: false,
            error: 'SESSION_STATUS_FAILED',
            message: error.message || '查询扫码登录状态失败'
        });
    }
});

// 手机端授权确认
router.post('/login/icbc/authorize', async (req, res) => {
    const { sessionId, icbcToken, testUserId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_SESSION_ID',
            message: '请提供 sessionId'
        });
    }

    const session = icbcLoginSession.getSession(sessionId, { includeSensitive: true });

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'SESSION_NOT_FOUND',
            message: '扫码登录会话不存在或已过期'
        });
    }

    if (session.status === 'AUTHORIZED') {
        return res.status(200).json({
            success: true,
            message: '已完成授权',
            data: {
                status: 'AUTHORIZED',
                accountType: session.accountType
            }
        });
    }

    if (session.status === 'EXPIRED') {
        icbcLoginSession.clearSession(sessionId);
        return res.status(410).json({
            success: false,
            error: 'SESSION_EXPIRED',
            message: '二维码已过期，请重新扫码'
        });
    }

    try {
    const normalizedAccountType = normalizeAccountType(session.accountType, 'PERSONAL');
    const { user, token } = await completeIcbcLoginFlow(normalizedAccountType, { icbcToken, testUserId });

        icbcLoginSession.markAuthorized(sessionId, {
            token,
            user: formatUserResponse(user)
        });

        logger.info(`工行扫码授权成功 [Session: ${sessionId}, AccountType: ${normalizedAccountType}, UserID: ${user.id}]`);

        return res.status(200).json({
            success: true,
            message: '授权成功，请返回电脑端继续',
            data: {
                status: 'AUTHORIZED',
                accountType: normalizedAccountType
            }
        });
    } catch (error) {
        logger.error(`工行扫码授权失败 [Session: ${sessionId}]: ${error.message}`, error);
        icbcLoginSession.markFailed(sessionId, error.code || 'AUTHORIZE_FAILED', error.message);

        if (error.code === 'ICBC_TEST_USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: error.code,
                message: error.message
            });
        }

        if (error.code === 'ICBC_TEST_USER_ROLE_INVALID') {
            return res.status(400).json({
                success: false,
                error: error.code,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            error: error.code || 'AUTHORIZE_FAILED',
            message: error.message || '扫码授权失败'
        });
    }
});

// 工行一键登录
router.post('/login/icbc', async (req, res) => {
    try {
        const { icbcToken, accountType } = req.body;

        if (!icbcToken) {
            logger.warn('工行一键登录失败: 缺少工行令牌');
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请提供工行令牌'
            });
        }

        const normalizedAccountType = normalizeAccountType(accountType, 'PERSONAL');
        const { user, token } = await completeIcbcLoginFlow(normalizedAccountType, { icbcToken });

        logger.info(`工行一键登录成功 [ID: ${user.id}, 账户类型: ${normalizedAccountType}]`);

        return res.status(200).json({
            success: true,
            message: '工行一键登录成功',
            data: {
                user: formatUserResponse(user),
                token
            }
        });
    } catch (error) {
        logger.error(`工行一键登录失败: ${error.message}`, error);
        if (error.code === 'ICBC_TEST_USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: error.code,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            error: '工行一键登录失败',
            message: error.message || '未知错误'
        });
    }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
    try {
        const foundUser = await User.findById(req.user.id);
        
        if (!foundUser) {
            logger.warn(`获取用户信息失败: 用户不存在 [ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 移除密码字段
        delete foundUser.password;

        logger.info(`获取用户信息成功 [ID: ${foundUser.id}, 用户名: ${foundUser.name}]`);

        res.status(200).json({
            success: true,
            data: formatUserResponse(foundUser)
        });
    } catch (error) {
        logger.error(`获取用户信息失败: ${error.message} [用户ID: ${req.user?.id}]`, error);
        res.status(500).json({
            success: false,
            error: '获取用户信息失败',
            message: error.message || '未知错误'
        });
    }
});

// 刷新令牌
router.post('/refresh', authenticate, async (req, res) => {
    try {
        const foundUser = await User.findById(req.user.id);
        
        if (!foundUser) {
            logger.warn(`刷新令牌失败: 用户不存在 [ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 检查用户是否被禁用
        if (foundUser.status !== 'ACTIVE') {
            logger.warn(`刷新令牌失败: 用户已被禁用 [ID: ${req.user.id}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '您的账户已被禁用'
            });
        }
        
        // 生成新令牌
        const token = jwt.sign(
            { id: foundUser.id, role: foundUser.role, accountType: foundUser.accountType },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        logger.info(`刷新令牌成功 [ID: ${foundUser.id}, 用户名: ${foundUser.name}]`);

        res.status(200).json({
            success: true,
            message: '令牌刷新成功',
            data: {
                user: formatUserResponse(foundUser),
                token
            }
        });
    } catch (error) {
        logger.error(`刷新令牌失败: ${error.message} [用户ID: ${req.user?.id}]`, error);
        res.status(500).json({
            success: false,
            error: '刷新令牌失败',
            message: error.message || '未知错误'
        });
    }
});

// 注销登录
router.post('/logout', authenticate, async (req, res) => {
    try {
        // 注意: 在实际应用中，你可能需要实现一个令牌黑名单或令牌失效机制
        // 这里仅作为示例，实际上前端应该删除本地存储的令牌
        
    logger.info(`用户注销成功 [ID: ${req.user.id}, 用户名: ${req.user.name || req.user.email}]`);
        
        res.status(200).json({
            success: true,
            message: '注销成功'
        });
    } catch (error) {
        logger.error(`用户注销失败: ${error.message} [用户ID: ${req.user?.id}]`, error);
        res.status(500).json({
            success: false,
            error: '注销失败',
            message: error.message || '未知错误'
        });
    }
});

module.exports = router;