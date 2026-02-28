// 用户路由定义 - MySQL版本

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/user');
const Collectible = require('../models/collectible');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../../blockchain/utils/log-utils');
const bcrypt = require('bcryptjs');

const ACCOUNT_TYPES = ['PERSONAL', 'ENTERPRISE'];

const sanitizeUser = (user) => ({
    ...user,
    password: undefined,
    salt: undefined
});

const generateRandomString = (length = 10) =>
    crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();

const generateInitialPassword = () => `Welcome@${generateRandomString(6)}`;

const generateUniqueIcbcIdentifiers = async () => {
    let icbcAccountId;
    let icbcUserId;

    do {
        icbcAccountId = `ICBC-ACC-${generateRandomString(8)}`;
    } while (await User.existsByIcbcAccountId(icbcAccountId));

    do {
        icbcUserId = `ICBC-USER-${generateRandomString(8)}`;
    } while (await User.existsByIcbcUserId(icbcUserId));

    return { icbcAccountId, icbcUserId };
};

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            logger.warn(`未找到用户 [ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 移除密码相关字段
        const userData = sanitizeUser(user);
        
        logger.info(`用户获取自身信息成功 [ID: ${user.id}]`);
        
        res.status(200).json({
            success: true,
            data: userData
        });
    } catch (error) {
        logger.error(`获取用户信息失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '获取用户信息失败',
            message: '服务器内部错误'
        });
    }
});

// 更新当前用户信息
router.put('/me', authenticate, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            logger.warn(`更新用户信息失败: 用户不存在 [ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 更新字段
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        
        await user.save();
        
        // 移除密码相关字段
        const userData = sanitizeUser(user);
        
        logger.info(`用户更新自身信息成功 [ID: ${user.id}]`);
        
        res.status(200).json({
            success: true,
            message: '用户信息更新成功',
            data: userData
        });
    } catch (error) {
        logger.error(`更新用户信息失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '更新用户信息失败',
            message: '服务器内部错误'
        });
    }
});

// 更改用户密码
router.put('/me/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // 验证必填字段
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请提供当前密码和新密码'
            });
        }
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            logger.warn(`更改密码失败: 用户不存在 [ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 验证当前密码
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            logger.warn(`更改密码失败: 当前密码不正确 [用户ID: ${user.id}]`);
            return res.status(401).json({
                success: false,
                error: '密码错误',
                message: '当前密码不正确'
            });
        }
        
        // 哈希新密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // 更新密码
        user.password = hashedPassword;
        user.salt = salt;
        await user.save();
        
        logger.info(`用户更改密码成功 [ID: ${user.id}]`);
        
        res.status(200).json({
            success: true,
            message: '密码更改成功'
        });
    } catch (error) {
        logger.error(`更改密码失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '更改密码失败',
            message: '服务器内部错误'
        });
    }
});

