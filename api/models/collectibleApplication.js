const { getPool } = require('../utils/db');

const ensureTable = (() => {
    let initialized = false;
    let initializingPromise = null;

    const ensureIndexes = async (pool) => {
        const statements = [
            'CREATE INDEX idx_collectible_applications_created_at ON collectible_applications (created_at)',
            'CREATE INDEX idx_collectible_applications_applicant_created_at ON collectible_applications (applicant_id, created_at)',
            'CREATE INDEX idx_collectible_applications_status_created_at ON collectible_applications (status, created_at)'
        ];

        for (const sql of statements) {
            try {
                await pool.execute(sql);
            } catch (error) {
                if (error && (error.code === 'ER_DUP_KEYNAME' || error.errno === 1061)) {
                    continue;
                }
                throw error;
            }
        }
    };

    return async () => {
        if (initialized) {
            return true;
        }

        if (!initializingPromise) {
            initializingPromise = (async () => {
                const pool = getPool();
                await pool.execute(`
                    CREATE TABLE IF NOT EXISTS collectible_applications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        applicant_id INT NOT NULL,
                        account_type VARCHAR(32) NOT NULL,
                        status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
                        application_data JSON,
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_applicant_id (applicant_id),
                        INDEX idx_status (status),
                        CONSTRAINT fk_collectible_applications_user FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                `);

                await ensureIndexes(pool);

                const schemaUpdates = [
                    'ALTER TABLE collectible_applications ADD COLUMN linked_collectible_id VARCHAR(128) NULL',
                    'ALTER TABLE collectible_applications ADD COLUMN linked_collectible_db_id INT NULL',
                    'ALTER TABLE collectible_applications ADD INDEX idx_collectible_applications_linked_id (linked_collectible_id)'
                ];

                for (const sql of schemaUpdates) {
                    try {
                        await pool.execute(sql);
                    } catch (error) {
                        if (error && (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060)) {
                            continue;
                        }
                        if (error && (error.code === 'ER_DUP_KEYNAME' || error.errno === 1061)) {
                            continue;
                        }
                        throw error;
                    }
                }
                initialized = true;
            })().catch((error) => {
                initializingPromise = null;
                throw error;
            });
        }

        await initializingPromise;
        return true;
    };
})();

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

class CollectibleApplication {
    constructor(data = {}) {
        this.id = data.id || null;
        this.applicantId = data.applicant_id || data.applicantId || null;
        this.accountType = data.account_type || data.accountType || null;
        this.status = data.status || 'PENDING_REVIEW';
        this.applicationData = parseJson(data.application_data || data.applicationData || {});
        this.notes = data.notes || null;
        this.createdAt = data.created_at ? new Date(data.created_at) : null;
        this.updatedAt = data.updated_at ? new Date(data.updated_at) : null;
        this.applicantName = data.applicant_name || data.applicantName || null;
        this.applicantEmail = data.applicant_email || data.applicantEmail || null;
        this.applicantRole = data.applicant_role || data.applicantRole || null;
        this.linkedCollectibleId = data.linked_collectible_id || data.linkedCollectibleId || null;
        this.linkedCollectibleDbId = data.linked_collectible_db_id || data.linkedCollectibleDbId || null;
    }

