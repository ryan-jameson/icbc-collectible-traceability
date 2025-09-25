// 品牌路由定义

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const Brand = require('../models/brand');
const logger = require('../../blockchain/utils/log-utils');

// 创建品牌 - 需要工行管理员或超级管理员权限
router.post('/', authenticate, authorize('ICBC_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { 
            name, 
            logo, 
            description, 
            contactPerson, 
            contactEmail, 
            contactPhone, 
            icbcContractId,
            blockchainIdentity,
            cooperationStatus 
        } = req.body;
        
        // 验证必填字段
        if (!name || !icbcContractId || !blockchainIdentity) {
            logger.warn(`创建品牌失败: 缺少必要字段 [用户: ${req.user._id}]`);
            return res.status(400).json({
                success: false,
                error: '缺少必要字段',
                message: '请填写品牌名称、工行合同编号和区块链身份标识'
            });
        }
        
        // 检查品牌是否已存在
        const existingBrand = await Brand.findOne({ 
            $or: [{ name }, { blockchainIdentity }]
        });
        
        if (existingBrand) {
            logger.warn(`创建品牌失败: 品牌已存在 [名称: ${name}, 区块链身份: ${blockchainIdentity}, 用户: ${req.user._id}]`);
            return res.status(400).json({
                success: false,
                error: '品牌已存在',
                message: '该品牌名称或区块链身份标识已存在'
            });
        }
        
        // 创建新品牌
        const brand = new Brand({
            name,
            logo,
            description,
            contactPerson,
            contactEmail,
            contactPhone,
            icbcContractId,
            blockchainIdentity,
            cooperationStatus: cooperationStatus || 'PENDING',
            createdBy: req.user._id,
            updatedBy: req.user._id
        });
        
        await brand.save();
        
        logger.info(`品牌创建成功 [ID: ${brand._id}, 名称: ${name}, 用户: ${req.user._id}]`);
        
        res.status(201).json({
            success: true,
            message: '品牌创建成功',
            data: brand
        });
    } catch (error) {
        logger.error(`创建品牌失败: ${error.message} [用户: ${req.user._id}]`, error);
        res.status(500).json({
            success: false,
            error: '创建品牌失败',
            message: error.message || '未知错误'
        });
    }
});

// 获取所有品牌列表 - 需要认证
router.get('/', authenticate, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search, 
            status, 
            sortBy = 'createdAt', 
            sortOrder = 'desc' 
        } = req.query;
        
        logger.info(`查询品牌列表 [搜索: ${search}, 状态: ${status}, 页码: ${page}, 每页: ${limit}, 用户: ${req.user._id}]`);
        
        // 构建查询条件
        const query = {};
        
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        
        if (status) {
            query.cooperationStatus = status;
        }
        
        // 构建排序选项
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        
        // 查询品牌列表
        const total = await Brand.countDocuments(query);
        const brands = await Brand.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');
        
        res.status(200).json({
            success: true,
            data: brands,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error(`获取品牌列表失败: ${error.message} [用户: ${req.user._id}]`, error);
        res.status(500).json({
            success: false,
            error: '获取品牌列表失败',
            message: error.message || '未知错误'
        });
    }
});

// 获取品牌详情 - 需要认证
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        logger.info(`查询品牌详情 [ID: ${id}, 用户: ${req.user._id}]`);
        
        const brand = await Brand.findById(id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');
        
        if (!brand) {
            logger.warn(`查询品牌详情失败: 品牌不存在 [ID: ${id}, 用户: ${req.user._id}]`);
            return res.status(404).json({
                success: false,
                error: '品牌不存在',
                message: '未找到指定的品牌'
            });
        }
        
        res.status(200).json({
            success: true,
            data: brand
        });
    } catch (error) {
        logger.error(`获取品牌详情失败: ${error.message} [ID: ${req.params.id}, 用户: ${req.user._id}]`, error);
        res.status(500).json({
            success: false,
            error: '获取品牌详情失败',
            message: error.message || '未知错误'
        });
    }
});

