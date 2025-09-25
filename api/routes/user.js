// 用户路由定义 - MySQL版本

const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../../blockchain/utils/log-utils');
const bcrypt = require('bcryptjs');

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
        const userData = {
            ...user,
            password: undefined,
            salt: undefined
        };
        
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
        const userData = {
            ...user,
            password: undefined,
            salt: undefined
        };
        
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
        const { page = 1, limit = 10, role, status, search } = req.query;
        
        // 计算偏移量
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
        // 查询用户列表
        const users = await User.findAll(role, status, search, limitNum, offset);
        
        // 获取总记录数
        const total = await User.countAll(role, status, search);
        
        // 移除密码相关字段
        const usersData = users.map(user => ({
            ...user,
            password: undefined,
            salt: undefined
        }));
        
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
        const userData = {
            ...user,
            password: undefined,
            salt: undefined
        };
        
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
        const userData = {
            ...user,
            password: undefined,
            salt: undefined
        };
        
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

// 删除用户 - 仅超级管理员可访问
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
    try {
        // 不允许删除自己
        if (req.user.id === req.params.id) {
            logger.warn(`超级管理员尝试删除自身账号 [管理员ID: ${req.user.id}]`);
            return res.status(403).json({
                success: false,
                error: '权限不足',
                message: '不允许删除自身账号'
            });
        }
        
        const success = await User.deleteById(req.params.id);
        
        if (!success) {
            logger.warn(`超级管理员删除用户失败: 用户不存在 [用户ID: ${req.params.id}, 管理员ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        logger.info(`超级管理员删除用户成功 [用户ID: ${req.params.id}, 管理员ID: ${req.user.id}]`);
        
        res.status(200).json({
            success: true,
            message: '用户删除成功'
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
        
        // 计算偏移量
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
        // 查询用户拥有的藏品
        const collectibles = await User.findUserCollectibles(req.user.id, status, search, limitNum, offset);
        
        // 获取符合条件的藏品总数
        const total = await User.countUserCollectibles(req.user.id, status, search);
        
        logger.info(`用户获取藏品列表成功 [用户ID: ${req.user.id}]`);
        
        res.status(200).json({
            success: true,
            data: collectibles,
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