// 藏品控制器

const Collectible = require('../models/collectible');
const Brand = require('../models/brand');
const User = require('../models/user');
const { TransferHistory } = require('../models/collectible');
const CollectibleApplication = require('../models/collectibleApplication');
const blockchain = require('../../blockchain');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const logger = require('../../blockchain/utils/log-utils');

const normalizeTransferAccountType = (value, fallback = 'PERSONAL') => {
    const candidate = (value || fallback || '').toString().toUpperCase();
    return candidate === 'ENTERPRISE' ? 'ENTERPRISE' : 'PERSONAL';
};

const sanitizeEnterpriseInfo = (data = {}) => {
    if (!data) {
        return null;
    }
    const registrationNumber = data.registrationNumber || data.registration_number || data.regNumber || null;
    const companyName = data.companyName || data.company_name || data.name || null;

    if (!registrationNumber && !companyName) {
        return null;
    }

    return {
        registrationNumber: registrationNumber ? registrationNumber.toString().trim() : null,
        companyName: companyName ? companyName.toString().trim() : null
    };
};

const sanitizePersonalInfo = (data = {}) => {
    if (!data) {
        return null;
    }

    const platform = data.platform || data.platformName || null;
    const platformId = data.platformId || data.platform_id || data.accountId || null;
    const personalName = data.personalName || data.name || null;

    if (!platform && !platformId && !personalName) {
        return null;
    }

    return {
        platform: platform ? platform.toString().trim() : null,
        platformId: platformId ? platformId.toString().trim() : null,
        personalName: personalName ? personalName.toString().trim() : null
    };
};

const buildQualificationPayload = ({ accountType, enterpriseInfo, personalInfo } = {}) => {
    const normalizedAccountType = normalizeTransferAccountType(accountType);
    const sanitizedEnterprise = normalizedAccountType === 'ENTERPRISE' ? sanitizeEnterpriseInfo(enterpriseInfo) : null;
    const sanitizedPersonal = normalizedAccountType === 'PERSONAL' ? sanitizePersonalInfo(personalInfo) : null;

    return {
        accountType: normalizedAccountType,
        enterpriseInfo: sanitizedEnterprise,
        personalInfo: sanitizedPersonal
    };
};

const ensureQualificationCompleteness = (qualification, contextLabel = 'QUALIFICATION') => {
    if (!qualification) {
        const error = new Error(`${contextLabel}_MISSING`);
        error.code = `${contextLabel}_MISSING`;
        throw error;
    }

    if (qualification.accountType === 'ENTERPRISE') {
        const registration = qualification.enterpriseInfo?.registrationNumber;
        const company = qualification.enterpriseInfo?.companyName;
        if (!registration || !company) {
            const error = new Error('企业资质信息需包含注册号与企业名称');
            error.code = `${contextLabel}_ENTERPRISE_FIELDS_MISSING`;
            throw error;
        }
    } else {
        const platform = qualification.personalInfo?.platform;
        const platformId = qualification.personalInfo?.platformId;
        const personalName = qualification.personalInfo?.personalName;
        if (!platform || !platformId || !personalName) {
            const error = new Error('个人资质信息需包含创作者平台、平台ID与姓名');
            error.code = `${contextLabel}_PERSONAL_FIELDS_MISSING`;
            throw error;
        }
    }

    return qualification;
};

const buildQualificationSummary = (qualification) => {
    if (!qualification) {
        return null;
    }

    const sanitized = buildQualificationPayload(qualification);

    if (sanitized.accountType === 'ENTERPRISE') {
        const registration = sanitized.enterpriseInfo?.registrationNumber || '注册号缺失';
        const company = sanitized.enterpriseInfo?.companyName || '企业名称缺失';
        return `企业 · ${registration} · ${company}`;
    }

    const platform = sanitized.personalInfo?.platform || '平台缺失';
    const platformId = sanitized.personalInfo?.platformId || '平台ID缺失';
    const personalName = sanitized.personalInfo?.personalName || '姓名缺失';
    return `个人 · ${platform} · ${platformId} · ${personalName}`;
};

const serializeQualificationForResponse = (qualification) => {
    if (!qualification) {
        return null;
    }

    const sanitized = buildQualificationPayload(qualification);

    return {
        accountType: sanitized.accountType,
        enterpriseInfo: sanitized.enterpriseInfo,
        personalInfo: sanitized.personalInfo,
        summary: buildQualificationSummary(sanitized)
    };
};

const fetchLatestOwnerQualification = async (collectibleId, ownerId) => {
    if (!collectibleId || !ownerId) {
        return null;
    }

    try {
        const historyRecords = await TransferHistory.findByCollectibleId(collectibleId);
        const ownerIdStr = ownerId.toString();
        const latestRecord = historyRecords.find((record) => record.to && record.to.toString() === ownerIdStr);
        const qualification = latestRecord?.metadata?.toQualification || latestRecord?.metadata?.qualification || null;
        return qualification ? buildQualificationPayload(qualification) : null;
    } catch (error) {
        logger.warn(`获取最新资质信息失败: ${error.message} [Collectible: ${collectibleId}, Owner: ${ownerId}]`);
        return null;
    }
};

const resolveCollectibleOwnerId = (collectible) => {
    if (!collectible) {
        return null;
    }

    if (collectible.currentOwnerId !== undefined && collectible.currentOwnerId !== null) {
        return collectible.currentOwnerId;
    }

    if (collectible.current_owner_id !== undefined && collectible.current_owner_id !== null) {
        return collectible.current_owner_id;
    }

    if (collectible.currentOwner && collectible.currentOwner.id !== undefined && collectible.currentOwner.id !== null) {
        return collectible.currentOwner.id;
    }

    return null;
};

const normalizeCreationType = (value, fallback = 'ENTERPRISE') => {
    const normalized = (value || fallback || 'ENTERPRISE').toString().toUpperCase();
    return normalized === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE';
};

const createDefaultBrandForSuperAdmin = async (user) => {
    const existing = await Brand.findByName('平台默认品牌');
    if (existing) {
        return existing;
    }

    const timestamp = Date.now();
    const defaultBrand = new Brand({
        name: '平台默认品牌',
        logo: null,
        description: '系统自动创建的默认品牌，用于快速创建藏品。',
        website: null,
        contact_email: `default-brand-${timestamp}@icbc.com`,
        contact_phone: null,
        blockchain_msp_id: `AUTO-MSP-${timestamp}`,
        partnership_level: 'PLATINUM',
        partnership_start_date: new Date(),
        partnership_end_date: null,
        status: 'ACTIVE',
        created_by: user.id,
        approved_by: user.id,
        product_categories: JSON.stringify([])
    });
    await defaultBrand.save();
    return defaultBrand;
};

const resolveBrandForCreation = async (user, providedBrandId) => {
    let brand = null;

    if (user.role === 'BRAND_ADMIN') {
        const ownBrands = await Brand.findByCreatedBy(user.id);
        if (ownBrands.length > 0) {
            brand = ownBrands.find((item) => item.status === 'ACTIVE') || ownBrands[0];
        }
    }

    if (!brand && providedBrandId !== undefined && providedBrandId !== null && providedBrandId !== '') {
        const parsedBrandId = Number.parseInt(providedBrandId, 10);
        if (Number.isNaN(parsedBrandId)) {
            const error = new Error('INVALID_BRAND_ID');
            error.code = 'INVALID_BRAND_ID';
            throw error;
        }
        const providedBrand = await Brand.findById(parsedBrandId);
        if (!providedBrand) {
            const error = new Error('BRAND_NOT_FOUND');
            error.code = 'BRAND_NOT_FOUND';
            throw error;
        }
        brand = providedBrand;
    }

    if (!brand && user.role === 'SUPER_ADMIN') {
        brand = await Brand.findFirstActive();
        if (!brand) {
            brand = await createDefaultBrandForSuperAdmin(user);
        }
    }

    if (!brand) {
        brand = await Brand.findFirstActive();
    }

    return brand;
};

