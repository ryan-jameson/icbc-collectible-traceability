// 工银溯藏系统测试数据导入脚本
// 用于导入用户、品牌和藏品的测试数据到MySQL数据库

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../blockchain/config/.env') });

// 数据库连接配置
const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'collectible',
    port: process.env.MYSQL_PORT || 3306
};

// 测试数据
const testData = {
    // 用户测试数据
    users: [
        {
            name: '超级管理员',
            email: 'admin@icbc.com',
            phone: '13800000001',
            icbc_account_id: 'ICBC00000001',
            icbc_user_id: 'ICBCUSER00000001',
            password: 'admin123',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            account_type: 'ENTERPRISE'
        },
        {
            name: '工行管理员',
            email: 'icbcadmin@icbc.com',
            phone: '13800000002',
            icbc_account_id: 'ICBC00000002',
            icbc_user_id: 'ICBCUSER00000002',
            password: 'admin123',
            role: 'ICBC_ADMIN',
            status: 'ACTIVE',
            account_type: 'ENTERPRISE'
        },
        {
            name: '品牌管理员',
            email: 'brandadmin@example.com',
            phone: '13800000003',
            icbc_account_id: 'ICBC00000003',
            icbc_user_id: 'ICBCUSER00000003',
            password: 'admin123',
            role: 'BRAND_ADMIN',
            status: 'ACTIVE',
            account_type: 'ENTERPRISE'
        },
        {
            name: '个人测试用户',
            email: 'user@example.com',
            phone: '13800000004',
            icbc_account_id: 'ICBC00000004',
            icbc_user_id: 'ICBCUSER00000004',
            password: 'user123',
            role: 'USER',
            status: 'ACTIVE',
            account_type: 'PERSONAL'
        },
        {
            name: '企业测试用户',
            email: 'enterprise@example.com',
            phone: '13800000005',
            icbc_account_id: 'ICBC00000005',
            icbc_user_id: 'ICBCUSER00000005',
            password: 'user123',
            role: 'USER',
            status: 'ACTIVE',
            account_type: 'ENTERPRISE'
        }
    ],
    
    // 品牌测试数据
    brands: [
        {
            name: '工银金行家',
            logo: '/public/logos/gold.png',
            description: '工商银行贵金属品牌',
            website: 'https://www.icbc.com.cn',
            contact_email: 'gold@icbc.com',
            contact_phone: '400-8888-8888',
            blockchain_msp_id: 'Org1MSP',
            partnership_level: 'PLATINUM',
            partnership_start_date: new Date('2023-01-01'),
            product_categories: ['黄金', '白银', '铂族金属'],
            status: 'ACTIVE'
        },
        {
            name: '国博文创',
            logo: '/public/logos/guobo.png',
            description: '中国国家博物馆文创品牌',
            website: 'https://www.chnmuseum.cn',
            contact_email: 'wenchuang@chnmuseum.cn',
            contact_phone: '010-12345678',
            blockchain_msp_id: 'Org2MSP',
            partnership_level: 'GOLD',
            partnership_start_date: new Date('2023-03-01'),
            product_categories: ['文创产品', '艺术品复制品', '博物馆纪念品'],
            status: 'ACTIVE'
        }
    ],
    
    // 藏品测试数据模板
    collectibleTemplates: [
        {
            name: '故宫纪念金币',
            designer: '中国金币总公司',
            material: 'Au9999',
            batch_number: '2023-G-001',
            description: '中国故宫博物院建院95周年纪念金币'
        },
        {
            name: '长城纪念银币',
            designer: '中国金币总公司',
            material: 'Ag9999',
            batch_number: '2023-S-001',
            description: '中国长城文化纪念银币'
        },
        {
            name: '国博名画复刻品',
            designer: '国博文创设计团队',
            material: '高级宣纸',
            batch_number: '2023-A-001',
            description: '国家博物馆藏名画数字复刻品'
        }
    ]
};

// 连接数据库
async function connectDB() {
    try {
        console.log(`连接MySQL数据库: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        const connection = await mysql.createConnection(dbConfig);
        console.log('成功连接到数据库');
        return connection;
    } catch (error) {
        console.error('连接数据库失败:', error.message);
        process.exit(1);
    }
}

// 断开数据库连接
async function disconnectDB(connection) {
    try {
        if (connection) {
            await connection.end();
            console.log('已断开数据库连接');
        }
    } catch (error) {
        console.error('断开数据库连接失败:', error.message);
    }
}

// 清理现有数据
async function clearExistingData(connection) {
    try {
        console.log('开始清理现有数据...');
        // 注意：需要按照依赖顺序清理表数据
        await connection.execute('DELETE FROM user_collectibles');
        await connection.execute('DELETE FROM transfer_histories');
        await connection.execute('DELETE FROM collectibles');
        await connection.execute('DELETE FROM brands');
        await connection.execute('DELETE FROM users');
        console.log('清理数据完成');
    } catch (error) {
        console.error('清理数据失败:', error.message);
        throw error;
    }
}

// 导入用户数据
async function importUsers(connection) {
    try {
        console.log('开始导入用户数据...');
        const savedUsers = [];
        
        for (const userData of testData.users) {
            // 加密密码
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(userData.password, salt);
            
            const [result] = await connection.execute(
                `INSERT INTO users (name, email, phone, icbc_account_id, icbc_user_id, password, salt, role, status, account_type, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    userData.name,
                    userData.email,
                    userData.phone,
                    userData.icbc_account_id,
                    userData.icbc_user_id,
                    hashedPassword,
                    salt,
                    userData.role,
                    userData.status,
                    userData.account_type || 'PERSONAL'
                ]
            );
            
            savedUsers.push({
                ...userData,
                id: result.insertId,
                password: hashedPassword,
                salt: salt
            });
        }
        
        console.log(`成功导入 ${savedUsers.length} 个用户数据`);
        return savedUsers;
    } catch (error) {
        console.error('导入用户数据失败:', error.message);
        throw error;
    }
}

