// 品牌SDK
class BrandSDK {
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
  
  // 创建品牌
  async createBrand(brandData) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('ICBC_ADMIN') || this.auth.hasRole('SUPER_ADMIN'))) {
        throw new Error('需要工行管理员或超级管理员权限');
      }
      
      const response = await this.request.post('/brands', brandData);
      
      if (response.success) {
        this.emit('brand:created', response.data);
        // 清理品牌列表缓存
        this.clearCache('brands_list');
      }
      
      return response;
    } catch (error) {
      this.emit('brand:create:error', error);
      throw error;
    }
  }
  
  // 获取品牌列表
  async getBrandList(params = {}, useCache = true) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated()) {
        throw new Error('需要登录');
      }
      
      // 构建缓存键
      const cacheKey = useCache ? `brands_${JSON.stringify(params)}` : null;
      
      const response = await this.request.get('/brands', {
        params: {
          page: params.page || 1,
          limit: params.limit || 10,
          search: params.search,
          status: params.status,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder
        },
        cacheKey
      });
      
      if (response.success) {
        this.emit('brands:loaded', { params, results: response.data, pagination: response.pagination });
      }
      
      return response;
    } catch (error) {
      this.emit('brands:load:error', error);
      throw error;
    }
  }
  
  // 获取品牌详情
  async getBrandDetails(brandId, useCache = true) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated()) {
        throw new Error('需要登录');
      }
      
      const cacheKey = useCache ? `brand_${brandId}` : null;
      const response = await this.request.get(`/brands/${brandId}`, { cacheKey });
      
      if (response.success) {
        this.emit('brand:loaded', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('brand:load:error', error);
      throw error;
    }
  }
  
  // 更新品牌信息
  async updateBrand(brandId, updateData) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('ICBC_ADMIN') || this.auth.hasRole('SUPER_ADMIN'))) {
        throw new Error('需要工行管理员或超级管理员权限');
      }
      
      const response = await this.request.put(`/brands/${brandId}`, updateData);
      
      if (response.success) {
        this.emit('brand:updated', response.data);
        // 清理缓存
        this.clearCache(`brand_${brandId}`);
        this.clearCache('brands_list');
      }
      
      return response;
    } catch (error) {
      this.emit('brand:update:error', error);
      throw error;
    }
  }
  
  // 启用/禁用品牌
  async changeBrandStatus(brandId, active) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('ICBC_ADMIN') || this.auth.hasRole('SUPER_ADMIN'))) {
        throw new Error('需要工行管理员或超级管理员权限');
      }
      
      const response = await this.request.patch(`/brands/${brandId}/status`, { active });
      
      if (response.success) {
        this.emit('brand:status:changed', { brandId, active });
        // 清理缓存
        this.clearCache(`brand_${brandId}`);
        this.clearCache('brands_list');
      }
      
      return response;
    } catch (error) {
      this.emit('brand:status:change:error', error);
      throw error;
    }
  }
  
  // 删除品牌
  async deleteBrand(brandId) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || !this.auth.hasRole('SUPER_ADMIN')) {
        throw new Error('需要超级管理员权限');
      }
      
      const response = await this.request.delete(`/brands/${brandId}`);
      
      if (response.success) {
        this.emit('brand:deleted', { brandId });
        // 清理缓存
        this.clearCache(`brand_${brandId}`);
        this.clearCache('brands_list');
      }
      
      return response;
    } catch (error) {
      this.emit('brand:delete:error', error);
      throw error;
    }
  }
  
  // 搜索品牌
  async searchBrands(keyword, params = {}, useCache = true) {
    try {
      // 构建搜索参数
      const searchParams = {
        ...params,
        search: keyword
      };
      
      // 调用获取品牌列表接口
      return await this.getBrandList(searchParams, useCache);
    } catch (error) {
      this.emit('brands:search:error', error);
      throw error;
    }
  }
  
  // 获取品牌的藏品
  async getBrandCollectibles(brandId, params = {}, useCache = true) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated()) {
        throw new Error('需要登录');
      }
      
      // 构建缓存键
      const cacheKey = useCache ? `brand_${brandId}_collectibles_${JSON.stringify(params)}` : null;
      
      // 检查是否有collectible SDK实例
      if (typeof window !== 'undefined' && window.collectible) {
        // 使用藏品SDK的搜索功能
        return await window.collectible.searchCollectibles({
          ...params,
          brand: brandId
        }, useCache);
      } else {
        // 直接调用API
        const response = await this.request.get('/collectibles', {
          params: {
            ...params,
            brand: brandId
          },
          cacheKey
        });
        
        return response;
      }
    } catch (error) {
      this.emit('brand:collectibles:load:error', error);
      throw error;
    }
  }
  
  // 获取品牌统计信息
  async getBrandStatistics(brandId) {
    try {
      // 检查认证状态
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('BRAND_ADMIN') || this.auth.hasRole('ICBC_ADMIN') || this.auth.hasRole('SUPER_ADMIN'))) {
        throw new Error('权限不足');
      }
      
      // 注意：API文档中没有直接提供统计接口
      // 这里我们通过调用其他接口来获取统计数据
      
      // 获取品牌详情
      const brandDetails = await this.getBrandDetails(brandId, false);
      
      // 获取品牌的藏品列表
      const collectiblesResponse = await this.getBrandCollectibles(brandId, {
        page: 1,
        limit: 1
      }, false);
      
      // 构建统计数据
      const statistics = {
        brandId,
        brandName: brandDetails?.data?.name,
        collectiblesCount: collectiblesResponse?.pagination?.total || 0,
        // 其他可能的统计数据可以在这里添加
      };
      
      this.emit('brand:statistics:loaded', statistics);
      return statistics;
    } catch (error) {
      this.emit('brand:statistics:load:error', error);
      throw error;
    }
  }
  
  // 清理缓存
  clearCache(cacheKey) {
    if (this.request && this.request.cache) {
      this.request.cache.delete(cacheKey);
    }
  }
  
  // 批量更新品牌信息
  async batchUpdateBrands(updates) {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('ICBC_ADMIN') || this.auth.hasRole('SUPER_ADMIN'))) {
        throw new Error('需要工行管理员或超级管理员权限');
      }
      
      // 目前API文档中没有批量操作的接口，这里模拟实现
      const results = [];
      
      for (const update of updates) {
        try {
          let result;
          
          if (update.hasOwnProperty('active')) {
            // 更新状态
            result = await this.changeBrandStatus(update.brandId, update.active);
          } else {
            // 更新其他信息
            result = await this.updateBrand(update.brandId, update.data);
          }
          
          results.push({
            success: true,
            brandId: update.brandId,
            data: result
          });
        } catch (error) {
          results.push({
            success: false,
            brandId: update.brandId,
            error: error.message
          });
        }
      }
      
      this.emit('brands:batch:updated', results);
      return results;
    } catch (error) {
      this.emit('brands:batch:update:error', error);
      throw error;
    }
  }
  
  // 导出品牌数据
  async exportBrandData(brandId, format = 'json') {
    try {
      // 检查认证状态和权限
      if (!this.auth?.isAuthenticated() || 
          !(this.auth.hasRole('BRAND_ADMIN') || this.auth.hasRole('ICBC_ADMIN') || this.auth.hasRole('SUPER_ADMIN'))) {
        throw new Error('权限不足');
      }
      
      // 获取品牌详情
      const brandDetails = await this.getBrandDetails(brandId, false);
      
      // 获取品牌的所有藏品
      const collectiblesResponse = await this.getBrandCollectibles(brandId, {
        page: 1,
        limit: 1000 // 假设一次性获取所有藏品
      }, false);
      
      // 构建导出数据
      const exportData = {
        brand: brandDetails.data,
        collectibles: collectiblesResponse.data || [],
        exportDate: new Date().toISOString(),
        totalCollectibles: collectiblesResponse.pagination?.total || 0
      };
      
      // 根据格式导出数据
      if (format === 'json') {
        // 返回JSON数据
        return exportData;
      } else if (format === 'csv') {
        // 简单实现CSV导出
        if (typeof Papa !== 'undefined') {
          // 如果有Papa Parse库
          const csv = Papa.unparse(exportData.collectibles);
          return csv;
        } else {
          // 简单手动构建CSV
          const headers = Object.keys(exportData.collectibles[0] || {});
          const rows = exportData.collectibles.map(item => 
            headers.map(header => {
              const value = item[header];
              // 处理包含逗号或引号的值
              if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            }).join(',')
          );
          
          const csv = [headers.join(','), ...rows].join('\n');
          return csv;
        }
      }
      
      throw new Error(`不支持的导出格式: ${format}`);
    } catch (error) {
      this.emit('brand:export:error', error);
      throw error;
    }
  }
}

// 创建默认实例
const brand = new BrandSDK();

// 导出类和默认实例
try {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    window.BrandSDK = BrandSDK;
    window.brand = brand;
  }
  // Node.js环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BrandSDK, brand };
  }
} catch (e) {
  console.error('导出品牌SDK失败:', e);
}