const extractImageAttachment = (attachments = []) => {
    if (!Array.isArray(attachments)) {
        return { buffer: null, mimeType: null, name: null };
    }

    for (const attachment of attachments) {
        if (!attachment) {
            // eslint-disable-next-line no-continue
            continue;
        }

        const declaredType = typeof attachment.type === 'string' ? attachment.type : null;
        const content = attachment.content || attachment.base64Content || null;

        let mimeType = declaredType || null;
        let base64Payload = null;

        if (typeof content === 'string') {
            if (content.startsWith('data:')) {
                const match = content.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    base64Payload = match[2];
                }
            }

            if (!base64Payload) {
                base64Payload = content;
            }
        }

        if (!mimeType || !mimeType.startsWith('image/')) {
            if (declaredType && declaredType.startsWith('image/')) {
                mimeType = declaredType;
            } else if (typeof content === 'string' && content.startsWith('data:image/')) {
                mimeType = content.slice(5, content.indexOf(';'));
            } else {
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        try {
            const buffer = Buffer.from(base64Payload || '', 'base64');
            if (buffer.length === 0) {
                // eslint-disable-next-line no-continue
                continue;
            }
            return {
                buffer,
                mimeType,
                name: attachment.name || 'attachment'
            };
        } catch (error) {
            logger.warn('解析附件图像失败', error);
        }
    }

    return { buffer: null, mimeType: null, name: null };
};

const parseBase64Image = (payload) => {
    if (payload === undefined) {
        return { provided: false, buffer: null, mimeType: null };
    }

    if (payload === null || payload === '') {
        return { provided: true, buffer: null, mimeType: null };
    }

    if (typeof payload !== 'string') {
        const error = new Error('INVALID_IMAGE_DATA');
        error.code = 'INVALID_IMAGE_DATA';
        throw error;
    }

    let base64Data = payload;
    let mimeType = null;

    if (base64Data.startsWith('data:')) {
        const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            mimeType = match[1];
            base64Data = match[2];
        }
    }

    try {
        const buffer = Buffer.from(base64Data, 'base64');
        if (!buffer.length) {
            const error = new Error('INVALID_IMAGE_DATA');
            error.code = 'INVALID_IMAGE_DATA';
            throw error;
        }
        return { provided: true, buffer, mimeType };
    } catch (error) {
        const err = new Error('INVALID_IMAGE_DATA');
        err.code = 'INVALID_IMAGE_DATA';
        throw err;
    }
};

