// 品牌模型定义 - MySQL版本

const { getPool } = require('../utils/db');

// 品牌类
class Brand {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.logo = data.logo;
        this.description = data.description;
        this.website = data.website;
        this.contactEmail = data.contact_email;
        this.contactPhone = data.contact_phone;
        this.blockchainMspId = data.blockchain_msp_id;
        this.partnershipLevel = data.partnership_level;
        this.partnershipStartDate = data.partnership_start_date;
        this.partnershipEndDate = data.partnership_end_date;
        this.status = data.status;
        this.createdBy = data.created_by;
        this.approvedBy = data.approved_by;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
        // 产品分类在MySQL中以JSON或分隔符存储，这里简化处理
        this.productCategories = data.product_categories ? JSON.parse(data.product_categories) : [];
    }

    // 保存品牌
    async save() {
        const pool = getPool();
        
        try {
            if (this.id) {
                // 更新品牌
                await pool.execute(
                    `UPDATE brands 
                     SET name = ?, logo = ?, description = ?, website = ?, contact_email = ?, 
                         contact_phone = ?, blockchain_msp_id = ?, partnership_level = ?, 
                         partnership_start_date = ?, partnership_end_date = ?, status = ?, 
                         created_by = ?, approved_by = ?, product_categories = ? 
                     WHERE id = ?`,
                    [this.name, this.logo, this.description, this.website, this.contactEmail,
                     this.contactPhone, this.blockchainMspId, this.partnershipLevel,
                     this.partnershipStartDate, this.partnershipEndDate, this.status,
                     this.createdBy, this.approvedBy, JSON.stringify(this.productCategories), this.id]
                );
            } else {
                // 创建新品牌
                const [result] = await pool.execute(
                    `INSERT INTO brands (name, logo, description, website, contact_email, 
                                        contact_phone, blockchain_msp_id, partnership_level, 
                                        partnership_start_date, partnership_end_date, status, 
                                        created_by, approved_by, product_categories) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [this.name, this.logo, this.description, this.website, this.contactEmail,
                     this.contactPhone, this.blockchainMspId, this.partnershipLevel,
                     this.partnershipStartDate, this.partnershipEndDate, this.status,
                     this.createdBy, this.approvedBy, JSON.stringify(this.productCategories)]
                );
                this.id = result.insertId;
            }
            return this;
        } catch (error) {
            throw error;
        }
    }

    // 静态方法：根据ID查找品牌
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands WHERE id = ?', [id]);
        return rows.length > 0 ? new Brand(rows[0]) : null;
    }

    // 静态方法：根据名称查找品牌
    static async findByName(name) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands WHERE name = ?', [name]);
        return rows.length > 0 ? new Brand(rows[0]) : null;
    }

    // 静态方法：根据区块链MSP ID查找品牌
    static async findByBlockchainMspId(blockchainMspId) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands WHERE blockchain_msp_id = ?', [blockchainMspId]);
        return rows.length > 0 ? new Brand(rows[0]) : null;
    }

    // 静态方法：根据联系邮箱查找品牌
    static async findByContactEmail(contactEmail) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands WHERE contact_email = ?', [contactEmail]);
        return rows.length > 0 ? new Brand(rows[0]) : null;
    }

    // 静态方法：获取所有品牌
    static async findAll() {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands');
        return rows.map(row => new Brand(row));
    }

    // 静态方法：根据状态获取品牌
    static async findByStatus(status) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands WHERE status = ?', [status]);
        return rows.map(row => new Brand(row));
    }

    // 静态方法：获取第一条有效品牌记录
    static async findFirstActive() {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM brands WHERE status = ? ORDER BY created_at ASC LIMIT 1',
            ['ACTIVE']
        );
        if (rows.length > 0) {
            return new Brand(rows[0]);
        }

        const [anyRows] = await pool.execute(
            'SELECT * FROM brands ORDER BY created_at ASC LIMIT 1'
        );
        return anyRows.length > 0 ? new Brand(anyRows[0]) : null;
    }

    // 静态方法：获取某用户创建的品牌
    static async findByCreatedBy(userId) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM brands WHERE created_by = ?', [userId]);
        return rows.map(row => new Brand(row));
    }

    // 静态方法：删除品牌
    static async deleteById(id) {
        const pool = getPool();
        const [result] = await pool.execute('DELETE FROM brands WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // 静态方法：更新品牌状态
    static async updateStatus(id, status, approvedBy = null) {
        const pool = getPool();
        await pool.execute(
            'UPDATE brands SET status = ?, approved_by = ? WHERE id = ?',
            [status, approvedBy, id]
        );
    }

    // 静态方法：搜索品牌（按名称或描述）
    static async search(query) {
        const pool = getPool();
        const searchQuery = `%${query}%`;
        const [rows] = await pool.execute(
            'SELECT * FROM brands WHERE name LIKE ? OR description LIKE ?',
            [searchQuery, searchQuery]
        );
        return rows.map(row => new Brand(row));
    }
}

module.exports = Brand;