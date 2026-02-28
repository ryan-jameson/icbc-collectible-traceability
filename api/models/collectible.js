// 藏品模型定义 - MySQL版本

const { getPool } = require('../utils/db');
const User = require('./user');
const Brand = require('./brand');

const parseJson = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'object') {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
};

const stringifyJson = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    return JSON.stringify(value);
};

// 藏品流转历史类
class TransferHistory {
    constructor(data = {}) {
        this.id = data.id || null;
        this.collectibleId = data.collectible_id || data.collectibleId || null;
        this.from = data.from_user || data.from || null;
        this.to = data.to_user || data.to || null;
        this.timestamp = data.timestamp ? new Date(data.timestamp) : null;
        this.type = data.type || 'TRANSFER';
        this.transactionId = data.transaction_id || data.transactionId || null;
        this.metadata = parseJson(data.metadata);
    }

    static async create(collectibleId, from, to, type = 'TRANSFER', transactionId = null, metadata = null) {
        const pool = getPool();
        const [result] = await pool.execute(
            `INSERT INTO transfer_histories (collectible_id, from_user, to_user, type, transaction_id, metadata) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [collectibleId, from, to, type, transactionId, stringifyJson(metadata)]
        );
        return result.insertId;
    }

    async save(data = {}) {
        const payload = {
            collectibleId: data.collectibleId ?? this.collectibleId,
            from: data.from ?? this.from,
            to: data.to ?? this.to,
            type: data.type ?? this.type,
            transactionId: data.transactionId ?? this.transactionId,
            metadata: data.metadata ?? this.metadata
        };

        const pool = getPool();
        const [result] = await pool.execute(
            `INSERT INTO transfer_histories (collectible_id, from_user, to_user, type, transaction_id, metadata)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [payload.collectibleId, payload.from, payload.to, payload.type, payload.transactionId, stringifyJson(payload.metadata)]
        );

        this.id = result.insertId;
        this.collectibleId = payload.collectibleId;
        this.from = payload.from;
        this.to = payload.to;
        this.type = payload.type;
        this.transactionId = payload.transactionId;
        this.metadata = payload.metadata;
        this.timestamp = new Date();

        return this;
    }

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
    constructor(data = {}) {
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
    this.current_owner_id = data.current_owner_id;
        this.status = data.status;
        this.estimatedValue = data.estimated_value;
        this.lastValuationDate = data.last_valuation_date;
        this.productPhotoBuffer = null;
        if (data.product_photo instanceof Buffer) {
            this.productPhotoBuffer = data.product_photo;
            this.productPhoto = data.product_photo.toString('base64');
        } else if (data.product_photo && typeof data.product_photo === 'string') {
            this.productPhoto = data.product_photo;
            try {
                this.productPhotoBuffer = Buffer.from(data.product_photo, 'base64');
            } catch (error) {
                this.productPhotoBuffer = null;
            }
        } else if (data.productPhotoBuffer instanceof Buffer) {
            this.productPhotoBuffer = data.productPhotoBuffer;
            this.productPhoto = data.productPhotoBuffer.toString('base64');
        } else {
            this.productPhoto = data.productPhoto || null;
        }
        this.metadata = parseJson(data.metadata);
        this.productPhotoMimeType = this.metadata?.productPhotoMimeType || data.productPhotoMimeType || null;
        this.createdBy = data.created_by;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
        // 关联对象，需要额外查询
        this.brand = null;
        this.brandName = data.brand_name || null;
        this.currentOwner = null;
        this.transferHistory = [];
        this.transferRequest = parseJson(data.transfer_request);
    }