const createCollectibleFromApplication = async (application, adminUser) => {
    const applicationData = application.applicationData || {};
    const applicantAccountType = application.accountType || adminUser.accountType || 'ENTERPRISE';
    const normalizedCreationType = normalizeCreationType(applicationData.creationType, applicantAccountType);

    const name = applicationData.name || `客户申请藏品-${application.id}`;
    const description = applicationData.description || '客户提交申请的藏品';
    const collectibleType = applicationData.collectibleType || 'GENERAL';
    const publishDateCandidate = applicationData.publishDate ? new Date(applicationData.publishDate) : new Date();
    const publishDateISO = Number.isNaN(publishDateCandidate.getTime())
        ? new Date().toISOString()
        : publishDateCandidate.toISOString();
    const estimatedValue = Number.parseFloat(applicationData.estimatedValue) || 0;
    const enterpriseInfo = applicationData.enterpriseInfo || {};
    const personalInfo = applicationData.personalInfo || {};
    const applicantQualification = buildQualificationPayload({
        accountType: normalizedCreationType,
        enterpriseInfo,
        personalInfo
    });
    const applicantQualificationSummary = buildQualificationSummary(applicantQualification);

    const designer = normalizedCreationType === 'PERSONAL'
        ? (personalInfo.personalName || adminUser.name || '个人创作者')
        : (enterpriseInfo.companyName || adminUser.name || '企业创作者');

    const { buffer: productPhotoBuffer, mimeType: productPhotoMimeType } = extractImageAttachment(applicationData.attachments);

    const applicantUser = await User.findById(application.applicantId);
    if (!applicantUser) {
        const error = new Error('APPLICANT_NOT_FOUND');
        error.code = 'APPLICANT_NOT_FOUND';
        throw error;
    }

    const brandPreference = applicationData.brandId || applicationData.brand_id || null;
    const brand = await resolveBrandForCreation(adminUser, brandPreference);
    if (!brand) {
        const error = new Error('NO_AVAILABLE_BRAND');
        error.code = 'NO_AVAILABLE_BRAND';
        throw error;
    }

    const collectibleId = `COL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const batchNumber = `BATCH-${Date.now()}`;

    logger.info(`审批通过，准备创建藏品 [申请ID: ${application.id}, 藏品ID: ${collectibleId}]`);
    logger.logTransaction('APPROVE_COLLECTIBLE_APPLICATION', adminUser.id, collectibleId, {
        applicationId: application.id,
        applicantId: application.applicantId,
        creationType: normalizedCreationType
    });

    const blockchainResult = await blockchain.invoke(
        'createCollectible',
        collectibleId,
        name,
        brand.name,
        designer,
        collectibleType,
        batchNumber,
        publishDateISO,
        description
    );

    const qrCodeData = `${process.env.APP_URL || ''}/collectibles/${collectibleId}`;
    const qrCodeFilename = `${collectibleId}.png`;
    const qrCodePath = path.join(__dirname, '..', 'public', 'qr-codes', qrCodeFilename);
    const qrCodeDir = path.dirname(qrCodePath);
    if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
    }
    await qrcode.toFile(qrCodePath, qrCodeData);

    const metadata = {
        creationType: normalizedCreationType,
        collectibleType,
        publishDate: publishDateISO,
        estimatedValue,
        productDescription: description,
        productPhotoMimeType: productPhotoMimeType || null,
        sourceApplication: {
            applicationId: application.id,
            applicantId: application.applicantId,
            approvedBy: adminUser.id,
            approvedAt: new Date().toISOString()
        },
        qualification: applicantQualification,
        qualificationSummary: applicantQualificationSummary
    };

    if (normalizedCreationType === 'ENTERPRISE' && Object.keys(enterpriseInfo).length) {
        metadata.enterpriseInfo = enterpriseInfo;
    }
    if (normalizedCreationType === 'PERSONAL' && Object.keys(personalInfo).length) {
        metadata.personalInfo = personalInfo;
    }

    const collectible = new Collectible({
        blockchain_id: collectibleId,
        name,
        brand_id: brand.id,
        designer,
        material: collectibleType,
        batch_number: batchNumber,
        production_date: new Date(publishDateISO),
        description,
        hash: blockchainResult.hash,
        qr_code_url: `/public/qr-codes/${qrCodeFilename}`,
        current_owner_id: applicantUser.id,
        created_by: adminUser.id,
        status: 'ACTIVE',
        estimated_value: estimatedValue,
        metadata
    });

    if (productPhotoBuffer) {
        collectible.productPhotoBuffer = productPhotoBuffer;
    }
    if (productPhotoMimeType) {
        collectible.productPhotoMimeType = productPhotoMimeType;
    }

    await collectible.save();

    try {
        await User.addUserCollectible(applicantUser.id, collectible.id);
    } catch (linkError) {
        logger.warn(`申请藏品绑定用户失败: ${linkError.message} [申请ID: ${application.id}, 用户: ${applicantUser.id}]`);
    }

    try {
        const transferHistory = new TransferHistory();
        const brandQualification = brand ? buildQualificationPayload({
            accountType: 'ENTERPRISE',
            enterpriseInfo: {
                registrationNumber: brand.blockchain_msp_id || brand.blockchainMspId || brand.blockchainMspID || brand.blockchainId || brand.id,
                companyName: brand.name || '品牌方'
            }
        }) : null;
        await transferHistory.save({
            collectibleId: collectible.id,
            from: brand.id ? `BRAND:${brand.id}` : 'SYSTEM',
            to: applicantUser.id.toString(),
            type: 'MINT',
            metadata: {
                applicationId: application.id,
                approvedBy: adminUser.id,
                toQualification: applicantQualification,
                fromQualification: brandQualification
            }
        });
    } catch (historyError) {
        logger.warn(`记录申请铸造历史失败: ${historyError.message} [申请ID: ${application.id}]`);
    }

    const persisted = await Collectible.findByBlockchainId(collectibleId);

    logger.info(`客户申请转化为藏品成功 [申请ID: ${application.id}, 藏品ID: ${collectibleId}, 哈希: ${blockchainResult.hash}]`);

    return {
        collectible: persisted,
        blockchainId: collectibleId,
        applicantUser
    };
};

// 创建藏品
exports.createCollectible = async (req, res) => {
    try {
        const {
            name,
            description,
            estimatedValue,
            collectibleType,
            publishDate,
            creationType,
            enterpriseRegistrationNumber,
            enterpriseName,
            personalPlatform,
            personalPlatformId,
            personalName
        } = req.body;
        const productPhotoFile = req.file || null;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: '缺少参数',
                message: '请填写产品名称'
            });
        }
        if (!description) {
            return res.status(400).json({
                success: false,
                error: '缺少参数',
                message: '请填写产品描述'
            });
        }
        if (!collectibleType) {
            return res.status(400).json({
                success: false,
                error: '缺少参数',
                message: '请选择藏品类型'
            });
        }
        if (!publishDate) {
            return res.status(400).json({
                success: false,
                error: '缺少参数',
                message: '请选择发布日期'
            });
        }

        const normalizedCreationType = (creationType || 'ENTERPRISE').toUpperCase() === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE';
        if (normalizedCreationType === 'ENTERPRISE') {
            if (!enterpriseRegistrationNumber || !enterpriseName) {
                return res.status(400).json({
                    success: false,
                    error: '缺少参数',
                    message: '企业创作需提供注册号和企业名称'
                });
            }
        } else if (normalizedCreationType === 'PERSONAL') {
            if (!personalPlatform || !personalPlatformId || !personalName) {
                return res.status(400).json({
                    success: false,
                    error: '缺少参数',
                    message: '个人创作需提供平台、平台ID和个人姓名'
                });
            }
        }

        const normalizedEstimatedValue = Number.parseFloat(estimatedValue) || 0;
        const publishDateObj = new Date(publishDate);
        if (Number.isNaN(publishDateObj.getTime())) {
            return res.status(400).json({
                success: false,
                error: '参数格式错误',
                message: '发布日期格式不正确'
            });
        }
        const publishDateISO = publishDateObj.toISOString();
        const batchNumber = `BATCH-${Date.now()}`;
        const designer = normalizedCreationType === 'PERSONAL'
            ? (personalName || '个人创作者')
            : (enterpriseName || '企业创作者');
        const blockchainMaterial = collectibleType;
        const productPhotoBuffer = productPhotoFile?.buffer || null;
        const productPhotoMimeType = productPhotoFile?.mimetype || null;

        const metadata = {
            creationType: normalizedCreationType,
            collectibleType,
            publishDate: publishDateISO,
            estimatedValue: normalizedEstimatedValue,
            productDescription: description,
            productPhotoMimeType,
            enterpriseInfo: normalizedCreationType === 'ENTERPRISE' ? {
                registrationNumber: enterpriseRegistrationNumber,
                companyName: enterpriseName
            } : undefined,
            personalInfo: normalizedCreationType === 'PERSONAL' ? {
                platform: personalPlatform,
                platformId: personalPlatformId,
                personalName
            } : undefined
        };
        if (metadata.enterpriseInfo === undefined) {
            delete metadata.enterpriseInfo;
        }
        if (metadata.personalInfo === undefined) {
            delete metadata.personalInfo;
        }
        if (!productPhotoBuffer) {
            metadata.productPhotoMimeType = null;
        }

        let brand;
        try {
            brand = await resolveBrandForCreation(req.user, req.body.brandId);
        } catch (brandError) {
            if (brandError.code === 'INVALID_BRAND_ID') {
                return res.status(400).json({
                    success: false,
                    error: '参数格式错误',
                    message: '品牌编号格式不正确'
                });
            }
            if (brandError.code === 'BRAND_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    error: '品牌不存在',
                    message: '未找到指定的品牌，请检查后重试'
                });
            }
            throw brandError;
        }

        if (!brand) {
            logger.warn(`创建藏品失败: 未找到可用品牌 [用户: ${req.user.id}]`);
            return res.status(400).json({
                success: false,
                error: '缺少品牌',
                message: '未找到可用品牌，请先创建品牌或联系管理员配置品牌信息'
            });
        }

        if (req.user.role === 'BRAND_ADMIN' && brand.createdBy && req.user.id !== brand.createdBy) {
            logger.warn(`创建藏品失败: 品牌管理员尝试使用非所属品牌 [用户: ${req.user.id}, 品牌ID: ${brand.id}]`);
            return res.status(403).json({
                success: false,
                error: '权限不足',
                message: '您只能为自己管理的品牌创建藏品'
            });
        }

        const brandId = brand.id;
        const collectibleId = `COL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        logger.info(`开始创建藏品 [ID: ${collectibleId}, 品牌: ${brand.name}, 用户: ${req.user.id}]`);
        logger.logTransaction('CREATE_COLLECTIBLE', req.user.id, collectibleId, {
            name,
            designer,
            material: blockchainMaterial,
            batchNumber,
            creationType: metadata.creationType
        });

        const blockchainCollectible = await blockchain.invoke(
            'createCollectible',
            collectibleId,
            name,
            brand.name,
            designer,
            blockchainMaterial,
            batchNumber,
            publishDateISO,
            description
        );

        const qrCodeData = `${process.env.APP_URL || ''}/collectibles/${collectibleId}`;
        const qrCodeFilename = `${collectibleId}.png`;
        const qrCodePath = path.join(__dirname, '..', 'public', 'qr-codes', qrCodeFilename);

        const qrCodeDir = path.dirname(qrCodePath);
        if (!fs.existsSync(qrCodeDir)) {
            fs.mkdirSync(qrCodeDir, { recursive: true });
        }

        await qrcode.toFile(qrCodePath, qrCodeData);

        const initialStatus = req.user.role === 'SUPER_ADMIN' ? 'ACTIVE' : 'PENDING_REVIEW';

        const collectible = new Collectible({
            blockchain_id: collectibleId,
            name,
            brand_id: brandId,
            designer,
            material: blockchainMaterial,
            batch_number: batchNumber,
            production_date: new Date(publishDateISO),
            description,
            hash: blockchainCollectible.hash,
            qr_code_url: `/public/qr-codes/${qrCodeFilename}`,
            current_owner_id: null,
            created_by: req.user.id,
            status: initialStatus,
            estimated_value: normalizedEstimatedValue,
            metadata,
            product_photo: productPhotoBuffer,
            productPhotoMimeType
        });
        collectible.productPhotoBuffer = productPhotoBuffer;
        await collectible.save();

        const fullCollectible = await Collectible.findByBlockchainId(collectibleId);

        logger.info(`藏品创建成功 [ID: ${collectibleId}, 哈希: ${blockchainCollectible.hash}]`);

        const successMessage = req.user.role === 'SUPER_ADMIN'
            ? '藏品创建并已上链'
            : '藏品创建成功，待审批后将上链';

        res.status(201).json({
            success: true,
            message: successMessage,
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

// 认领藏品（提交审批）
exports.claimCollectible = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id.toString();
    const { applicationDetails = null } = req.body || {};

    try {
        const collectible = await Collectible.findByBlockchainId(id);

        if (!collectible) {
            logger.warn(`认领藏品失败: 藏品不存在 [ID: ${id}, 用户: ${userId}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }

        const existingOwnerId = resolveCollectibleOwnerId(collectible);

        if (existingOwnerId) {
            logger.warn(`认领藏品失败: 藏品已被认领 [ID: ${id}, 用户: ${userId}]`);
            return res.status(400).json({
                success: false,
                error: '藏品已被认领',
                message: '该藏品已被其他用户认领'
            });
        }

        if (collectible.status === 'TRANSFER_PENDING' && collectible.transferRequest?.status === 'PENDING') {
            logger.warn(`认领藏品失败: 已存在待审批的认领请求 [ID: ${id}, 用户: ${userId}]`);
            return res.status(409).json({
                success: false,
                error: 'CLAIM_PENDING',
                message: '已有待审批的认领申请，请等待管理员处理'
            });
        }

        const requesterName = req.user?.name || req.user?.email || `用户${userId}`;
        const requesterEmail = req.user?.email || null;

        const qualification = buildQualificationPayload({
            accountType: applicationDetails?.accountType || req.user?.accountType,
            enterpriseInfo: applicationDetails?.enterpriseInfo,
            personalInfo: applicationDetails?.personalInfo
        });
        ensureQualificationCompleteness(qualification, 'CLAIM_QUALIFICATION');
        const qualificationSummary = buildQualificationSummary(qualification);

        const transferRequest = {
            type: 'CLAIM',
            requestedBy: userId,
            newOwnerId: userId,
            newOwnerName: requesterName,
            newOwnerEmail: requesterEmail,
            requestedAt: new Date().toISOString(),
            status: 'PENDING',
            applicationDetails: applicationDetails || null,
            accountType: qualification.accountType,
            enterpriseInfo: qualification.enterpriseInfo,
            personalInfo: qualification.personalInfo,
            qualificationSummary,
            toQualification: qualification
        };

        await collectible.update(collectible.id, {
            transfer_request: transferRequest,
            status: 'TRANSFER_PENDING'
        });

        logger.logTransaction('REQUEST_CLAIM_COLLECTIBLE', userId, id, {
            transferRequest
        });

        const updatedCollectible = await Collectible.findByBlockchainId(id);

        return res.status(200).json({
            success: true,
            message: '认领申请已提交，待管理员确认',
            data: updatedCollectible
        });
    } catch (error) {
        logger.error(`认领藏品失败: ${error.message} [ID: ${id}, 用户: ${userId}]`, error);
        return res.status(500).json({
            success: false,
            error: '认领藏品失败',
            message: error.message || '未知错误'
        });
    }
};

// 发起藏品所有权转移申请（待管理员审批）
exports.requestCollectibleTransfer = async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user.id.toString();
    const {
        targetUserId,
        accountType = req.user?.accountType,
        enterpriseInfo = {},
        personalInfo = {},
        note = null
    } = req.body || {};

    try {
        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_NEW_OWNER',
                message: '请填写受让人的用户ID'
            });
        }

        const collectible = await Collectible.findByBlockchainId(id);

        if (!collectible) {
            logger.warn(`转移申请失败: 藏品不存在 [ID: ${id}, 请求人: ${requesterId}]`);
            return res.status(404).json({
                success: false,
                error: 'COLLECTIBLE_NOT_FOUND',
                message: '未找到指定的藏品'
            });
        }

        let currentOwnerId = resolveCollectibleOwnerId(collectible);
        currentOwnerId = currentOwnerId !== null && currentOwnerId !== undefined
            ? currentOwnerId.toString()
            : null;

        if (!currentOwnerId) {
            const ownsCollectible = await User.hasCollectible(requesterId, collectible.id);
            if (!ownsCollectible) {
                return res.status(400).json({
                    success: false,
                    error: 'COLLECTIBLE_HAS_NO_OWNER',
                    message: '当前藏品尚无所有者，无法发起转移'
                });
            }

            const normalizedOwnerId = Number.isNaN(Number.parseInt(requesterId, 10))
                ? requesterId
                : Number.parseInt(requesterId, 10);

            await collectible.update(collectible.id, {
                current_owner_id: normalizedOwnerId,
                status: collectible.status || 'ACTIVE'
            });

            collectible.currentOwnerId = normalizedOwnerId;
            collectible.current_owner_id = normalizedOwnerId;
            currentOwnerId = requesterId;
        }

        if (currentOwnerId !== requesterId) {
            return res.status(403).json({
                success: false,
                error: 'NOT_COLLECTIBLE_OWNER',
                message: '仅藏品当前所有者可发起转移申请'
            });
        }

        if (collectible.status === 'TRANSFER_PENDING' && collectible.transferRequest?.status === 'PENDING') {
            return res.status(409).json({
                success: false,
                error: 'TRANSFER_ALREADY_PENDING',
                message: '已有待审批的转移申请，请等待管理员处理'
            });
        }

        const normalizedTargetId = targetUserId.toString();
        if (normalizedTargetId === requesterId) {
            return res.status(400).json({
                success: false,
                error: 'TRANSFER_TARGET_INVALID',
                message: '受让人不能与当前所有者相同'
            });
        }

        const newOwner = await User.findById(normalizedTargetId);
        if (!newOwner) {
            return res.status(404).json({
                success: false,
                error: 'TRANSFEREE_NOT_FOUND',
                message: '未找到指定的受让人用户'
            });
        }

        const qualification = buildQualificationPayload({
            accountType,
            enterpriseInfo,
            personalInfo
        });
        ensureQualificationCompleteness(qualification, 'TRANSFER_QUALIFICATION');
        const qualificationSummary = buildQualificationSummary(qualification);

        const ownerQualification = await fetchLatestOwnerQualification(collectible.id, requesterId);
        const transferRequest = {
            type: 'TRANSFER',
            status: 'PENDING',
            requestedAt: new Date().toISOString(),
            requestedBy: requesterId,
            requestedByName: req.user?.name || req.user?.email || `用户${requesterId}`,
            requestedByEmail: req.user?.email || null,
            note: note || null,
            newOwnerId: normalizedTargetId,
            newOwnerName: newOwner.name || newOwner.email || `用户${normalizedTargetId}`,
            newOwnerEmail: newOwner.email || null,
            accountType: qualification.accountType,
            enterpriseInfo: qualification.enterpriseInfo,
            personalInfo: qualification.personalInfo,
            qualificationSummary,
            toQualification: qualification,
            fromQualification: ownerQualification
        };

        await collectible.update(collectible.id, {
            transfer_request: transferRequest,
            status: 'TRANSFER_PENDING'
        });

        logger.logTransaction('REQUEST_TRANSFER_COLLECTIBLE', requesterId, id, {
            transferRequest
        });

        const updatedCollectible = await Collectible.findByBlockchainId(id);

        return res.status(200).json({
            success: true,
            message: '转移申请已提交，等待管理员审批',
            data: updatedCollectible
        });
    } catch (error) {
        logger.error(`转移申请失败: ${error.message} [藏品: ${id}, 请求人: ${requesterId}]`, error);
        return res.status(500).json({
            success: false,
            error: 'REQUEST_TRANSFER_FAILED',
            message: error.message || '发起转移申请失败'
        });
    }
};

exports.submitCollectibleApplication = async (req, res) => {
    try {
        const applicant = req.user;
        const accountType = normalizeCreationType(applicant.accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE');
        const {
            name,
            description,
            collectibleType,
            publishDate,
            estimatedValue,
            creationType,
            enterpriseInfo = {},
            personalInfo = {},
            attachments = []
        } = req.body || {};

        if (!name || !description || !collectibleType || !publishDate) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_FIELDS',
                message: '请完整填写藏品名称、描述、类型和发布日期'
            });
        }

        const normalizedCreationType = normalizeCreationType(creationType, accountType);

        if (normalizedCreationType === 'ENTERPRISE') {
            if (!enterpriseInfo.registrationNumber || !enterpriseInfo.companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_ENTERPRISE_FIELDS',
                    message: '企业申请需填写企业注册号和企业名称'
                });
            }
        } else {
            if (!personalInfo.platform || !personalInfo.platformId || !personalInfo.personalName) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_PERSONAL_FIELDS',
                    message: '个人申请需填写平台信息、账号/作品编号和姓名'
                });
            }
        }

        const publishDateObj = new Date(publishDate);
        if (Number.isNaN(publishDateObj.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_DATE',
                message: '发布日期格式不正确'
            });
        }

        const MAX_ATTACHMENTS = 3;
        const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
        const sanitizedAttachments = [];

        if (Array.isArray(attachments)) {
            for (const rawAttachment of attachments.slice(0, MAX_ATTACHMENTS)) {
                if (!rawAttachment || !rawAttachment.content) {
                    continue;
                }

                const { name, type, size, content } = rawAttachment;
                const base64Payload = typeof content === 'string' && content.includes(',')
                    ? content.split(',')[1]
                    : content;

                try {
                    const bufferLength = Buffer.from(base64Payload || '', 'base64').length;
                    const declaredSize = Number.parseInt(size, 10) || bufferLength;
                    const effectiveSize = Number.isNaN(declaredSize) ? bufferLength : declaredSize;

                    if (bufferLength > MAX_ATTACHMENT_SIZE || effectiveSize > MAX_ATTACHMENT_SIZE) {
                        return res.status(413).json({
                            success: false,
                            error: 'ATTACHMENT_TOO_LARGE',
                            message: `${name || '附件'} 大小超过 5MB 限制`
                        });
                    }

                    sanitizedAttachments.push({
                        name: name || '附件',
                        type: type || 'application/octet-stream',
                        size: effectiveSize,
                        content
                    });
                } catch (attachmentError) {
                    logger.warn('解析附件失败: ', attachmentError);
                    return res.status(400).json({
                        success: false,
                        error: 'ATTACHMENT_PARSE_ERROR',
                        message: `${name || '附件'} 解析失败，请重新上传`
                    });
                }
            }
        }

        const applicationPayload = {
            name,
            description,
            collectibleType,
            publishDate: publishDateObj.toISOString(),
            estimatedValue: Number.parseFloat(estimatedValue) || 0,
            creationType: normalizedCreationType,
            enterpriseInfo: normalizedCreationType === 'ENTERPRISE' ? enterpriseInfo : undefined,
            personalInfo: normalizedCreationType === 'PERSONAL' ? personalInfo : undefined,
            attachments: sanitizedAttachments
        };

        const application = new CollectibleApplication({
            applicantId: applicant.id,
            accountType,
            status: 'PENDING_REVIEW',
            applicationData: applicationPayload
        });

        await application.save();

        logger.info(`用户提交藏品申请 [申请ID: ${application.id}, 用户: ${applicant.id}, 类型: ${normalizedCreationType}]`);

        return res.status(201).json({
            success: true,
            message: '申请已提交，待超级管理员审核',
            data: application.toJSON()
        });
    } catch (error) {
        logger.error(`提交藏品申请失败: ${error.message} [用户: ${req.user?.id}]`, error);
        return res.status(500).json({
            success: false,
            error: 'SUBMIT_APPLICATION_FAILED',
            message: error.message || '提交申请失败'
        });
    }
};

exports.listCollectibleApplications = async (req, res) => {
    try {
        const { status, limit, offset } = req.query;
        const normalizedStatus = typeof status === 'string' && status.trim().length
            ? status.trim().toUpperCase()
            : null;
        const { rows, total, limit: limitValue, offset: offsetValue } = await CollectibleApplication.findAll({
            status: normalizedStatus,
            limit,
            offset
        });

        return res.status(200).json({
            success: true,
            data: rows.map((item) => item.toJSON()),
            pagination: {
                total,
                limit: limitValue,
                offset: offsetValue
            }
        });
    } catch (error) {
        logger.error(`获取藏品申请列表失败: ${error.message} [用户: ${req.user?.id}]`, error);
        return res.status(500).json({
            success: false,
            error: 'FETCH_APPLICATIONS_FAILED',
            message: error.message || '获取申请列表失败'
        });
    }
};

exports.listMyCollectibleApplications = async (req, res) => {
    try {
        const applications = await CollectibleApplication.findByApplicant(req.user.id);

        return res.status(200).json({
            success: true,
            data: applications.map((item) => item.toJSON())
        });
    } catch (error) {
        logger.error(`获取个人藏品申请失败: ${error.message} [用户: ${req.user?.id}]`, error);
        return res.status(500).json({
            success: false,
            error: 'FETCH_MY_APPLICATIONS_FAILED',
            message: error.message || '获取申请记录失败'
        });
    }
};

exports.updateCollectibleApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body || {};

        const allowedStatuses = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'];
        if (!allowedStatuses.includes((status || '').toUpperCase())) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_STATUS',
                message: '状态取值不正确'
            });
        }

        const application = await CollectibleApplication.findById(id);
        if (!application) {
            return res.status(404).json({
                success: false,
                error: 'APPLICATION_NOT_FOUND',
                message: '未找到对应的申请记录'
            });
        }

        const nextStatus = status.toUpperCase();

        let minted = null;
        let effectiveNotes = notes || null;

        if (nextStatus === 'APPROVED' && !application.linkedCollectibleId) {
            try {
                minted = await createCollectibleFromApplication(application, req.user);
                effectiveNotes = [notes, `自动创建藏品：${minted.blockchainId}`]
                    .filter(Boolean)
                    .join(' | ');
            } catch (mintError) {
                logger.error(`审批并创建藏品失败: ${mintError.message} [申请ID: ${id}, 用户: ${req.user.id}]`, mintError);
                return res.status(500).json({
                    success: false,
                    error: 'MINT_FROM_APPLICATION_FAILED',
                    message: mintError.message || '审批时创建藏品失败'
                });
            }
        }

        await CollectibleApplication.updateStatus(id, nextStatus, effectiveNotes, {
            linkedCollectibleId: minted?.blockchainId ?? application.linkedCollectibleId ?? null,
            linkedCollectibleDbId: minted?.collectible?.id ?? application.linkedCollectibleDbId ?? null
        });

        logger.info(`更新藏品申请状态 [申请ID: ${id}, 状态: ${nextStatus}, 操作人: ${req.user.id}]`);

        const updated = await CollectibleApplication.findById(id);

        if (minted && updated) {
            const applicationData = updated.applicationData || {};
            updated.applicationData = {
                ...applicationData,
                mintedCollectibleId: minted.blockchainId,
                mintedCollectibleHash: minted.collectible?.hash || null,
                mintedAt: new Date().toISOString(),
                assignedOwnerId: minted.applicantUser?.id || application.applicantId
            };

            try {
                await updated.save();
            } catch (saveError) {
                logger.warn(`写回申请的铸造信息失败: ${saveError.message} [申请ID: ${id}]`);
            }
        }

        return res.status(200).json({
            success: true,
            message: '状态更新成功',
            data: updated.toJSON()
        });
    } catch (error) {
        logger.error(`更新藏品申请状态失败: ${error.message} [用户: ${req.user?.id}]`, error);
        return res.status(500).json({
            success: false,
            error: 'UPDATE_APPLICATION_FAILED',
            message: error.message || '更新申请状态失败'
        });
    }
};

// 转移藏品所有权 / 审批认领
exports.transferCollectible = async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user.id.toString();
    const requesterRole = req.user.role;
    const isAdmin = ['SUPER_ADMIN', 'ICBC_ADMIN'].includes(requesterRole);
    const { newOwnerId: providedNewOwnerId, transferMetadata = null } = req.body || {};

    try {
        const collectible = await Collectible.findByBlockchainId(id);

        if (!collectible) {
            logger.warn(`转移藏品所有权失败: 藏品不存在 [ID: ${id}, 请求人: ${requesterId}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }

        const brandId = collectible.brandId || collectible.brand_id || null;
        const brandNameHint = collectible.brandName || collectible.brand_name || null;
        let existingOwnerIdRaw = resolveCollectibleOwnerId(collectible);
        let hasOwner = existingOwnerIdRaw !== null && existingOwnerIdRaw !== undefined;
        let transferRequest = collectible.transferRequest || null;
        const targetOwnerId = providedNewOwnerId || transferRequest?.newOwnerId;

        if (!targetOwnerId) {
            logger.warn(`转移藏品所有权失败: 缺少新所有者信息 [ID: ${id}, 请求人: ${requesterId}]`);
            return res.status(400).json({
                success: false,
                error: 'MISSING_NEW_OWNER',
                message: '请提供新的所有者ID'
            });
        }

        const newOwner = await User.findById(targetOwnerId);
        if (!newOwner) {
            logger.warn(`转移藏品所有权失败: 新所有者不存在 [ID: ${id}, 新所有者: ${targetOwnerId}]`);
            return res.status(404).json({
                success: false,
                error: '用户不存在',
                message: '未找到指定的新所有者'
            });
        }

        const normalizedNewOwnerId = targetOwnerId.toString();
        const parsedNewOwnerId = Number.parseInt(normalizedNewOwnerId, 10);
        const dbNewOwnerId = Number.isNaN(parsedNewOwnerId) ? normalizedNewOwnerId : parsedNewOwnerId;
        let existingOwnerId = hasOwner ? existingOwnerIdRaw.toString() : null;

        if (!hasOwner) {
            const requesterOwns = await User.hasCollectible(requesterId, collectible.id);
            if (requesterOwns) {
                const normalizedOwnerId = Number.isNaN(Number.parseInt(requesterId, 10))
                    ? requesterId
                    : Number.parseInt(requesterId, 10);

                await collectible.update(collectible.id, {
                    current_owner_id: normalizedOwnerId,
                    status: collectible.status || 'ACTIVE'
                });

                collectible.currentOwnerId = normalizedOwnerId;
                collectible.current_owner_id = normalizedOwnerId;
                hasOwner = true;
                existingOwnerId = requesterId;
            }
        }

        let requestQualification = transferRequest
            ? buildQualificationPayload({
                accountType: transferRequest.accountType,
                enterpriseInfo: transferRequest.enterpriseInfo,
                personalInfo: transferRequest.personalInfo
            })
            : null;

        let blockchainResult = null;
        const transferHistory = new TransferHistory();
        const metadataBase = {
            ...(transferMetadata || {})
        };

        if (transferRequest) {
            metadataBase.transferRequest = {
                ...transferRequest
            };
        }

        let fromQualification = null;
        let toQualification = requestQualification;
        let transferRecordType = 'TRANSFER';
        let transferRecordFrom = existingOwnerId;

        if (hasOwner) {
            const currentOwnerId = resolveCollectibleOwnerId(collectible)?.toString();

            if (currentOwnerId !== requesterId && !isAdmin) {
                logger.warn(`转移藏品所有权失败: 权限不足 [ID: ${id}, 当前所有者: ${currentOwnerId}, 请求人: ${requesterId}]`);
                return res.status(403).json({
                    success: false,
                    error: '权限不足',
                    message: '您不是该藏品的当前所有者'
                });
            }

            logger.logTransaction('TRANSFER_COLLECTIBLE', requesterId, id, {
                newOwnerId: normalizedNewOwnerId
            });

            try {
                blockchainResult = await blockchain.invoke('transferCollectible', id, normalizedNewOwnerId);
            } catch (chainError) {
                const errorMessage = chainError?.message || chainError.toString();
                const missingOnChain = typeof errorMessage === 'string' && errorMessage.includes('不存在');

                if (!missingOnChain) {
                    throw chainError;
                }

                const brandInfo = brandId ? await Brand.findById(brandId) : null;
                const brandName = brandInfo?.name || brandNameHint || '未命名品牌';
                const designer = collectible.designer || brandName;
                const material = collectible.material || 'GENERAL';
                const batchNumber = collectible.batchNumber || collectible.batch_number || `BATCH-${Date.now()}`;
                const productionDateSource = collectible.productionDate || collectible.production_date || new Date();
                const productionDateObj = new Date(productionDateSource);
                const productionDateISO = Number.isNaN(productionDateObj.getTime())
                    ? new Date().toISOString()
                    : productionDateObj.toISOString();
                const description = collectible.description || transferRequest?.applicationDetails?.productDescription || '';

                logger.warn(`链上未找到藏品，重新铸造后再完成转移 [ID: ${id}]`);
                await blockchain.invoke(
                    'createCollectible',
                    id,
                    collectible.name || `COLLECTIBLE-${id}`,
                    brandName,
                    designer,
                    material,
                    batchNumber,
                    productionDateISO,
                    description
                );

                if (currentOwnerId) {
                    try {
                        await blockchain.invoke('claimCollectible', id, currentOwnerId);
                    } catch (reclaimError) {
                        logger.warn(`重新认领链上藏品失败: ${reclaimError.message || reclaimError} [ID: ${id}, Owner: ${currentOwnerId}]`);
                    }
                }

                blockchainResult = await blockchain.invoke('transferCollectible', id, normalizedNewOwnerId);
            }

            await collectible.update(collectible.id, {
                current_owner_id: dbNewOwnerId,
                transfer_request: null,
                status: 'ACTIVE'
            });

            collectible.currentOwnerId = dbNewOwnerId;
            collectible.current_owner_id = dbNewOwnerId;

            transferRecordFrom = currentOwnerId;
            transferRecordType = 'TRANSFER';

            fromQualification = transferRequest?.fromQualification
                ? buildQualificationPayload(transferRequest.fromQualification)
                : await fetchLatestOwnerQualification(collectible.id, currentOwnerId);

            if (!toQualification && transferMetadata?.toQualification) {
                toQualification = buildQualificationPayload(transferMetadata.toQualification);
            }

            if (!toQualification && transferRequest?.toQualification) {
                toQualification = buildQualificationPayload(transferRequest.toQualification);
            }

            await User.setCollectibleOwner(collectible.id, dbNewOwnerId);
        } else {
            if (!isAdmin) {
                logger.warn(`审批认领失败: 非管理员尝试确认 [ID: ${id}, 请求人: ${requesterId}]`);
                return res.status(403).json({
                    success: false,
                    error: '权限不足',
                    message: '仅管理员可确认认领申请'
                });
            }

            if (!transferRequest || transferRequest.type !== 'CLAIM') {
                if (providedNewOwnerId) {
                    logger.warn(`审批认领缺少记录，使用请求参数回填 [ID: ${id}, 请求人: ${requesterId}]`);
                    transferRequest = {
                        type: 'CLAIM',
                        status: 'PENDING',
                        requestedAt: new Date().toISOString(),
                        requestedBy: null,
                        newOwnerId: targetOwnerId,
                        newOwnerName: newOwner.name || newOwner.email || `用户${targetOwnerId}`,
                        newOwnerEmail: newOwner.email || null,
                        accountType: newOwner.accountType || 'PERSONAL'
                    };
                    requestQualification = buildQualificationPayload({
                        accountType: transferRequest.accountType,
                        enterpriseInfo: transferRequest.enterpriseInfo,
                        personalInfo: transferRequest.personalInfo
                    });
                } else {
                    logger.warn(`审批认领失败: 未找到待审批的认领请求 [ID: ${id}, 请求人: ${requesterId}]`);
                    return res.status(400).json({
                        success: false,
                        error: 'CLAIM_NOT_FOUND',
                        message: '当前没有待审批的认领申请'
                    });
                }
            }

            if (transferRequest.newOwnerId !== targetOwnerId) {
                logger.warn(`审批认领失败: 新所有者信息不匹配 [ID: ${id}, 请求人: ${requesterId}]`);
                return res.status(400).json({
                    success: false,
                    error: 'CLAIM_OWNER_MISMATCH',
                    message: '认领申请的新所有者与确认信息不一致'
                });
            }

            logger.logTransaction('APPROVE_CLAIM_COLLECTIBLE', requesterId, id, {
                newOwnerId: normalizedNewOwnerId
            });

            try {
                blockchainResult = await blockchain.invoke('claimCollectible', id, normalizedNewOwnerId);
            } catch (chainError) {
                const errorMessage = chainError?.message || chainError.toString();
                const missingOnChain = typeof errorMessage === 'string' && errorMessage.includes('不存在');

                if (!missingOnChain) {
                    throw chainError;
                }

                const brandInfo = brandId ? await Brand.findById(brandId) : null;
                const brandName = brandInfo?.name || brandNameHint || '未命名品牌';
                const designer = collectible.designer || brandName;
                const material = collectible.material || 'GENERAL';
                const batchNumber = collectible.batchNumber || collectible.batch_number || `BATCH-${Date.now()}`;
                const productionDateSource = collectible.productionDate || collectible.production_date || new Date();
                const productionDateObj = new Date(productionDateSource);
                const productionDateISO = Number.isNaN(productionDateObj.getTime())
                    ? new Date().toISOString()
                    : productionDateObj.toISOString();
                const description = collectible.description || transferRequest?.applicationDetails?.productDescription || '';

                logger.warn(`链上未找到藏品，重新铸造后再认领 [ID: ${id}]`);
                await blockchain.invoke(
                    'createCollectible',
                    id,
                    collectible.name || `COLLECTIBLE-${id}`,
                    brandName,
                    designer,
                    material,
                    batchNumber,
                    productionDateISO,
                    description
                );

                blockchainResult = await blockchain.invoke('claimCollectible', id, normalizedNewOwnerId);
            }

            await collectible.update(collectible.id, {
                current_owner_id: dbNewOwnerId,
                transfer_request: null,
                status: 'ACTIVE'
            });

            collectible.currentOwnerId = dbNewOwnerId;
            collectible.current_owner_id = dbNewOwnerId;

            const transferFromBrandId = brandId ? `BRAND:${brandId}` : null;
            transferRecordFrom = transferFromBrandId || 'SYSTEM';
            transferRecordType = 'CLAIM';

            fromQualification = transferRequest?.fromQualification
                ? buildQualificationPayload(transferRequest.fromQualification)
                : (brandId
                    ? buildQualificationPayload({
                        accountType: 'ENTERPRISE',
                        enterpriseInfo: {
                            registrationNumber: brandId,
                            companyName: brandNameHint || '品牌方'
                        }
                    })
                    : null);

            if (!toQualification && transferRequest?.toQualification) {
                toQualification = buildQualificationPayload(transferRequest.toQualification);
            }

            if (!toQualification) {
                toQualification = requestQualification;
            }

            await User.setCollectibleOwner(collectible.id, dbNewOwnerId);
        }

        if (!toQualification && metadataBase.transferRequest?.toQualification) {
            toQualification = buildQualificationPayload(metadataBase.transferRequest.toQualification);
        }

        metadataBase.fromQualification = fromQualification || null;
        metadataBase.toQualification = toQualification || null;

        const approvalTimestamp = new Date().toISOString();

        metadataBase.approvedBy = requesterId;
        metadataBase.approvedByName = req.user?.name || null;
        metadataBase.approvedAt = approvalTimestamp;

        if (metadataBase.transferRequest) {
            metadataBase.transferRequest.status = 'APPROVED';
            metadataBase.transferRequest.approvedAt = approvalTimestamp;
            metadataBase.transferRequest.approvedBy = requesterId;
        }

        const transactionId = blockchainResult?.transactionId || null;

        const transferRecordPayload = {
            collectibleId: collectible.id,
            from: transferRecordFrom,
            to: normalizedNewOwnerId,
            type: transferRecordType,
            transactionId,
            metadata: metadataBase
        };

        await transferHistory.save(transferRecordPayload);

        const updatedCollectibleInfo = await Collectible.findByBlockchainId(id);

        return res.status(200).json({
            success: true,
            message: '藏品所有权转移成功',
            data: updatedCollectibleInfo
        });
    } catch (error) {
        logger.error(`转移藏品所有权失败: ${error.message} [藏品: ${id}, 请求人: ${requesterId}]`, error);
        return res.status(500).json({
            success: false,
            error: '转移藏品所有权失败',
            message: error.message || '未知错误'
        });
    }
};

exports.updateCollectibleDetails = async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user.id?.toString();
    const requesterRole = req.user.role;

    try {
        const collectible = await Collectible.findByBlockchainId(id);

        if (!collectible) {
            logger.warn(`更新藏品信息失败: 藏品不存在 [ID: ${id}, 请求人: ${requesterId}]`);
            return res.status(404).json({
                success: false,
                error: 'COLLECTIBLE_NOT_FOUND',
                message: '未找到指定的藏品'
            });
        }

        const currentOwnerId = resolveCollectibleOwnerId(collectible)?.toString() || null;
        const isOwner = currentOwnerId && requesterId && currentOwnerId === requesterId;
        const isAdmin = ['SUPER_ADMIN', 'ICBC_ADMIN'].includes(requesterRole);

        if (!isOwner && !isAdmin) {
            logger.warn(`更新藏品信息失败: 权限不足 [ID: ${id}, 请求人: ${requesterId}]`);
            return res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_PERMISSION',
                message: '仅当前所有者或管理员可修改藏品信息'
            });
        }

        const payload = req.body || {};
        const hasName = Object.prototype.hasOwnProperty.call(payload, 'name');
        const hasDescription = Object.prototype.hasOwnProperty.call(payload, 'description');
        const hasEstimatedValue = Object.prototype.hasOwnProperty.call(payload, 'estimatedValue');
        const hasProductPhoto = Object.prototype.hasOwnProperty.call(payload, 'productPhoto');

        if (!hasName && !hasDescription && !hasEstimatedValue && !hasProductPhoto) {
            return res.status(400).json({
                success: false,
                error: 'NO_FIELDS_PROVIDED',
                message: '请至少提供一个可修改字段'
            });
        }

        const updatePayload = {};
        const metadataUpdates = {};
        const existingMetadata = collectible.metadata && typeof collectible.metadata === 'object'
            ? { ...collectible.metadata }
            : {};

        if (hasName) {
            const name = typeof payload.name === 'string' ? payload.name.trim() : '';
            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_NAME',
                    message: '藏品名称不能为空'
                });
            }
            updatePayload.name = name;
        }

        if (hasDescription) {
            const description = typeof payload.description === 'string' ? payload.description.trim() : '';
            updatePayload.description = description;
        }

        if (hasEstimatedValue) {
            const estimatedValue = payload.estimatedValue === null || payload.estimatedValue === ''
                ? null
                : Number.parseFloat(payload.estimatedValue);

            if (estimatedValue !== null && Number.isNaN(estimatedValue)) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_ESTIMATED_VALUE',
                    message: '预估定价需为有效数字'
                });
            }

            updatePayload.estimated_value = estimatedValue;
            metadataUpdates.estimatedValue = estimatedValue;
        }

        if (hasProductPhoto) {
            try {
                const parsedPhoto = parseBase64Image(payload.productPhoto);
                if (parsedPhoto.provided) {
                    if (parsedPhoto.buffer) {
                        updatePayload.product_photo = parsedPhoto.buffer;
                        if (parsedPhoto.mimeType) {
                            metadataUpdates.productPhotoMimeType = parsedPhoto.mimeType;
                        }
                    } else {
                        updatePayload.product_photo = null;
                        metadataUpdates.productPhotoMimeType = null;
                    }
                }
            } catch (imageError) {
                logger.warn(`更新藏品信息失败: 图片解析错误 [ID: ${id}, 请求人: ${requesterId}]`);
                return res.status(400).json({
                    success: false,
                    error: imageError.code || 'INVALID_IMAGE_DATA',
                    message: '上传的图片数据无效'
                });
            }
        }

        if (Object.keys(metadataUpdates).length > 0) {
            metadataUpdates.lastUpdatedAt = new Date().toISOString();
            metadataUpdates.lastUpdatedBy = requesterId;
            updatePayload.metadata = {
                ...existingMetadata,
                ...metadataUpdates
            };
        }

        if (!Object.keys(updatePayload).length) {
            return res.status(400).json({
                success: false,
                error: 'NO_VALID_FIELDS',
                message: '未检测到有效的修改内容'
            });
        }

        await collectible.update(collectible.id, updatePayload);
        logger.info(`更新藏品信息成功 [ID: ${id}, 请求人: ${requesterId}]`);

        const updatedCollectible = await Collectible.findByBlockchainId(id, true);

        return res.status(200).json({
            success: true,
            message: '藏品信息更新成功',
            data: updatedCollectible?.toJSON ? updatedCollectible.toJSON() : updatedCollectible
        });
    } catch (error) {
        logger.error(`更新藏品信息失败: ${error.message} [藏品: ${id}, 请求人: ${requesterId}]`, error);
        return res.status(500).json({
            success: false,
            error: 'UPDATE_COLLECTIBLE_FAILED',
            message: error.message || '更新藏品信息失败'
        });
    }
};

