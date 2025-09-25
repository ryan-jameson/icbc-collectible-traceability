// 藏品模型定义 - MySQL版本

const { getPool } = require('../utils/db');
const User = require('./user');
const Brand = require('./brand');

// 藏品流转历史类
class TransferHistory {
    constructor(data) {
        this.id = data.id;
        this.collectibleId = data.collectible_id;
        this.from = data.from_user;
        this.to = data.to_user;
        this.timestamp = data.timestamp;
        this.type = data.type;
        this.transactionId = data.transaction_id;
    }

    // 保存流转历史
    static async create(collectibleId, from, to, type = 'TRANSFER', transactionId = null) {
        const pool = getPool();
        const [result] = await pool.execute(
            `INSERT INTO transfer_histories (collectible_id, from_user, to_user, type, transaction_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [collectibleId, from, to, type, transactionId]
        );
        return result.insertId;
    }

    // 根据藏品ID获取流转历史
    static async findByCollectibleId(collectibleId) {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM transfer_histories WHERE collectible_id = ? ORDER BY timestamp DESC',
            [collectibleId]
        );
        return rows.map(row => new TransferHistory(row));
    }
}

// 藏品类
class Collectible {
    constructor(data) {
        this.id = data.id;
        this.blockchainId = data.blockchain_id;
        this.name = data.name;
        this.brandId = data.brand_id;
        this.designer = data.designer;
        this.material = data.material;
        this.batchNumber = data.batch_number;
        this.productionDate = data.production_date;
        this.description = data.description;
        this.hash = data.hash;
        this.qrCodeUrl = data.qr_code_url;
        this.nfcId = data.nfc_id;
        this.currentOwnerId = data.current_owner_id;
        this.status = data.status;
        this.estimatedValue = data.estimated_value;
        this.lastValuationDate = data.last_valuation_date;
        this.createdBy = data.created_by;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
        // 关联对象，需要额外查询
        this.brand = null;
        this.currentOwner = null;
        this.transferHistory = [];
    }

    // 保存藏品
    async save() {
        const pool = getPool();
        
        try {
            if (this.id) {
                // 更新藏品
                await pool.execute(
                    `UPDATE collectibles 
                     SET blockchain_id = ?, name = ?, brand_id = ?, designer = ?, material = ?, 
                         batch_number = ?, production_date = ?, description = ?, hash = ?, 
                         qr_code_url = ?, nfc_id = ?, current_owner_id = ?, status = ?, 
                         estimated_value = ?, last_valuation_date = ?, created_by = ? 
                     WHERE id = ?`,
                    [this.blockchainId, this.name, this.brandId, this.designer, this.material,
                     this.batchNumber, this.productionDate, this.description, this.hash,
                     this.qrCodeUrl, this.nfcId, this.currentOwnerId, this.status,
                     this.estimatedValue, this.lastValuationDate, this.createdBy, this.id]
                );
            } else {
                // 创建新藏品
                const [result] = await pool.execute(
                    `INSERT INTO collectibles (blockchain_id, name, brand_id, designer, material, 
                                             batch_number, production_date, description, hash, 
                                             qr_code_url, nfc_id, current_owner_id, status, 
                                             estimated_value, last_valuation_date, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [this.blockchainId, this.name, this.brandId, this.designer, this.material,
                     this.batchNumber, this.productionDate, this.description, this.hash,
                     this.qrCodeUrl, this.nfcId, this.currentOwnerId, this.status,
                     this.estimatedValue, this.lastValuationDate, this.createdBy]
                );
                this.id = result.insertId;
            }
            return this;
        } catch (error) {
            throw error;
        }
    }

    // 静态方法：根据ID查找藏品
    static async findById(id, populate = false) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE id = ?', [id]);
        
        if (rows.length === 0) return null;
        
        const collectible = new Collectible(rows[0]);
        
        if (populate) {
            await collectible.populateRelations();
        }
        
        return collectible;
    }

    // 静态方法：根据区块链ID查找藏品
    static async findByBlockchainId(blockchainId, populate = false) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE blockchain_id = ?', [blockchainId]);
        
        if (rows.length === 0) return null;
        
        const collectible = new Collectible(rows[0]);
        
        if (populate) {
            await collectible.populateRelations();
        }
        
        return collectible;
    }

    // 静态方法：根据哈希查找藏品
    static async findByHash(hash, populate = false) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE hash = ?', [hash]);
        
        if (rows.length === 0) return null;
        
        const collectible = new Collectible(rows[0]);
        
        if (populate) {
            await collectible.populateRelations();
        }
        
        return collectible;
    }

    // 静态方法：根据所有者查找藏品
    static async findByOwner(ownerId, populate = false) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE current_owner_id = ?', [ownerId]);
        
        const collectibles = rows.map(row => new Collectible(row));
        
        if (populate) {
            for (const collectible of collectibles) {
                await collectible.populateBrand();
            }
        }
        
        return collectibles;
    }

    // 静态方法：根据品牌查找藏品
    static async findByBrand(brandId, populate = false) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE brand_id = ?', [brandId]);
        
        const collectibles = rows.map(row => new Collectible(row));
        
        if (populate) {
            for (const collectible of collectibles) {
                await collectible.populateOwner();
            }
        }
        
        return collectibles;
    }

    // 静态方法：获取所有藏品
    static async findAll() {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles');
        return rows.map(row => new Collectible(row));
    }

    // 静态方法：删除藏品
    static async deleteById(id) {
        const pool = getPool();
        const [result] = await pool.execute('DELETE FROM collectibles WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // 静态方法：搜索藏品
    static async search(query) {
        const pool = getPool();
        const searchQuery = `%${query}%`;
        const [rows] = await pool.execute(
            'SELECT * FROM collectibles WHERE name LIKE ? OR batch_number LIKE ?',
            [searchQuery, searchQuery]
        );
        return rows.map(row => new Collectible(row));
    }

    // 填充关联关系
    async populateRelations() {
        await this.populateBrand();
        await this.populateOwner();
        await this.populateTransferHistory();
    }

    // 填充品牌信息
    async populateBrand() {
        if (this.brandId) {
            this.brand = await Brand.findById(this.brandId);
        }
    }

    // 填充所有者信息
    async populateOwner() {
        if (this.currentOwnerId) {
            this.currentOwner = await User.findById(this.currentOwnerId);
        }
    }

    // 填充流转历史
    async populateTransferHistory() {
        this.transferHistory = await TransferHistory.findByCollectibleId(this.id);
    }

    // 添加流转历史
    async addTransferHistory(from, to, type = 'TRANSFER', transactionId = null) {
        return await TransferHistory.create(this.id, from, to, type, transactionId);
    }

    // 更新藏品估值
    async updateValuation(value) {
        const pool = getPool();
        await pool.execute(
            'UPDATE collectibles SET estimated_value = ?, last_valuation_date = NOW() WHERE id = ?',
            [value, this.id]
        );
        this.estimatedValue = value;
        this.lastValuationDate = new Date();
    }

    // 更新藏品状态
    async updateStatus(status) {
        const pool = getPool();
        await pool.execute(
            'UPDATE collectibles SET status = ? WHERE id = ?',
            [status, this.id]
        );
        this.status = status;
    }
}

module.exports = Collectible;
module.exports.TransferHistory = TransferHistory;