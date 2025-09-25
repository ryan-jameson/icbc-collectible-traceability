// 藏品控制器

const Collectible = require('../models/collectible');
const Brand = require('../models/brand');
const User = require('../models/user');
const { TransferHistory } = require('../models/collectible');
const blockchain = require('../../blockchain');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const logger = require('../../blockchain/utils/log-utils');

// 创建藏品
exports.createCollectible = async (req, res) => {
    try {
        const { name, designer, material, batchNumber, productionDate, description } = req.body;
        const brandId = req.user.role === 'BRAND_ADMIN' ? req.user.id : req.body.brandId;
        
        // 验证品牌是否存在
        const brand = await Brand.findById(brandId);
        if (!brand) {
            logger.warn(`创建藏品失败: 品牌不存在 [用户: ${req.user.id}, 品牌ID: ${brandId}]`);
            return res.status(404).json({
                error: '品牌不存在',
                message: '请提供有效的品牌ID'
            });
        }

        // 验证用户权限
        if (req.user.role === 'BRAND_ADMIN' && req.user.id.toString() !== brand.createdBy.toString()) {
            logger.warn(`创建藏品失败: 权限不足 [用户: ${req.user.id}, 品牌ID: ${brandId}]`);
            return res.status(403).json({
                error: '权限不足',
                message: '您只能为自己的品牌创建藏品'
            });
        }

        // 生成唯一的藏品ID
        const collectibleId = `COL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        logger.info(`开始创建藏品 [ID: ${collectibleId}, 品牌: ${brand.name}, 用户: ${req.user.id}]`);
        // 调用区块链智能合约创建藏品
        logger.logTransaction('CREATE_COLLECTIBLE', req.user.id, collectibleId, {
            name, designer, material, batchNumber
        });
        const blockchainCollectible = await blockchain.invoke(
            'createCollectible',
            collectibleId,
            name,
            brand.name,
            designer,
            material,
            batchNumber,
            productionDate,
            description
        );

        // 生成二维码
        const qrCodeData = `${process.env.APP_URL}/collectibles/${collectibleId}`;
        const qrCodeFilename = `${collectibleId}.png`;
        const qrCodePath = path.join(__dirname, '..', 'public', 'qr-codes', qrCodeFilename);
        
        // 确保目录存在
        const qrCodeDir = path.dirname(qrCodePath);
        if (!fs.existsSync(qrCodeDir)) {
            fs.mkdirSync(qrCodeDir, { recursive: true });
        }
        
        // 生成并保存二维码
        await qrcode.toFile(qrCodePath, qrCodeData);
        
        // 创建本地藏品记录 - MySQL版本
        const collectible = new Collectible();
        await collectible.save({
            blockchain_id: collectibleId,
            name: name,
            brand_id: brand.id,
            designer: designer,
            material: material,
            batch_number: batchNumber,
            production_date: new Date(productionDate),
            description: description,
            hash: blockchainCollectible.hash,
            qr_code_url: `/public/qr-codes/${qrCodeFilename}`,
            current_owner_id: null, // 初始时未被认领
            created_by_id: req.user.id,
            status: 'ACTIVE'
        });
        
        // 获取完整的藏品信息
        const fullCollectible = await Collectible.findByBlockchainId(collectibleId);
        
        logger.info(`藏品创建成功 [ID: ${collectibleId}, 哈希: ${blockchainCollectible.hash}]`);
        
        res.status(201).json({
            success: true,
            message: '藏品创建成功',
            data: fullCollectible
        });
    } catch (error) {
        logger.error(`创建藏品失败: ${error.message} [用户: ${req.user.id}]`, error);
        res.status(500).json({
            success: false,
            error: '创建藏品失败',
            message: error.message || '未知错误'
        });
    }
};

// 查询藏品详情
exports.getCollectible = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查询本地藏品记录
        let collectible = await Collectible.findByBlockchainId(id);
        
        if (!collectible) {
            logger.warn(`查询藏品详情失败: 藏品不存在 [ID: ${id}, 用户: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }
        
        // 从区块链获取最新数据
        try {
            logger.logQuery('QUERY_COLLECTIBLE', req.user.id, id);
            const blockchainData = await blockchain.query('queryCollectible', id);
            collectible.hash = blockchainData.hash;
            
            // 更新本地数据库中的哈希值
            const updatedCollectible = new Collectible();
            await updatedCollectible.update(collectible.id, { hash: blockchainData.hash });
        } catch (blockchainError) {
            logger.warn(`区块链查询失败，使用本地数据: ${blockchainError.message} [ID: ${id}]`);
        }
        
        res.status(200).json({
            success: true,
            data: collectible
        });
    } catch (error) {
        logger.error(`查询藏品详情失败: ${error.message} [ID: ${id}, 用户: ${req.user.id}]`, error);
        res.status(500).json({
            success: false,
            error: '查询藏品详情失败',
            message: error.message || '未知错误'
        });
    }
};

