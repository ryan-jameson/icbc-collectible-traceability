// 认证路由定义

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const logger = require('../../blockchain/utils/log-utils');

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const { 
            username, 
            email, 
            password, 
            role, 
            icbcAccountNumber 
        } = req.body;
        
        // 验证必填字段
        if (!username || !email || !password || !role || !icbcAccountNumber) {
            logger.warn('用户注册失败: 缺少必要字段');
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请填写所有必填字段'
            });
        }
        
        // 检查用户是否已存在
        const user = new User();
        const existingUser = await user.findByEmailOrUsername(email, username);
        
        if (existingUser) {
            logger.warn(`用户注册失败: 用户已存在 [邮箱: ${email}, 用户名: ${username}]`);
            return res.status(400).json({
                success: false,
                error: '用户已存在',
                message: '该邮箱或用户名已被注册'
            });
        }
        
        // 验证工行账户
        // 注意: 这里应该是一个与工行API的实际集成
        const isIcbcAccountValid = true; // 假设所有账户都有效，实际应用中需要调用工行API验证
        
        if (!isIcbcAccountValid) {
            logger.warn(`用户注册失败: 工行账户验证失败 [账户: ${icbcAccountNumber}]`);
            return res.status(400).json({
                success: false,
                error: '工行账户验证失败',
                message: '您提供的工行账户无效'
            });
        }
        
        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 创建新用户
        const userId = await user.save({
            username,
            email,
            password: hashedPassword,
            role,
            icbcAccountNumber,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        // 获取完整的用户信息
        const newUser = await user.findById(userId);
        
        // 生成令牌
        const token = jwt.sign(
            { id: userId, role: role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        logger.info(`用户注册成功 [ID: ${userId}, 用户名: ${username}, 邮箱: ${email}, 角色: ${role}]`);
        
        res.status(201).json({
            success: true,
            message: '用户注册成功',
            data: {
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role,
                    icbcAccountNumber: newUser.icbcAccountNumber
                },
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

// 用户登录
router.post('/login', async (req, res) => {
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
        const user = new User();
        const foundUser = await user.findByEmail(email);
        
        if (!foundUser) {
            logger.warn(`用户登录失败: 用户不存在 [邮箱: ${email}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '邮箱或密码错误'
            });
        }
        
        // 检查用户是否被禁用
        if (!foundUser.active) {
            logger.warn(`用户登录失败: 用户已被禁用 [邮箱: ${email}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '您的账户已被禁用'
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
            { id: foundUser.id, role: foundUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        logger.info(`用户登录成功 [ID: ${foundUser.id}, 用户名: ${foundUser.username}, 邮箱: ${email}]`);
        
        res.status(200).json({
            success: true,
            message: '登录成功',
            data: {
                user: {
                    id: foundUser.id,
                    username: foundUser.username,
                    email: foundUser.email,
                    role: foundUser.role,
                    icbcAccountNumber: foundUser.icbcAccountNumber
                },
                token
            }
        });
    } catch (error) {
        logger.error(`用户登录失败: ${error.message} [邮箱: ${req.body?.email}]`, error);
        res.status(500).json({
            success: false,
            error: '登录失败',
            message: error.message || '未知错误'
        });
    }
});

// 工行一键登录
router.post('/login/icbc', async (req, res) => {
    try {
        const { icbcToken, role } = req.body;
        
        // 验证必填字段
        if (!icbcToken) {
            logger.warn('工行一键登录失败: 缺少工行令牌');
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请提供工行令牌'
            });
        }
        
        // 验证工行令牌
        // 注意: 这里应该是一个与工行API的实际集成
        const icbcUserInfo = {
            email: 'icbc_' + Math.random().toString(36).substr(2, 9) + '@example.com',
            username: 'icbc_user_' + Math.random().toString(36).substr(2, 9),
            icbcAccountNumber: 'ICBC' + Math.floor(Math.random() * 10000000000).toString()
        };
        
        // 查找或创建用户
        const user = new User();
        let foundUser = await user.findByEmail(icbcUserInfo.email);
        
        if (!foundUser) {
            // 创建新用户
            const randomPassword = Math.random().toString(36).substring(2, 10);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);
            
            const userId = await user.save({
                username: icbcUserInfo.username,
                email: icbcUserInfo.email,
                password: hashedPassword,
                role: role || 'USER',
                icbcAccountNumber: icbcUserInfo.icbcAccountNumber,
                active: true,
                isIcbcAccount: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            foundUser = await user.findById(userId);
            
            logger.info(`工行一键登录 - 新用户创建成功 [ID: ${userId}, 邮箱: ${icbcUserInfo.email}]`);
        } else {
            logger.info(`工行一键登录 - 用户登录成功 [ID: ${foundUser.id}, 邮箱: ${icbcUserInfo.email}]`);
        }
        
        // 生成令牌
        const token = jwt.sign(
            { id: foundUser.id, role: foundUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.status(200).json({
            success: true,
            message: '工行一键登录成功',
            data: {
                user: {
                    id: foundUser.id,
                    username: foundUser.username,
                    email: foundUser.email,
                    role: foundUser.role,
                    icbcAccountNumber: foundUser.icbcAccountNumber
                },
                token
            }
        });
    } catch (error) {
        logger.error(`工行一键登录失败: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: '工行一键登录失败',
            message: error.message || '未知错误'
        });
    }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = new User();
        const foundUser = await user.findById(req.user.id);
        
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
        
        logger.info(`获取用户信息成功 [ID: ${foundUser.id}, 用户名: ${foundUser.username}]`);
        
        res.status(200).json({
            success: true,
            data: foundUser
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
        const user = new User();
        const foundUser = await user.findById(req.user.id);
        
        if (!foundUser) {
            logger.warn(`刷新令牌失败: 用户不存在 [ID: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定用户'
            });
        }
        
        // 检查用户是否被禁用
        if (!foundUser.active) {
            logger.warn(`刷新令牌失败: 用户已被禁用 [ID: ${req.user.id}]`);
            return res.status(401).json({
                success: false,
                error: '认证失败',
                message: '您的账户已被禁用'
            });
        }
        
        // 生成新令牌
        const token = jwt.sign(
            { id: foundUser.id, role: foundUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        logger.info(`刷新令牌成功 [ID: ${foundUser.id}, 用户名: ${foundUser.username}]`);
        
        res.status(200).json({
            success: true,
            message: '令牌刷新成功',
            data: {
                user: {
                    id: foundUser.id,
                    username: foundUser.username,
                    email: foundUser.email,
                    role: foundUser.role
                },
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
        
        logger.info(`用户注销成功 [ID: ${req.user.id}, 用户名: ${req.user.username}]`);
        
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