// 更新品牌信息 - 需要工行管理员或超级管理员权限
router.put('/:id', authenticate, authorize('ICBC_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            logo, 
            description, 
            contactPerson, 
            contactEmail, 
            contactPhone, 
            icbcContractId,
            blockchainIdentity,
            cooperationStatus 
        } = req.body;
        
        logger.info(`更新品牌信息 [ID: ${id}, 用户: ${req.user._id}]`);
        
        // 查找品牌
        const brand = await Brand.findById(id);
        
        if (!brand) {
            logger.warn(`更新品牌信息失败: 品牌不存在 [ID: ${id}, 用户: ${req.user._id}]`);
            return res.status(404).json({
                success: false,
                error: '品牌不存在',
                message: '未找到指定的品牌'
            });
        }
        
        // 更新品牌信息
        if (name) brand.name = name;
        if (logo) brand.logo = logo;
        if (description) brand.description = description;
        if (contactPerson) brand.contactPerson = contactPerson;
        if (contactEmail) brand.contactEmail = contactEmail;
        if (contactPhone) brand.contactPhone = contactPhone;
        if (icbcContractId) brand.icbcContractId = icbcContractId;
        if (blockchainIdentity) brand.blockchainIdentity = blockchainIdentity;
        if (cooperationStatus) brand.cooperationStatus = cooperationStatus;
        brand.updatedBy = req.user._id;
        brand.updatedAt = Date.now();
        
        await brand.save();
        
        logger.info(`品牌信息更新成功 [ID: ${id}, 名称: ${brand.name}, 用户: ${req.user._id}]`);
        
        res.status(200).json({
            success: true,
            message: '品牌信息更新成功',
            data: brand
        });
    } catch (error) {
        logger.error(`更新品牌信息失败: ${error.message} [ID: ${req.params.id}, 用户: ${req.user._id}]`, error);
        res.status(500).json({
            success: false,
            error: '更新品牌信息失败',
            message: error.message || '未知错误'
        });
    }
});

// 启用/禁用品牌 - 需要工行管理员或超级管理员权限
router.patch('/:id/status', authenticate, authorize('ICBC_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;
        
        logger.info(`更新品牌状态 [ID: ${id}, 激活状态: ${active}, 用户: ${req.user._id}]`);
        
        // 查找品牌
        const brand = await Brand.findById(id);
        
        if (!brand) {
            logger.warn(`更新品牌状态失败: 品牌不存在 [ID: ${id}, 用户: ${req.user._id}]`);
            return res.status(404).json({
                success: false,
                error: '品牌不存在',
                message: '未找到指定的品牌'
            });
        }
        
        // 更新品牌状态
        brand.active = active;
        brand.updatedBy = req.user._id;
        brand.updatedAt = Date.now();
        
        await brand.save();
        
        logger.info(`品牌状态已${active ? '启用' : '禁用'} [ID: ${id}, 名称: ${brand.name}, 用户: ${req.user._id}]`);
        
        res.status(200).json({
            success: true,
            message: `品牌已${active ? '启用' : '禁用'}`,
            data: brand
        });
    } catch (error) {
        logger.error(`更新品牌状态失败: ${error.message} [ID: ${req.params.id}, 用户: ${req.user._id}]`, error);
        res.status(500).json({
            success: false,
            error: '更新品牌状态失败',
            message: error.message || '未知错误'
        });
    }
});

// 删除品牌 - 需要超级管理员权限
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        logger.info(`删除品牌 [ID: ${id}, 用户: ${req.user._id}]`);
        
        const brand = await Brand.findByIdAndDelete(id);
        
        if (!brand) {
            logger.warn(`删除品牌失败: 品牌不存在 [ID: ${id}, 用户: ${req.user._id}]`);
            return res.status(404).json({
                success: false,
                error: '品牌不存在',
                message: '未找到指定的品牌'
            });
        }
        
        logger.info(`品牌删除成功 [ID: ${id}, 名称: ${brand.name}, 用户: ${req.user._id}]`);
        
        res.status(200).json({
            success: true,
            message: '品牌删除成功',
            data: brand
        });
    } catch (error) {
        logger.error(`删除品牌失败: ${error.message} [ID: ${req.params.id}, 用户: ${req.user._id}]`, error);
        res.status(500).json({
            success: false,
            error: '删除品牌失败',
            message: error.message || '未知错误'
        });
    }
});

module.exports = router;