// 认领藏品
exports.claimCollectible = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id.toString();
        
        // 查询藏品
        const collectible = await Collectible.findByBlockchainId(id);
        
        if (!collectible) {
            logger.warn(`认领藏品失败: 藏品不存在 [ID: ${id}, 用户: ${userId}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }
        
        // 检查藏品是否已被认领
        if (collectible.current_owner_id) {
            logger.warn(`认领藏品失败: 藏品已被认领 [ID: ${id}, 用户: ${userId}]`);
            return res.status(400).json({
                success: false,
                error: '藏品已被认领',
                message: '该藏品已被其他用户认领'
            });
        }
        
        // 调用区块链智能合约认领藏品
        logger.logTransaction('CLAIM_COLLECTIBLE', userId, id, {});
        const updatedCollectible = await blockchain.invoke('claimCollectible', id, userId);
        
        // 更新本地藏品记录
        const updated = new Collectible();
        await updated.update(collectible.id, {
            current_owner_id: userId,
            status: 'CLAIMED'
        });
        
        // 创建流转历史记录
        const transferHistory = new TransferHistory();
        await transferHistory.save({
            collectibleId: collectible.id,
            from: collectible.brand_id.toString(),
            to: userId,
            type: 'CLAIM',
            transactionId: updatedCollectible.transactionId
        });
        
        // 更新用户的藏品列表
        const user = new User();
        await user.addCollectible(userId, collectible.id);
        
        // 获取更新后的藏品信息
        const updatedCollectibleInfo = await Collectible.findByBlockchainId(id);
        
        res.status(200).json({
            success: true,
            message: '藏品认领成功',
            data: updatedCollectibleInfo
        });
    } catch (error) {
        logger.error(`认领藏品失败: ${error.message} [ID: ${id}, 用户: ${userId}]`, error);
        res.status(500).json({
            success: false,
            error: '认领藏品失败',
            message: error.message || '未知错误'
        });
    }
};

// 转移藏品所有权
exports.transferCollectible = async (req, res) => {
    try {
        const { id } = req.params;
        const { newOwnerId } = req.body;
        const currentOwnerId = req.user.id.toString();
        
        // 查询藏品
        const collectible = await Collectible.findByBlockchainId(id);
        
        if (!collectible) {
            logger.warn(`转移藏品所有权失败: 藏品不存在 [ID: ${id}, 当前所有者: ${currentOwnerId}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }
        
        // 检查是否为当前所有者
        if (collectible.current_owner_id !== currentOwnerId) {
            logger.warn(`转移藏品所有权失败: 权限不足 [ID: ${id}, 当前所有者: ${currentOwnerId}, 请求用户: ${req.user.id}]`);
            return res.status(403).json({
                success: false,
                error: '权限不足',
                message: '您不是该藏品的当前所有者'
            });
        }
        
        // 检查新所有者是否存在
        const newOwner = new User();
        const newOwnerExists = await newOwner.findById(newOwnerId);
        if (!newOwnerExists) {
            logger.warn(`转移藏品所有权失败: 用户不存在 [ID: ${id}, 新所有者ID: ${newOwnerId}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定的新所有者'
            });
        }
        
        // 调用区块链智能合约转移所有权
        logger.logTransaction('TRANSFER_COLLECTIBLE', currentOwnerId, id, {
            newOwnerId: newOwnerId
        });
        const updatedCollectible = await blockchain.invoke('transferCollectible', id, newOwnerId);
        
        // 更新本地藏品记录
        const updated = new Collectible();
        await updated.update(collectible.id, {
            current_owner_id: newOwnerId
        });
        
        // 创建流转历史记录
        const transferHistory = new TransferHistory();
        await transferHistory.save({
            collectibleId: collectible.id,
            from: currentOwnerId,
            to: newOwnerId,
            type: 'TRANSFER',
            transactionId: updatedCollectible.transactionId
        });
        
        // 更新用户的藏品列表
        await newOwner.removeCollectible(currentOwnerId, collectible.id);
        await newOwner.addCollectible(newOwnerId, collectible.id);
        
        // 获取更新后的藏品信息
        const updatedCollectibleInfo = await Collectible.findByBlockchainId(id);
        
        res.status(200).json({
            success: true,
            message: '藏品所有权转移成功',
            data: updatedCollectibleInfo
        });
    } catch (error) {
        logger.error(`转移藏品所有权失败: ${error.message} [ID: ${id}, 从: ${currentOwnerId}, 到: ${newOwnerId}]`, error);
        res.status(500).json({
            success: false,
            error: '转移藏品所有权失败',
            message: error.message || '未知错误'
        });
    }
};

// 查询藏品流转历史
exports.getCollectibleHistory = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查询藏品
        const collectible = await Collectible.findByBlockchainId(id);
        
        if (!collectible) {
            logger.warn(`查询藏品流转历史失败: 藏品不存在 [ID: ${id}, 用户: ${req.user.id}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }
        
        // 从区块链获取流转历史
        let blockchainHistory;
        try {
            logger.logQuery('GET_COLLECTIBLE_HISTORY', req.user.id, id);
            blockchainHistory = await blockchain.query('getCollectibleHistory', id);
        } catch (blockchainError) {
            logger.warn(`区块链查询失败，使用本地历史数据: ${blockchainError.message} [ID: ${id}]`);
            
            // 查询本地流转历史
            const transferHistory = new TransferHistory();
            const localHistory = await transferHistory.findByCollectibleId(collectible.id);
            
            // 查询品牌信息
            const brand = new Brand();
            const brandInfo = await brand.findById(collectible.brand_id);
            
            blockchainHistory = {
                collectibleId: id,
                name: collectible.name,
                brand: brandInfo ? brandInfo.name : '',
                transferHistory: localHistory
            };
        }
        
        res.status(200).json({
            success: true,
            data: blockchainHistory
        });
    } catch (error) {
        logger.error(`查询藏品流转历史失败: ${error.message} [ID: ${id}, 用户: ${req.user.id}]`, error);
        res.status(500).json({
            success: false,
            error: '查询藏品流转历史失败',
            message: error.message || '未知错误'
        });
    }
};

// 验证藏品真伪
exports.verifyCollectible = async (req, res) => {
    try {
        const { id, hash } = req.body;
        
        // 调用区块链智能合约验证真伪
        logger.logQuery('VERIFY_COLLECTIBLE', req.user.id, id, { hash });
        const isAuthentic = await blockchain.query('verifyCollectible', id, hash);
        
        res.status(200).json({
            success: true,
            isAuthentic: isAuthentic,
            message: isAuthentic ? '藏品验证为真' : '藏品验证为假'
        });
    } catch (error) {
        logger.error(`验证藏品真伪失败: ${error.message} [ID: ${id}]`, error);
        res.status(500).json({
            success: false,
            error: '验证藏品真伪失败',
            message: error.message || '未知错误'
        });
    }
};

// 搜索藏品
exports.searchCollectibles = async (req, res) => {
    try {
        const { keyword, brandId, status, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
        logger.info(`搜索藏品 [关键词: ${keyword}, 品牌: ${brandId}, 状态: ${status}, 页码: ${pageNum}, 每页: ${limitNum}, 用户: ${req.user.id}]`);
        
        // 执行MySQL搜索
        const collectible = new Collectible();
        const { collectibles, total } = await collectible.search({
            keyword: keyword,
            brandId: brandId,
            status: status,
            offset: offset,
            limit: limitNum
        });
        
        res.status(200).json({
            success: true,
            data: collectibles,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        logger.error(`搜索藏品失败: ${error.message} [用户: ${req.user.id}]`, error);
        res.status(500).json({
            success: false,
            error: '搜索藏品失败',
            message: error.message || '未知错误'
        });
    }
};