// 用户模型定义 - MySQL版本

const bcrypt = require('bcryptjs');
const { getPool } = require('../utils/db');

// 用户类
class User {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.email = data.email;
        this.phone = data.phone;
        this.icbcAccountId = data.icbc_account_id;
        this.icbcUserId = data.icbc_user_id;
        this.password = data.password;
        this.salt = data.salt;
        this.role = data.role;
        this.status = data.status;
        this.lastLogin = data.last_login;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    // 方法：验证密码
    async verifyPassword(password) {
        try {
            return await bcrypt.compare(password, this.password);
        } catch (error) {
            throw error;
        }
    }

    // 方法：生成JWT令牌
    generateAuthToken() {
        const jwt = require('jsonwebtoken');
        return jwt.sign({
            id: this.id,
            email: this.email,
            role: this.role,
            icbcUserId: this.icbcUserId
        }, process.env.JWT_SECRET || 'your-secret-key', {
            expiresIn: '24h'
        });
    }

    // 保存用户
    async save() {
        const pool = getPool();
        
        // 如果密码被修改，进行加密
        if (this.isPasswordModified) {
            const salt = await bcrypt.genSalt(10);
            this.salt = salt;
            this.password = await bcrypt.hash(this.password, salt);
        }

        try {
            if (this.id) {
                // 更新用户
                await pool.execute(
                    `UPDATE users 
                     SET name = ?, email = ?, phone = ?, icbc_account_id = ?, icbc_user_id = ?, 
                         password = ?, salt = ?, role = ?, status = ?, last_login = ? 
                     WHERE id = ?`,
                    [this.name, this.email, this.phone, this.icbcAccountId, this.icbcUserId,
                     this.password, this.salt, this.role, this.status, this.lastLogin, this.id]
                );
            } else {
                // 创建新用户
                const [result] = await pool.execute(
                    `INSERT INTO users (name, email, phone, icbc_account_id, icbc_user_id, 
                                        password, salt, role, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [this.name, this.email, this.phone, this.icbcAccountId, this.icbcUserId,
                     this.password, this.salt, this.role, this.status]
                );
                this.id = result.insertId;
            }
            return this;
        } catch (error) {
            throw error;
        }
    }

    // 静态方法：根据ID查找用户
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
        return rows.length > 0 ? new User(rows[0]) : null;
    }

    // 静态方法：根据邮箱查找用户
    static async findByEmail(email) {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE email = ? AND status = ?', 
            [email, 'ACTIVE']
        );
        return rows.length > 0 ? new User(rows[0]) : null;
    }

    // 静态方法：根据工行账户ID查找用户
    static async findByIcbcAccountId(icbcAccountId) {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE icbc_account_id = ? AND status = ?', 
            [icbcAccountId, 'ACTIVE']
        );
        return rows.length > 0 ? new User(rows[0]) : null;
    }

    // 静态方法：根据工行用户ID查找用户
    static async findByIcbcUserId(icbcUserId) {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE icbc_user_id = ? AND status = ?', 
            [icbcUserId, 'ACTIVE']
        );
        return rows.length > 0 ? new User(rows[0]) : null;
    }

    // 静态方法：获取所有用户（管理员用），支持过滤和分页
    static async findAll(role = null, status = null, search = null, limit = null, offset = null) {
        const pool = getPool();
        let query = 'SELECT * FROM users';
        const params = [];
        let conditions = [];
        
        // 添加过滤条件
        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (search) {
            const searchQuery = `%${search}%`;
            conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
            params.push(searchQuery, searchQuery, searchQuery);
        }
        
        // 添加WHERE子句
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        // 添加ORDER BY子句
        query += ' ORDER BY created_at DESC';
        
        // 添加分页
        if (limit !== null && offset !== null) {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }
        
        const [rows] = await pool.execute(query, params);
        return rows.map(row => new User(row));
    }
    
    // 静态方法：获取符合条件的用户总数
    static async countAll(role = null, status = null, search = null) {
        const pool = getPool();
        let query = 'SELECT COUNT(*) as count FROM users';
        const params = [];
        let conditions = [];
        
        // 添加过滤条件
        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (search) {
            const searchQuery = `%${search}%`;
            conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
            params.push(searchQuery, searchQuery, searchQuery);
        }
        
        // 添加WHERE子句
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        const [rows] = await pool.execute(query, params);
        return rows[0].count;
    }
    
    // 静态方法：查找用户的藏品（支持过滤和分页）
    static async findUserCollectibles(userId, status = null, search = null, limit = null, offset = null) {
        const pool = getPool();
        let query = `
            SELECT c.* 
            FROM collectibles c 
            JOIN user_collectibles uc ON c.id = uc.collectible_id 
            WHERE uc.user_id = ?
        `;
        const params = [userId];
        let conditions = [];
        
        // 添加过滤条件
        if (status) {
            conditions.push('c.status = ?');
            params.push(status);
        }
        if (search) {
            const searchQuery = `%${search}%`;
            conditions.push('(c.name LIKE ? OR c.batch_number LIKE ?)');
            params.push(searchQuery, searchQuery);
        }
        
        // 添加额外条件
        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }
        
        // 添加ORDER BY子句
        query += ' ORDER BY c.created_at DESC';
        
        // 添加分页
        if (limit !== null && offset !== null) {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }
    
    // 静态方法：获取用户藏品总数
    static async countUserCollectibles(userId, status = null, search = null) {
        const pool = getPool();
        let query = `
            SELECT COUNT(*) as count 
            FROM collectibles c 
            JOIN user_collectibles uc ON c.id = uc.collectible_id 
            WHERE uc.user_id = ?
        `;
        const params = [userId];
        let conditions = [];
        
        // 添加过滤条件
        if (status) {
            conditions.push('c.status = ?');
            params.push(status);
        }
        if (search) {
            const searchQuery = `%${search}%`;
            conditions.push('(c.name LIKE ? OR c.batch_number LIKE ?)');
            params.push(searchQuery, searchQuery);
        }
        
        // 添加额外条件
        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }
        
        const [rows] = await pool.execute(query, params);
        return rows[0].count;
    }

    // 静态方法：更新用户最后登录时间
    static async updateLastLogin(id) {
        const pool = getPool();
        await pool.execute(
            'UPDATE users SET last_login = NOW() WHERE id = ?', 
            [id]
        );
    }

    // 静态方法：删除用户
    static async deleteById(id) {
        const pool = getPool();
        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // 静态方法：查找用户的藏品
    static async findUserCollectibles(userId) {
        const pool = getPool();
        const [rows] = await pool.execute(
            `SELECT c.* FROM collectibles c 
             JOIN user_collectibles uc ON c.id = uc.collectible_id 
             WHERE uc.user_id = ?`,
            [userId]
        );
        return rows;
    }

    // 静态方法：添加用户藏品
    static async addUserCollectible(userId, collectibleId) {
        const pool = getPool();
        await pool.execute(
            'INSERT INTO user_collectibles (user_id, collectible_id) VALUES (?, ?)',
            [userId, collectibleId]
        );
    }

    // 静态方法：移除用户藏品
    static async removeUserCollectible(userId, collectibleId) {
        const pool = getPool();
        await pool.execute(
            'DELETE FROM user_collectibles WHERE user_id = ? AND collectible_id = ?',
            [userId, collectibleId]
        );
    }
}

module.exports = User;