// 获取用户列表 - 仅管理员可访问
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ICBC_ADMIN'), async (req, res) => {
    try {
        const { page = 1, limit = 10, role, status, search, accountType } = req.query;

        const normalizedAccountType = accountType ? accountType.toString().toUpperCase() : null;

        if (normalizedAccountType && !ACCOUNT_TYPES.includes(normalizedAccountType)) {
            return res.status(400).json({
                success: false,
                error: 'accountType参数无效',
                message: `accountType 必须是 ${ACCOUNT_TYPES.join(' 或 ')}`
            });
        }

        const parsedPage = Number(page);
        const parsedLimit = Number(limit);

        const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
        const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 10;
        const offset = (pageNum - 1) * limitNum;
        
        // 查询用户列表
    const users = await User.findAll(role, status, search, limitNum, offset, normalizedAccountType);
        
        // 获取总记录数
    const total = await User.countAll(role, status, search, normalizedAccountType);
        
        // 移除密码相关字段
        const usersData = users.map(sanitizeUser);
        
        logger.info(`管理员获取用户列表成功 [管理员ID: ${req.user.id}, 查询条件: role=${role}, status=${status}, search=${search}]`);
        
        res.status(200).json({
            success: true,
            data: usersData,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }
        });
    } catch (error) {
        logger.error(`获取用户列表失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '获取用户列表失败',
            message: '服务器内部错误'
        });
    }
});

// 获取单个用户详情 - 仅管理员可访问
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ICBC_ADMIN'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            logger.warn(`管理员获取用户详情失败: 用户不存在 [用户ID: ${req.params.id}, 管理员ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 移除密码相关字段
        const userData = sanitizeUser(user);
        
        logger.info(`管理员获取用户详情成功 [用户ID: ${user.id}, 管理员ID: ${req.user.id}]`);
        
        res.status(200).json({
            success: true,
            data: userData
        });
    } catch (error) {
        logger.error(`获取用户详情失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '获取用户详情失败',
            message: '服务器内部错误'
        });
    }
});

// 更新用户信息 - 仅管理员可访问
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ICBC_ADMIN'), async (req, res) => {
    try {
        const { name, email, phone, role, status } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            logger.warn(`管理员更新用户信息失败: 用户不存在 [用户ID: ${req.params.id}, 管理员ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 不允许管理员更改自己的角色为普通用户
        if (role && req.user.id === req.params.id && role !== req.user.role) {
            logger.warn(`管理员尝试更改自身角色为非管理员角色 [管理员ID: ${req.user.id}]`);
            return res.status(403).json({
                success: false,
                error: '权限不足',
                message: '不允许更改自身角色'
            });
        }
        
        // 更新字段
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (role) user.role = role;
        if (status) user.status = status;
        
        await user.save();
        
        // 移除密码相关字段
        const userData = sanitizeUser(user);
        
        logger.info(`管理员更新用户信息成功 [用户ID: ${user.id}, 管理员ID: ${req.user.id}]`);
        
        res.status(200).json({
            success: true,
            message: '用户信息更新成功',
            data: userData
        });
    } catch (error) {
        logger.error(`更新用户信息失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '更新用户信息失败',
            message: '服务器内部错误'
        });
    }
});

// 创建新用户 - 仅超级管理员可访问
router.post('/', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
    try {
        const { name, email, phone, accountType } = req.body;

        if (!name || !email || !accountType) {
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: 'name、email、accountType 为必填项'
            });
        }

        const normalizedAccountType = accountType.toString().toUpperCase();

        if (!ACCOUNT_TYPES.includes(normalizedAccountType)) {
            return res.status(400).json({
                success: false,
                error: 'accountType参数无效',
                message: `accountType 必须是 ${ACCOUNT_TYPES.join(' 或 ')}`
            });
        }

        const existingUser = await User.findByEmail(email);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: '邮箱已存在',
                message: '该邮箱已被使用'
            });
        }

        const { icbcAccountId, icbcUserId } = await generateUniqueIcbcIdentifiers();
        const initialPassword = generateInitialPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(initialPassword, salt);

        const role = normalizedAccountType === 'PERSONAL' ? 'USER' : 'BRAND_ADMIN';

        const newUser = new User({
            name,
            email,
            phone: phone || null,
            role,
            account_type: normalizedAccountType,
            icbc_account_id: icbcAccountId,
            icbc_user_id: icbcUserId,
            status: 'ACTIVE',
            password: hashedPassword,
            salt
        });

        await newUser.save();

        const savedUser = await User.findById(newUser.id);

        logger.info(`超级管理员创建新用户成功 [用户ID: ${newUser.id}, 账号类型: ${normalizedAccountType}, 管理员ID: ${req.user.id}]`);

        res.status(201).json({
            success: true,
            message: '用户创建成功',
            data: sanitizeUser(savedUser),
            initialPassword
        });
    } catch (error) {
        logger.error(`创建用户失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '创建用户失败',
            message: '服务器内部错误'
        });
    }
});

// 删除用户 - 仅超级管理员可访问
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
    try {
        if (req.user.id === req.params.id) {
            logger.warn(`超级管理员尝试删除自身账号 [管理员ID: ${req.user.id}]`);
            return res.status(403).json({
                success: false,
                error: '权限不足',
                message: '不允许删除自身账号'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            logger.warn(`超级管理员删除用户失败: 用户不存在 [用户ID: ${req.params.id}, 管理员ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }

        const collectibleIds = await User.findUserCollectibleIds(user.id);

        for (const collectibleId of collectibleIds) {
            try {
                const collectible = await Collectible.findById(collectibleId);

                if (collectible) {
                    await collectible.update(collectible.id, {
                        current_owner_id: null
                    });
                }

                await User.setCollectibleOwner(collectibleId, null);
            } catch (collectibleError) {
                logger.error(`回收用户藏品失败 [用户ID: ${user.id}, 藏品ID: ${collectibleId}] - ${collectibleError.message}`);
            }
        }

        const salt = await bcrypt.genSalt(10);
        const randomPassword = await bcrypt.hash(`DEACTIVATED-${generateRandomString(12)}`, salt);

        await User.deactivateUser(user.id, randomPassword, salt);

        logger.info(`超级管理员停用用户成功 [用户ID: ${user.id}, 管理员ID: ${req.user.id}]`);

        res.status(200).json({
            success: true,
            message: '用户已停用并回收所有藏品'
        });
    } catch (error) {
        logger.error(`删除用户失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '删除用户失败',
            message: '服务器内部错误'
        });
    }
});

// 获取用户拥有的藏品列表
router.get('/me/collectibles', authenticate, async (req, res) => {
    try {
    const { page = 1, limit = 10, status, search } = req.query;

    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const offset = (pageNum - 1) * limitNum;
        
        // 查询用户拥有的藏品
        const collectibles = await User.findUserCollectibles(
            req.user.id,
            status,
            search,
            limitNum,
            offset
        );
        const serializedCollectibles = collectibles.map((item) => {
            if (item instanceof Collectible) {
                return item.toJSON();
            }
            const collectible = new Collectible(item);
            return collectible.toJSON();
        });
        
        // 获取符合条件的藏品总数
        const total = await User.countUserCollectibles(
            req.user.id,
            status,
            search
        );
        
        logger.info(`用户获取藏品列表成功 [用户ID: ${req.user.id}]`);
        
        res.status(200).json({
            success: true,
            data: serializedCollectibles,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }
        });
    } catch (error) {
        logger.error(`获取用户藏品列表失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '获取藏品列表失败',
            message: '服务器内部错误'
        });
    }
});

module.exports = router;