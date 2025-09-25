// 藏品SDK
class CollectibleSDK {
  constructor(requestTool, authSDK) {
    // 使用传入的请求工具或全局请求实例
    this.request = requestTool || (typeof window !== 'undefined' && window.request);
    this.auth = authSDK || (typeof window !== 'undefined' && window.auth);
    
    if (!this.request) {
      throw new Error('请求工具未初始化');
    }
    
    if (!this.auth) {
      console.warn('警告: 认证SDK未初始化，部分需要认证的功能可能无法使用');
    }
    
    // 事件监听器存储
    this.listeners = new Map();
  }
  
  // 添加事件监听器
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return this;
  }
  
  // 移除事件监听器
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
    return this;
  }
  
  // 触发事件
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`触发事件 ${event} 时出错:`, e);
        }
      });
    }
    return this;
  }
  
  // 创建藏品
  async createCollectible(collectibleData) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated() || !this.auth.hasRole('BRAND_ADMIN')) {
        throw new Error('需要品牌管理员权限');
      }
      
      const response = await this.request.post('/collectibles', collectibleData);
      
      if (response.success) {
        this.emit('collectible:created', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('collectible:create:error', error);
      throw error;
    }
  }
  
  // 查询藏品详情
  async getCollectibleDetails(collectibleId, useCache = true) {
    try {
      const cacheKey = useCache ? `collectible_${collectibleId}` : null;
      const response = await this.request.get(`/collectibles/${collectibleId}`, { cacheKey });
      
      if (response.success) {
        this.emit('collectible:loaded', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('collectible:load:error', error);
      throw error;
    }
  }
  
  // 认领藏品（需要工行认证）
  async claimCollectible(collectibleId, icbcToken, verificationCode) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated()) {
        throw new Error('需要登录');
      }
      
      // 包装操作函数，使用工行认证中间件
      const claimOperation = async (verificationData) => {
        const response = await this.request.post(
          `/collectibles/${collectibleId}/claim`,
          verificationData
        );
        
        if (response.success) {
          this.emit('collectible:claimed', response.data);
          // 清理缓存
          this.clearCache(`collectible_${collectibleId}`);
        }
        
        return response;
      };
      
      // 使用工行认证执行操作
      return await this.auth.withIcbcAuth(
        claimOperation,
        { icbcToken, verificationCode }
      );
    } catch (error) {
      this.emit('collectible:claim:error', error);
      throw error;
    }
  }
  
  // 转移藏品所有权
  async transferCollectible(collectibleId, toUserId, transferReason = '') {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated()) {
        throw new Error('需要登录');
      }
      
      const response = await this.request.post(
        `/collectibles/${collectibleId}/transfer`,
        { toUserId, transferReason }
      );
      
      if (response.success) {
        this.emit('collectible:transferred', response.data);
        // 清理缓存
        this.clearCache(`collectible_${collectibleId}`);
        this.clearCache(`collectible_history_${collectibleId}`);
      }
      
      return response;
    } catch (error) {
      this.emit('collectible:transfer:error', error);
      throw error;
    }
  }
  
  // 查询藏品流转历史
  async getCollectibleHistory(collectibleId, useCache = true) {
    try {
      const cacheKey = useCache ? `collectible_history_${collectibleId}` : null;
      const response = await this.request.get(`/collectibles/${collectibleId}/history`, { cacheKey });
      
      if (response.success) {
        this.emit('collectible:history:loaded', { collectibleId, history: response.data });
      }
      
      return response;
    } catch (error) {
      this.emit('collectible:history:load:error', error);
      throw error;
    }
  }
  
  // 验证藏品真伪
  async verifyCollectible(blockchainId, authenticationCode) {
    try {
      const response = await this.request.post(
        '/collectibles/verify',
        { blockchainId, authenticationCode },
        { includeAuth: false }
      );
      
      if (response.success) {
        this.emit('collectible:verified', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('collectible:verify:error', error);
      throw error;
    }
  }
  
  // 搜索藏品
  async searchCollectibles(params = {}, useCache = true) {
    try {
      // 构建缓存键
      const cacheKey = useCache ? `collectibles_${JSON.stringify(params)}` : null;
      
      const response = await this.request.get('/collectibles', {
        params: {
          page: params.page || 1,
          limit: params.limit || 10,
          search: params.search,
          type: params.type,
          brand: params.brand,
          status: params.status,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder
        },
        cacheKey
      });
      
      if (response.success) {
        this.emit('collectibles:searched', { params, results: response.data, pagination: response.pagination });
      }
      
      return response;
    } catch (error) {
      this.emit('collectibles:search:error', error);
      throw error;
    }
  }
  
  // 获取我的藏品
  async getMyCollectibles(params = {}, useCache = true) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated()) {
        throw new Error('需要登录');
      }
      
      // 构建缓存键
      const userInfo = this.auth.getUserInfo();
      const cacheKey = useCache ? `my_collectibles_${userInfo?.id}_${JSON.stringify(params)}` : null;
      
      // 添加查询参数，限制为当前用户的藏品
      const searchParams = {
        ...params,
        // 注意：API可能需要特定参数来过滤当前用户的藏品
        // 这里假设API支持通过status=OWNED来获取用户拥有的藏品
        status: 'OWNED'
      };
      
      const response = await this.searchCollectibles(searchParams, false);
      
      if (response.success) {
        this.emit('collectibles:my:loaded', { params: searchParams, results: response.data });
      }
      
      return response;
    } catch (error) {
      this.emit('collectibles:my:load:error', error);
      throw error;
    }
  }
  
  // 更新藏品信息
  async updateCollectible(collectibleId, updateData) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('BRAND_ADMIN') || this.auth.hasRole('ICBC_ADMIN'))) {
        throw new Error('需要品牌管理员或工行管理员权限');
      }
      
      const response = await this.request.put(`/collectibles/${collectibleId}`, updateData);
      
      if (response.success) {
        this.emit('collectible:updated', response.data);
        // 清理缓存
        this.clearCache(`collectible_${collectibleId}`);
      }
      
      return response;
    } catch (error) {
      this.emit('collectible:update:error', error);
      throw error;
    }
  }
  
  // 生成藏品分享链接
  generateShareLink(collectibleId) {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      return `${baseUrl}/collectible/${collectibleId}?share=true`;
    }
    return null;
  }
  
  // 生成藏品二维码
  async generateQRCode(collectibleId, options = {}) {
    try {
      // 注意：这里需要前端有qrcode库支持
      // 如果API提供了生成二维码的接口，可以调用API
      
      // 简单实现：生成分享链接的二维码
      const shareLink = this.generateShareLink(collectibleId);
      
      // 这里返回二维码数据URL的Promise
      return new Promise((resolve, reject) => {
        // 检查是否有qrcode库
        if (typeof window !== 'undefined' && window.QRCode) {
          // 创建一个canvas元素
          const canvas = document.createElement('canvas');
          
          // 设置canvas大小
          canvas.width = options.width || 200;
          canvas.height = options.height || 200;
          
          // 生成二维码
          new window.QRCode(canvas, {
            text: shareLink,
            width: canvas.width,
            height: canvas.height,
            colorDark: options.darkColor || '#000000',
            colorLight: options.lightColor || '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.H
          });
          
          // 获取数据URL
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } else {
          // 如果没有qrcode库，返回分享链接
          resolve(shareLink);
        }
      });
    } catch (error) {
      console.error('生成二维码失败:', error);
      throw error;
    }
  }
  
  // 清除缓存
  clearCache(cacheKey) {
    if (this.request && this.request.cache) {
      this.request.cache.delete(cacheKey);
    }
  }
  
  // 批量操作藏品
  async batchOperateCollectibles(operations) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('BRAND_ADMIN') || this.auth.hasRole('ICBC_ADMIN'))) {
        throw new Error('需要品牌管理员或工行管理员权限');
      }
      
      // 目前API文档中没有批量操作的接口，这里模拟实现
      // 实际项目中可能需要后端提供批量操作API
      const results = [];
      
      for (const operation of operations) {
        try {
          let result;
          
          switch (operation.type) {
            case 'update':
              result = await this.updateCollectible(operation.collectibleId, operation.data);
              break;
            case 'transfer':
              result = await this.transferCollectible(
                operation.collectibleId,
                operation.toUserId,
                operation.reason
              );
              break;
            default:
              throw new Error(`不支持的操作类型: ${operation.type}`);
          }
          
          results.push({
            success: true,
            collectibleId: operation.collectibleId,
            data: result
          });
        } catch (error) {
          results.push({
            success: false,
            collectibleId: operation.collectibleId,
            error: error.message
          });
        }
      }
      
      this.emit('collectibles:batch:completed', results);
      return results;
    } catch (error) {
      this.emit('collectibles:batch:error', error);
      throw error;
    }
  }
}

// 创建默认实例
const collectible = new CollectibleSDK();

// 导出类和默认实例
try {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    window.CollectibleSDK = CollectibleSDK;
    window.collectible = collectible;
  }
  // Node.js环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CollectibleSDK, collectible };
  }
} catch (e) {
  console.error('导出藏品SDK失败:', e);
}