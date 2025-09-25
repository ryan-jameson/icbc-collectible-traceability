'use strict';

const { Contract } = require('fabric-contract-api');

class CollectibleTraceabilityContract extends Contract {
    // 初始化合约
    async initLedger(ctx) {
        console.info('初始化藏品溯源账本');
    }

    // 创建藏品数字身份
    async createCollectible(ctx, collectibleId, name, brand, designer, material, batchNumber, productionDate, description) {
        // 检查藏品是否已存在
        const collectibleExists = await this.collectibleExists(ctx, collectibleId);
        if (collectibleExists) {
            throw new Error(`藏品 ${collectibleId} 已存在`);
        }

        // 创建藏品数据
        const collectible = {
            id: collectibleId,
            name: name,
            brand: brand,
            designer: designer,
            material: material,
            batchNumber: batchNumber,
            productionDate: productionDate,
            description: description,
            currentOwner: brand, // 初始所有者为品牌方
            createdBy: ctx.clientIdentity.getID(),
            createdAt: new Date().toISOString(),
            status: 'ACTIVE',
            transferHistory: []
        };

        // 计算藏品哈希值（数字DNA）
        const collectibleHash = this.calculateHash(JSON.stringify(collectible));
        collectible.hash = collectibleHash;

        // 保存到区块链
        await ctx.stub.putState(collectibleId, Buffer.from(JSON.stringify(collectible)));
        console.info(`创建藏品 ${collectibleId} 成功`);
        return collectible;
    }

    // 认领藏品
    async claimCollectible(ctx, collectibleId, userId) {
        // 获取藏品信息
        const collectibleJSON = await ctx.stub.getState(collectibleId);
        if (!collectibleJSON || collectibleJSON.length === 0) {
            throw new Error(`藏品 ${collectibleId} 不存在`);
        }

        const collectible = JSON.parse(collectibleJSON.toString());

        // 检查藏品是否已被认领
        if (collectible.currentOwner !== collectible.brand) {
            throw new Error(`藏品 ${collectibleId} 已被认领`);
        }

        // 记录转让历史
        collectible.transferHistory.push({
            from: collectible.currentOwner,
            to: userId,
            timestamp: new Date().toISOString(),
            type: 'CLAIM'
        });

        // 更新当前所有者
        collectible.currentOwner = userId;

        // 保存更新后的藏品信息
        await ctx.stub.putState(collectibleId, Buffer.from(JSON.stringify(collectible)));
        console.info(`用户 ${userId} 成功认领藏品 ${collectibleId}`);
        return collectible;
    }

    // 转移藏品所有权
    async transferCollectible(ctx, collectibleId, newOwnerId) {
        // 获取藏品信息
        const collectibleJSON = await ctx.stub.getState(collectibleId);
        if (!collectibleJSON || collectibleJSON.length === 0) {
            throw new Error(`藏品 ${collectibleId} 不存在`);
        }

        const collectible = JSON.parse(collectibleJSON.toString());
        const currentOwner = collectible.currentOwner;
        const callerId = ctx.clientIdentity.getID();

        // 验证当前调用者是否为所有者
        if (currentOwner !== callerId && !this.isAdmin(callerId)) {
            throw new Error(`只有藏品 ${collectibleId} 的当前所有者才能转移所有权`);
        }

        // 记录转让历史
        collectible.transferHistory.push({
            from: currentOwner,
            to: newOwnerId,
            timestamp: new Date().toISOString(),
            type: 'TRANSFER'
        });

        // 更新当前所有者
        collectible.currentOwner = newOwnerId;

        // 保存更新后的藏品信息
        await ctx.stub.putState(collectibleId, Buffer.from(JSON.stringify(collectible)));
        console.info(`藏品 ${collectibleId} 所有权已转移给 ${newOwnerId}`);
        return collectible;
    }

    // 查询藏品信息
    async queryCollectible(ctx, collectibleId) {
        const collectibleJSON = await ctx.stub.getState(collectibleId);
        if (!collectibleJSON || collectibleJSON.length === 0) {
            throw new Error(`藏品 ${collectibleId} 不存在`);
        }

        return JSON.parse(collectibleJSON.toString());
    }

    // 查询藏品历史记录
    async getCollectibleHistory(ctx, collectibleId) {
        const collectible = await this.queryCollectible(ctx, collectibleId);
        return {
            collectibleId: collectible.id,
            name: collectible.name,
            brand: collectible.brand,
            transferHistory: collectible.transferHistory
        };
    }

    // 验证藏品真伪
    async verifyCollectible(ctx, collectibleId, providedHash) {
        const collectible = await this.queryCollectible(ctx, collectibleId);
        return collectible.hash === providedHash;
    }

    // 内部方法：检查藏品是否存在
    async collectibleExists(ctx, collectibleId) {
        const collectibleJSON = await ctx.stub.getState(collectibleId);
        return collectibleJSON && collectibleJSON.length > 0;
    }

    // 内部方法：计算哈希值
    calculateHash(data) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // 内部方法：检查是否为管理员
    isAdmin(userId) {
        // 实际实现中应该使用区块链的MSP身份验证
        return userId.includes('admin') || userId.includes('ICBC');
    }
}

module.exports = CollectibleTraceabilityContract;