    // 保存藏品
    // 保存藏品
    async save() {
        const pool = getPool();

        try {
            if (this.id) {
                await pool.execute(
                    `UPDATE collectibles 
                     SET blockchain_id = ?, name = ?, brand_id = ?, designer = ?, material = ?, 
                         batch_number = ?, production_date = ?, description = ?, hash = ?, 
                         qr_code_url = ?, nfc_id = ?, current_owner_id = ?, status = ?, 
                         estimated_value = ?, last_valuation_date = ?, product_photo = ?, transfer_request = ?, metadata = ?, created_by = ? 
                     WHERE id = ?`,
                    [
                        this.blockchainId,
                        this.name,
                        this.brandId,
                        this.designer,
                        this.material,
                        this.batchNumber,
                        this.productionDate,
                        this.description,
                        this.hash,
                        this.qrCodeUrl,
                        this.nfcId ?? null,
                        this.currentOwnerId ?? null,
                        this.status || 'ACTIVE',
                        this.estimatedValue ?? 0,
                        this.lastValuationDate ?? null,
                        this.productPhotoBuffer ?? null,
                        stringifyJson(this.transferRequest),
                        stringifyJson(this.metadata),
                        this.createdBy ?? null,
                        this.id
                    ]
                );
            } else {
                const [result] = await pool.execute(
                    `INSERT INTO collectibles (
                        blockchain_id,
                        name,
                        brand_id,
                        designer,
                        material,
                        batch_number,
                        production_date,
                        description,
                        hash,
                        qr_code_url,
                        nfc_id,
                        current_owner_id,
                        status,
                        estimated_value,
                        last_valuation_date,
                        product_photo,
                        transfer_request,
                        metadata,
                        created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        this.blockchainId,
                        this.name,
                        this.brandId,
                        this.designer,
                        this.material,
                        this.batchNumber,
                        this.productionDate,
                        this.description,
                        this.hash,
                        this.qrCodeUrl,
                        this.nfcId ?? null,
                        this.currentOwnerId ?? null,
                        this.status || 'ACTIVE',
                        this.estimatedValue ?? 0,
                        this.lastValuationDate ?? null,
                        this.productPhotoBuffer ?? null,
                        stringifyJson(this.transferRequest),
                        stringifyJson(this.metadata),
                        this.createdBy ?? null
                    ]
                );
                this.id = result.insertId;
            }
            this.current_owner_id = this.currentOwnerId;
            return this;
        } catch (error) {
            throw error;
        }
    }
    static toCamelCase(field) {
        return field.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    }

    async update(id, data = {}) {
        const pool = getPool();
        const keys = Object.keys(data);

        if (!keys.length) {
            return false;
        }

        const assignments = keys.map(key => `${key} = ?`).join(', ');
        const values = keys.map((key) => {
            if (key === 'metadata') {
                return stringifyJson(data[key]);
            }
            if (key === 'product_photo') {
                if (data[key] instanceof Buffer) {
                    this.productPhotoBuffer = data[key];
                    this.productPhoto = data[key].toString('base64');
                } else if (typeof data[key] === 'string') {
                    try {
                        this.productPhotoBuffer = Buffer.from(data[key], 'base64');
                        this.productPhoto = data[key];
                    } catch (error) {
                        this.productPhotoBuffer = null;
                        this.productPhoto = null;
                    }
                } else {
                    this.productPhotoBuffer = null;
                    this.productPhoto = null;
                }
                return this.productPhotoBuffer;
            }
            if (key === 'transfer_request') {
                this.transferRequest = parseJson(data[key]);
                return stringifyJson(data[key]);
            }
            return data[key];
        });
        values.push(id);

        await pool.execute(`UPDATE collectibles SET ${assignments}, updated_at = NOW() WHERE id = ?`, values);

        if (this.id === id) {
            for (const key of keys) {
                if (key === 'metadata') {
                    this.metadata = data[key];
                    this.productPhotoMimeType = this.metadata?.productPhotoMimeType || null;
                    continue;
                }
                if (key === 'transfer_request') {
                    this.transferRequest = parseJson(data[key]);
                    continue;
                }
                const camelKey = Collectible.toCamelCase(key);
                this[camelKey] = data[key];
                if (camelKey === 'currentOwnerId') {
                    this.current_owner_id = data[key];
                }
            }
            this.updatedAt = new Date();
        }

        return true;
    }

    // 静态方法：根据ID查找藏品
    static async findById(id, populate = false) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE id = ?', [id]);

        if (rows.length === 0) {
            return null;
        }

        const collectible = new Collectible(rows[0]);

        if (populate) {
            await collectible.populateRelations();
        }

        return collectible;
    }

    // 静态方法：根据区块链ID查找藏品
    static async findByBlockchainId(blockchainId, populate = false) {
        if (!blockchainId) {
            return null;
        }

        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM collectibles WHERE blockchain_id = ?', [blockchainId]);

        if (!rows.length) {
            return null;
        }

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

        if (rows.length === 0) {
            return null;
        }

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

    static async updateStatusByBlockchainId(blockchainId, status) {
        const pool = getPool();
        const [result] = await pool.execute(
            'UPDATE collectibles SET status = ?, updated_at = NOW() WHERE blockchain_id = ?',
            [status, blockchainId]
        );
        return result.affectedRows > 0;
    }

    // 静态方法：搜索藏品
    static async search({ keyword, brandId, status, offset = 0, limit = 10, orderBy = 'created_at', sort = 'DESC' } = {}) {
        const pool = getPool();
        const where = [];
        const params = [];

        if (keyword) {
            where.push('(c.name LIKE ? OR c.batch_number LIKE ? OR c.blockchain_id LIKE ?)' );
            const searchValue = `%${keyword}%`;
            params.push(searchValue, searchValue, searchValue);
        }

        if (brandId) {
            where.push('c.brand_id = ?');
            params.push(brandId);
        }

        if (status) {
            where.push('c.status = ?');
            params.push(status);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const countSql = `SELECT COUNT(*) as total FROM collectibles c ${whereSql}`;
        const [countRows] = await pool.execute(countSql, params);
        const total = countRows[0]?.total || 0;

        const sortOrder = ['ASC', 'DESC'].includes((sort || '').toUpperCase()) ? sort.toUpperCase() : 'DESC';
        const orderColumn = ['created_at', 'updated_at', 'name'].includes(orderBy) ? orderBy : 'created_at';

    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);
    const normalizedLimit = Number.isNaN(parsedLimit) ? 10 : parsedLimit;
    const normalizedOffset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;

        const safeLimit = Number.isFinite(normalizedLimit) && normalizedLimit > 0 ? Math.floor(normalizedLimit) : 10;
        const safeOffset = Number.isFinite(normalizedOffset) && normalizedOffset >= 0 ? Math.floor(normalizedOffset) : 0;

        const listSql = `
            SELECT c.*, b.name AS brand_name
            FROM collectibles c
            LEFT JOIN brands b ON b.id = c.brand_id
            ${whereSql}
            ORDER BY c.${orderColumn} ${sortOrder}
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;

        const listParams = [...params];
        const [rows] = await pool.execute(listSql, listParams);

        return {
            collectibles: rows.map((row) => new Collectible(row)),
            total
        };
    }

    toJSON() {
        return {
            id: this.id,
            blockchainId: this.blockchainId,
            name: this.name,
            brandId: this.brandId,
            designer: this.designer,
            material: this.material,
            batchNumber: this.batchNumber,
            productionDate: this.productionDate,
            description: this.description,
            hash: this.hash,
            qrCodeUrl: this.qrCodeUrl,
            nfcId: this.nfcId,
            currentOwnerId: this.currentOwnerId,
            current_owner_id: this.currentOwnerId,
            status: this.status,
            estimatedValue: this.estimatedValue,
            lastValuationDate: this.lastValuationDate,
            productPhoto: this.productPhoto || null,
            productPhotoMimeType: this.productPhotoMimeType || null,
            metadata: this.metadata,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            brand: this.brand,
            brandName: this.brandName,
            currentOwner: this.currentOwner,
            transferHistory: this.transferHistory,
            transferRequest: this.transferRequest
        };
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
            'UPDATE collectibles SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, this.id]
        );
        this.status = status;
        this.updatedAt = new Date();
    }
}

module.exports = Collectible;
module.exports.TransferHistory = TransferHistory;