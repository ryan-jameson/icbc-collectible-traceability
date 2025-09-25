// 工银溯藏SDK配置
const ICBC_COLLECTIBLE_CONFIG = {
  // API基础URL，可根据环境不同进行切换
  API_BASE_URL: 'http://localhost:8000/api',
  
  // 超时时间（毫秒）
  TIMEOUT: 30000,
  
  // 存储键名
  STORAGE_KEYS: {
    AUTH_TOKEN: 'icbc_collectible_auth_token',
    USER_INFO: 'icbc_collectible_user_info',
    REFRESH_TOKEN: 'icbc_collectible_refresh_token'
  },
  
  // 日志级别: 'debug', 'info', 'warn', 'error'
  LOG_LEVEL: 'debug',
  
  // 是否启用缓存
  ENABLE_CACHE: true,
  
  // 缓存有效期（毫秒）
  CACHE_DURATION: 60000,
  
  // 重试配置
  RETRY_CONFIG: {
    maxRetries: 3,
    retryDelay: 1000,
    retryableStatuses: [408, 429, 500, 502, 503, 504]
  },
  
  // 工行相关配置
  ICBC_CONFIG: {
    APP_ID: 'icbc_collectible_app',
    ENVIRONMENT: 'development' // 'development', 'test', 'production'
  }
};

// 导出配置
try {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    window.ICBC_COLLECTIBLE_CONFIG = ICBC_COLLECTIBLE_CONFIG;
  }
  // Node.js环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ICBC_COLLECTIBLE_CONFIG;
  }
} catch (e) {
  console.error('导出配置失败:', e);
}