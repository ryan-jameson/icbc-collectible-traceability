// 藏品路由定义

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize, icbcAuthenticate } = require('../middleware/auth');
const {
    createCollectible,
    getCollectible,
    claimCollectible,
    requestCollectibleTransfer,
    transferCollectible,
    getCollectibleHistory,
    verifyCollectible,
    searchCollectibles,
    updateCollectibleStatus,
    updateCollectibleDetails,
    submitCollectibleApplication,
    listCollectibleApplications,
    listMyCollectibleApplications,
    updateCollectibleApplicationStatus
} = require('../controllers/collectible');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('仅支持图片文件上传'));
        }
        cb(null, true);
    }
});

// 创建藏品 - 需要品牌管理员或工行管理员权限
router.post('/', authenticate, authorize('BRAND_ADMIN', 'ICBC_ADMIN', 'SUPER_ADMIN'), upload.single('productPhoto'), createCollectible);

// 用户提交藏品申请
router.post(
    '/applications',
    authenticate,
    authorize(
        'USER',
        'CLIENT',
        'CUSTOMER',
        'BRAND_CLIENT',
        'ENTERPRISE_CLIENT',
        'PERSONAL_CLIENT',
        'ENTERPRISE',
        'PERSONAL'
    ),
    submitCollectibleApplication
);

// 用户查看自己的藏品申请
router.get(
    '/applications/mine',
    authenticate,
    authorize(
        'USER',
        'CLIENT',
        'CUSTOMER',
        'BRAND_CLIENT',
        'ENTERPRISE_CLIENT',
        'PERSONAL_CLIENT',
        'ENTERPRISE',
        'PERSONAL'
    ),
    listMyCollectibleApplications
);

// 管理端查看申请列表
router.get('/applications', authenticate, authorize('SUPER_ADMIN', 'ICBC_ADMIN'), listCollectibleApplications);

// 管理端更新申请状态
router.patch('/applications/:id/status', authenticate, authorize('SUPER_ADMIN', 'ICBC_ADMIN'), updateCollectibleApplicationStatus);

// 查询藏品详情 - 公开接口
router.get('/:id', getCollectible);

// 认领藏品 - 需要用户认证，使用工行认证
router.post('/:id/claim', icbcAuthenticate, claimCollectible);

// 客户发起转移申请 - 需要登录
router.post(
    '/:id/transfer-request',
    authenticate,
    authorize(
        'USER',
        'CLIENT',
        'CUSTOMER',
        'BRAND_CLIENT',
        'ENTERPRISE_CLIENT',
        'PERSONAL_CLIENT',
        'ENTERPRISE',
        'PERSONAL'
    ),
    requestCollectibleTransfer
);

router.patch(
    '/:id',
    authenticate,
    authorize(
        'USER',
        'CLIENT',
        'CUSTOMER',
        'BRAND_CLIENT',
        'ENTERPRISE_CLIENT',
        'PERSONAL_CLIENT',
        'ENTERPRISE',
        'PERSONAL',
        'BRAND_ADMIN',
        'ICBC_ADMIN',
        'SUPER_ADMIN'
    ),
    updateCollectibleDetails
);

// 更新藏品状态 - 需要工行或超级管理员
router.patch('/:id/status', authenticate, authorize('ICBC_ADMIN', 'SUPER_ADMIN'), updateCollectibleStatus);

// 转移藏品所有权 / 审批认领 - 需要管理员权限
router.post('/:id/transfer', authenticate, authorize('SUPER_ADMIN', 'ICBC_ADMIN'), transferCollectible);

// 查询藏品流转历史 - 公开接口
router.get('/:id/history', getCollectibleHistory);

// 验证藏品真伪 - 公开接口
router.post('/verify', verifyCollectible);

// 搜索藏品 - 公开接口，支持分页和过滤
router.get('/', searchCollectibles);

module.exports = router;