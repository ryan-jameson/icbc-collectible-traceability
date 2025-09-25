// HTTP请求工具
class RequestTool {
  constructor(config = {}) {
    // 使用全局配置或传入的配置
    this.config = {
      ...(typeof window !== 'undefined' && window.ICBC_COLLECTIBLE_CONFIG || {}),
      ...config
    };
    
    // 初始化缓存
    this.cache = new Map();
    
    // 确保配置存在
    if (!this.config.API_BASE_URL) {
      throw new Error('API基础URL未配置');
    }
  }
  
  // 获取存储的令牌
  getAuthToken() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.config.STORAGE_KEYS?.AUTH_TOKEN || 'icbc_collectible_auth_token');
    }
    return null;
  }
  
  // 保存令牌
  saveAuthToken(token) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.config.STORAGE_KEYS?.AUTH_TOKEN || 'icbc_collectible_auth_token', token);
    }
  }
  
  // 移除令牌
  removeAuthToken() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.config.STORAGE_KEYS?.AUTH_TOKEN || 'icbc_collectible_auth_token');
    }
  }
  
  // 构建完整URL
  buildUrl(endpoint) {
    // 如果是绝对URL，直接返回
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    // 构建相对URL
    const baseUrl = this.config.API_BASE_URL.endsWith('/') 
      ? this.config.API_BASE_URL.slice(0, -1) 
      : this.config.API_BASE_URL;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${path}`;
  }
  
  // 构建请求头
  buildHeaders(headers = {}, includeAuth = true) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // 添加认证头
    if (includeAuth) {
      const token = this.getAuthToken();
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return { ...defaultHeaders, ...headers };
  }
  
  // 日志记录
  log(level, message, data = {}) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = validLevels.indexOf(this.config.LOG_LEVEL || 'info');
    const messageLevel = validLevels.indexOf(level);
    
    if (messageLevel >= currentLevel && typeof console !== 'undefined') {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [ICBC Collectible] ${message}`, data);
    }
  }
  
  // 从缓存获取数据
  getFromCache(key) {
    if (!this.config.ENABLE_CACHE) return null;
    
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const { data, timestamp } = cached;
    if (Date.now() - timestamp > this.config.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return data;
  }
  
  // 缓存数据
  cacheData(key, data) {
    if (this.config.ENABLE_CACHE) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    }
  }
  
  // 处理错误
  handleError(error) {
    this.log('error', 'API请求错误', { error: error.message || error });
    
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      
      // 处理认证错误
      if (status === 401) {
        this.removeAuthToken();
        // 可以在这里触发登录跳转或重新认证
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
      
      return Promise.reject({
        type: 'API_ERROR',
        status,
        message: data?.message || `请求失败: ${status}`,
        data
      });
    } else if (error.request) {
      // 没有收到响应
      return Promise.reject({
        type: 'NETWORK_ERROR',
        message: '网络连接失败，请检查您的网络设置'
      });
    } else {
      // 请求配置错误
      return Promise.reject({
        type: 'REQUEST_ERROR',
        message: error.message || '请求配置错误'
      });
    }
  }
  
  // 重试请求
  async retryRequest(requestFn, retries = 0) {
    try {
      return await requestFn();
    } catch (error) {
      const maxRetries = this.config.RETRY_CONFIG?.maxRetries || 3;
      const retryableStatuses = this.config.RETRY_CONFIG?.retryableStatuses || [408, 429, 500, 502, 503, 504];
      
      // 检查是否应该重试
      if (retries < maxRetries && 
          error.type === 'API_ERROR' && 
          retryableStatuses.includes(error.status)) {
        
        this.log('warn', `请求失败，正在重试 (${retries + 1}/${maxRetries})`, { error });
        
        // 等待一段时间后重试
        await new Promise(resolve => 
          setTimeout(resolve, this.config.RETRY_CONFIG?.retryDelay || 1000)
        );
        
        return this.retryRequest(requestFn, retries + 1);
      }
      
      // 达到最大重试次数或不可重试的错误
      throw error;
    }
  }
  
  // 发送请求
  async request(method, endpoint, options = {}) {
    const { data, headers, params, includeAuth = true, cacheKey = null } = options;
    const url = this.buildUrl(endpoint);
    
    // 构建完整URL（包括查询参数）
    let fullUrl = url;
    if (params) {
      const queryParams = new URLSearchParams(params).toString();
      if (queryParams) {
        fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryParams}`;
      }
    }
    
    // 尝试从缓存获取数据（仅GET请求）
    if (method === 'GET' && cacheKey) {
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData) {
        this.log('debug', '从缓存获取数据', { cacheKey, url });
        return cachedData;
      }
    }
    
    const requestOptions = {
      method,
      headers: this.buildHeaders(headers, includeAuth),
      credentials: 'include',
      timeout: this.config.TIMEOUT || 30000
    };
    
    // 添加请求体
    if (data) {
      requestOptions.body = JSON.stringify(data);
    }
    
    this.log('debug', `发送${method}请求`, { url: fullUrl, data });
    
    try {
      // 创建请求函数用于重试
      const requestFn = async () => {
        const response = await fetch(fullUrl, requestOptions);
        
        if (!response.ok) {
          throw {
            response: {
              status: response.status,
              data: await response.json().catch(() => ({}))
            }
          };
        }
        
        // 处理空响应
        const contentType = response.headers.get('content-type');
        const result = contentType && contentType.includes('application/json')
          ? await response.json()
          : await response.text();
        
        this.log('debug', `请求成功 (${method})`, { url: fullUrl, status: response.status });
        
        // 缓存响应（仅GET请求）
        if (method === 'GET' && cacheKey) {
          this.cacheData(cacheKey, result);
        }
        
        return result;
      };
      
      // 执行请求（带重试逻辑）
      return await this.retryRequest(requestFn);
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  // GET请求
  get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }
  
  // POST请求
  post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, { ...options, data });
  }
  
  // PUT请求
  put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, { ...options, data });
  }
  
  // DELETE请求
  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }
  
  // PATCH请求
  patch(endpoint, data, options = {}) {
    return this.request('PATCH', endpoint, { ...options, data });
  }
}

// 创建默认实例
const request = new RequestTool();

// 导出类和默认实例
try {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    window.RequestTool = RequestTool;
    window.request = request;
  }
  // Node.js环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RequestTool, request };
  }
} catch (e) {
  console.error('导出请求工具失败:', e);
}