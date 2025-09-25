// 藏品路由定义

const express = require('express');
const router = express.Router();
const { authenticate, authorize, icbcAuthenticate } = require('../middleware/auth');
const { 
    createCollectible, 
    getCollectible, 
    claimCollectible, 
    transferCollectible, 
    getCollectibleHistory, 
    verifyCollectible, 
    searchCollectibles 
} = require('../controllers/collectible');

// 创建藏品 - 需要品牌管理员或工行管理员权限
router.post('/', authenticate, authorize('BRAND_ADMIN', 'ICBC_ADMIN', 'SUPER_ADMIN'), createCollectible);

// 查询藏品详情 - 公开接口
router.get('/:id', getCollectible);

// 认领藏品 - 需要用户认证，使用工行认证
router.post('/:id/claim', icbcAuthenticate, claimCollectible);

// 转移藏品所有权 - 需要用户认证
router.post('/:id/transfer', authenticate, transferCollectible);

// 查询藏品流转历史 - 公开接口
router.get('/:id/history', getCollectibleHistory);

// 验证藏品真伪 - 公开接口
router.post('/verify', verifyCollectible);

// 搜索藏品 - 公开接口，支持分页和过滤
router.get('/', searchCollectibles);

module.exports = router;