    async save() {
        await ensureTable();
        const pool = getPool();

        if (this.id) {
            await pool.execute(
                `UPDATE collectible_applications
                 SET account_type = ?, status = ?, application_data = ?, notes = ?,
                     linked_collectible_id = ?, linked_collectible_db_id = ?, updated_at = NOW()
                 WHERE id = ?`,
                [
                    this.accountType,
                    this.status,
                    JSON.stringify(this.applicationData || {}),
                    this.notes || null,
                    this.linkedCollectibleId || null,
                    this.linkedCollectibleDbId || null,
                    this.id
                ]
            );
            return this;
        }

        const [result] = await pool.execute(
            `INSERT INTO collectible_applications (applicant_id, account_type, status, application_data, notes, linked_collectible_id, linked_collectible_db_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                this.applicantId,
                this.accountType,
                this.status,
                JSON.stringify(this.applicationData || {}),
                this.notes || null,
                this.linkedCollectibleId || null,
                this.linkedCollectibleDbId || null
            ]
        );
        this.id = result.insertId;
        return this;
    }

    static async findById(id) {
        await ensureTable();
        const pool = getPool();
        const [rows] = await pool.execute(
            `SELECT ca.*, u.name AS applicant_name, u.email AS applicant_email, u.role AS applicant_role
             FROM collectible_applications ca
             JOIN users u ON ca.applicant_id = u.id
             WHERE ca.id = ?`,
            [id]
        );
        if (!rows.length) {
            return null;
        }
        return new CollectibleApplication(rows[0]);
    }

    static async findByApplicant(applicantId) {
        await ensureTable();
        const pool = getPool();
        const [rows] = await pool.execute(
            `SELECT ca.*, u.name AS applicant_name, u.email AS applicant_email, u.role AS applicant_role
             FROM collectible_applications ca
             JOIN users u ON ca.applicant_id = u.id
             WHERE ca.applicant_id = ?
             ORDER BY ca.created_at DESC`,
            [applicantId]
        );
        return rows.map((row) => new CollectibleApplication(row));
    }

    static async findAll({ status = null, limit = 50, offset = 0 } = {}) {
        await ensureTable();
        const pool = getPool();
        const filters = [];
        const filterParams = [];

        if (status) {
            filters.push('ca.status = ?');
            filterParams.push(status);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limitValue = Math.max(1, Number.parseInt(limit, 10) || 50);
    const offsetValue = Math.max(0, Number.parseInt(offset, 10) || 0);

        const [rows] = await pool.execute(
            `SELECT ca.*, u.name AS applicant_name, u.email AS applicant_email, u.role AS applicant_role
             FROM collectible_applications ca
             JOIN users u ON ca.applicant_id = u.id
             ${whereClause}
             ORDER BY ca.created_at DESC
             LIMIT ${limitValue} OFFSET ${offsetValue}`,
            filterParams
        );

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM collectible_applications ca
             ${whereClause}`,
            filterParams
        );

        const total = countRows?.[0]?.total || 0;

        return {
            rows: rows.map((row) => new CollectibleApplication(row)),
            total,
            limit: limitValue,
            offset: offsetValue
        };
    }

    static async countByStatus(status) {
        await ensureTable();
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT COUNT(*) AS total FROM collectible_applications WHERE status = ?',
            [status]
        );
        return rows?.[0]?.total || 0;
    }

    static async updateStatus(id, status, notes = null, options = {}) {
        await ensureTable();
        const pool = getPool();
        const updates = ['status = ?', 'notes = ?'];
        const params = [status, notes];

        if (Object.prototype.hasOwnProperty.call(options, 'linkedCollectibleId')) {
            updates.push('linked_collectible_id = ?');
            params.push(options.linkedCollectibleId || null);
        }

        if (Object.prototype.hasOwnProperty.call(options, 'linkedCollectibleDbId')) {
            updates.push('linked_collectible_db_id = ?');
            params.push(options.linkedCollectibleDbId || null);
        }

        updates.push('updated_at = NOW()');

        params.push(id);

        const [result] = await pool.execute(
            `UPDATE collectible_applications SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        return result.affectedRows > 0;
    }

    toJSON() {
        return {
            id: this.id,
            applicantId: this.applicantId,
            applicantName: this.applicantName,
            applicantEmail: this.applicantEmail,
            applicantRole: this.applicantRole,
            accountType: this.accountType,
            status: this.status,
            applicationData: this.applicationData,
            notes: this.notes,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            linkedCollectibleId: this.linkedCollectibleId,
            linkedCollectibleDbId: this.linkedCollectibleDbId
        };
    }
}

module.exports = CollectibleApplication;