// 导入品牌数据
async function importBrands(connection, users) {
    try {
        console.log('开始导入品牌数据...');
        const adminUser = users.find(user => user.role === 'SUPER_ADMIN');
        
        const savedBrands = [];
        for (const brandData of testData.brands) {
            const [result] = await connection.execute(
                `INSERT INTO brands (name, logo, description, website, contact_email, contact_phone, blockchain_msp_id, partnership_level, partnership_start_date, status, created_by, approved_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    brandData.name,
                    brandData.logo,
                    brandData.description,
                    brandData.website,
                    brandData.contact_email,
                    brandData.contact_phone,
                    brandData.blockchain_msp_id,
                    brandData.partnership_level,
                    brandData.partnership_start_date,
                    brandData.status,
                    adminUser.id,
                    adminUser.id
                ]
            );
            
            savedBrands.push({
                ...brandData,
                id: result.insertId,
                created_by: adminUser.id,
                approved_by: adminUser.id
            });
        }
        
        console.log(`成功导入 ${savedBrands.length} 个品牌数据`);
        return savedBrands;
    } catch (error) {
        console.error('导入品牌数据失败:', error.message);
        throw error;
    }
}

// 导入藏品数据
async function importCollectibles(connection, users, brands) {
    try {
        console.log('开始导入藏品数据...');
        const user = users.find(u => u.role === 'USER');
        const savedCollectibles = [];
        let itemCount = 0;
        
        // 为每个品牌创建藏品
        for (const brand of brands) {
            for (const template of testData.collectibleTemplates) {
                itemCount++;
                
                // 生成唯一的区块链ID和哈希值
                const blockchainId = `COLLECTIBLE-${Date.now()}-${itemCount}`;
                const hash = `HASH-${Date.now()}-${itemCount}`;
                
                // 随机分配所有权
                const hasOwner = Math.random() > 0.5;
                
                const productionDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
                
                // 插入藏品数据
                const [result] = await connection.execute(
                    `INSERT INTO collectibles (blockchain_id, name, brand_id, designer, material, batch_number, production_date, description, hash, qr_code_url, current_owner_id, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        blockchainId,
                        template.name,
                        brand.id,
                        template.designer,
                        template.material,
                        template.batch_number,
                        productionDate,
                        template.description,
                        hash,
                        `/public/qrcodes/${hash}.png`,
                        hasOwner ? user.id : null,
                        'ACTIVE'
                    ]
                );
                
                const collectibleId = result.insertId;
                savedCollectibles.push({
                    id: collectibleId,
                    blockchainId: blockchainId,
                    name: template.name,
                    brand_id: brand.id,
                    current_owner_id: hasOwner ? user.id : null
                });
                
                // 插入流转历史
                await connection.execute(
                    `INSERT INTO transfer_histories (collectible_id, from_user, to_user, type, transaction_id, timestamp)
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        collectibleId,
                        'SYSTEM',
                        hasOwner ? user.icbc_user_id : 'UNCLAIMED',
                        hasOwner ? 'CLAIM' : 'TRANSFER',
                        `TX-${Date.now()}-${itemCount}`
                    ]
                );
                
                // 如果有所有者，更新用户藏品关联
                if (hasOwner) {
                    await connection.execute(
                        `INSERT INTO user_collectibles (user_id, collectible_id)
                         VALUES (?, ?)`,
                        [user.id, collectibleId]
                    );
                }
            }
        }
        
        console.log(`成功导入 ${savedCollectibles.length} 个藏品数据`);
        console.log(`已更新用户 ${user.name} 的藏品列表`);
        
        return savedCollectibles;
    } catch (error) {
        console.error('导入藏品数据失败:', error.message);
        throw error;
    }
}

// 主函数
async function main() {
    let connection = null;
    try {
        console.log('=======================================');
        console.log('工银溯藏系统测试数据导入工具');
        console.log('=======================================');
        
        // 连接数据库
        connection = await connectDB();
        
        // 清理现有数据
        await clearExistingData(connection);
        
        // 导入数据
        const users = await importUsers(connection);
        const brands = await importBrands(connection, users);
        await importCollectibles(connection, users, brands);
        
        console.log('=======================================');
        console.log('测试数据导入完成!');
        console.log('\n测试账号信息:');
        console.log('超级管理员: admin@icbc.com / admin123');
        console.log('工行管理员: icbcadmin@icbc.com / admin123');
        console.log('品牌管理员: brandadmin@example.com / admin123');
        console.log('普通用户: user@example.com / user123');
        console.log('=======================================');
        
    } catch (error) {
        console.error('导入数据过程中发生错误:', error);
    } finally {
        // 断开数据库连接
        await disconnectDB(connection);
        process.exit(0);
    }
}

// 运行主函数
main();