// 查询藏品流转历史（包含资质信息）
exports.getCollectibleHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.user?.id || 'ANONYMOUS';

        const collectible = await Collectible.findByBlockchainId(id);

        if (!collectible) {
            logger.warn(`查询藏品流转历史失败: 藏品不存在 [ID: ${id}, 用户: ${requesterId}]`);
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }

        const localHistory = await TransferHistory.findByCollectibleId(collectible.id);
        const chronologicalHistory = [...localHistory].reverse();

        let events = chronologicalHistory.map((record) => {
            const timestamp = record.timestamp instanceof Date
                ? record.timestamp.toISOString()
                : (record.timestamp ? new Date(record.timestamp).toISOString() : null);

            const fromQualification = serializeQualificationForResponse(record.metadata?.fromQualification || null);
            const toQualification = serializeQualificationForResponse(record.metadata?.toQualification || null);

            return {
                id: record.id,
                type: record.type,
                from: record.from,
                to: record.to,
                timestamp,
                transactionId: record.transactionId || null,
                fromQualification,
                toQualification,
                metadata: record.metadata || null,
                summaries: {
                    from: fromQualification?.summary || null,
                    to: toQualification?.summary || null
                }
            };
        });

        if (!events.length) {
            try {
                logger.logQuery('GET_COLLECTIBLE_HISTORY_CHAIN_FALLBACK', requesterId, id);
                const chainHistory = await blockchain.query('getCollectibleHistory', id);
                const chainEvents = Array.isArray(chainHistory?.transferHistory)
                    ? chainHistory.transferHistory.map((record, index) => ({
                        id: record.id || index,
                        type: record.type || 'UNKNOWN',
                        from: record.from || record.fromUser || null,
                        to: record.to || record.toUser || null,
                        timestamp: record.timestamp || record.time || null,
                        transactionId: record.transactionId || null,
                        fromQualification: null,
                        toQualification: null,
                        metadata: record,
                        summaries: {
                            from: null,
                            to: null
                        }
                    }))
                    : [];
                events = chainEvents;
            } catch (chainError) {
                logger.warn(`区块链流转历史查询失败: ${chainError.message} [ID: ${id}]`);
            }
        }

        const brandInfo = collectible.brandId ? await Brand.findById(collectible.brandId) : null;

        const responsePayload = {
            collectibleId: collectible.blockchainId,
            name: collectible.name,
            brand: brandInfo?.name || collectible.brandName || null,
            events,
            transferHistory: events
        };

        return res.status(200).json({
            success: true,
            data: responsePayload
        });
    } catch (error) {
    const requesterId = req.user?.id || 'ANONYMOUS';
    logger.error(`查询藏品流转历史失败: ${error.message} [ID: ${req.params?.id}, 用户: ${requesterId}]`, error);
        return res.status(500).json({
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
    const userId = req.user ? req.user.id : 'ANONYMOUS';
    logger.logQuery('VERIFY_COLLECTIBLE', userId, id, { hash });
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

// 更新藏品状态
exports.updateCollectibleStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const allowedStatuses = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'TRANSFER_PENDING'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: '无效状态',
                message: '请提供合法的藏品状态'
            });
        }

        const collectible = await Collectible.findByBlockchainId(id, true);
        if (!collectible) {
            return res.status(404).json({
                success: false,
                error: '藏品不存在',
                message: '未找到指定的藏品'
            });
        }

        const updatePayload = {
            status
        };

        if (status !== 'TRANSFER_PENDING') {
            updatePayload.transfer_request = null;
        }

        await collectible.update(collectible.id, updatePayload);
        const updated = await Collectible.findByBlockchainId(id, true);

        logger.info(`更新藏品状态成功 [藏品: ${id}, 状态: ${status}, 用户: ${req.user?.id || '系统'}]`);

        res.status(200).json({
            success: true,
            data: updated
        });
    } catch (error) {
        logger.error(`更新藏品状态失败: ${error.message} [藏品: ${id}]`, error);
        res.status(500).json({
            success: false,
            error: '更新藏品状态失败',
            message: error.message || '未知错误'
        });
    }
};

// 搜索藏品
exports.searchCollectibles = async (req, res) => {
    const userId = req.user ? req.user.id : 'ANONYMOUS';

    try {
        const { keyword, brandId, status, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
    logger.info(`搜索藏品 [关键词: ${keyword}, 品牌: ${brandId}, 状态: ${status}, 页码: ${pageNum}, 每页: ${limitNum}, 用户: ${userId}]`);
        
        // 执行MySQL搜索
        const { collectibles, total } = await Collectible.search({
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
    logger.error(`搜索藏品失败: ${error.message} [用户: ${userId}]`, error);
        res.status(500).json({
            success: false,
            error: '搜索藏品失败',
            message: error.message || '未知错误'
        });
    }
};