// 工银溯藏 - 前端SDK主入口

// 检查环境
const isBrowser = typeof window !== 'undefined';
const isNode = typeof module !== 'undefined' && module.exports;

// 配置加载函数
function loadConfig() {
  try {
    // 尝试加载配置文件
    let config = {};
    
    if (isBrowser) {
      // 浏览器环境
      if (window.__ICBC_COLLECTIBLE_CONFIG__) {
        config = window.__ICBC_COLLECTIBLE_CONFIG__;
      }
    } else if (isNode) {
      // Node.js环境
      try {
        const fs = require('fs');
        const path = require('path');
        
        // 尝试从项目根目录加载配置
        const configPath = path.resolve(process.cwd(), 'config.js');
        if (fs.existsSync(configPath)) {
          config = require(configPath);
        }
      } catch (e) {
        console.warn('加载配置文件失败:', e);
      }
    }
    
    return config;
  } catch (e) {
    console.error('配置加载错误:', e);
    return {};
  }
}

// 核心SDK类
class ICBCCollectibleSDK {
  constructor(config = {}) {
    // 合并默认配置和用户配置
    this.defaultConfig = {
      apiBaseUrl: 'http://localhost:3000/api',
      timeout: 30000,
      retryLimit: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 300000, // 5分钟
      debug: false,
      icbc: {
        appId: '',
        sandbox: true
      }
    };
    
    // 加载配置
    const loadedConfig = loadConfig();
    this.config = { ...this.defaultConfig, ...loadedConfig, ...config };
    
    // 存储实例状态
    this.initialized = false;
    this.modules = new Map();
    
    // 初始化SDK
    this.initialize();
  }
  
  // 初始化SDK
  initialize() {
    try {
      // 创建基础模块
      this.createBaseModules();
      
      // 注册所有模块
      this.registerModules();
      
      // 设置全局变量
      this.setupGlobalVariables();
      
      this.initialized = true;
      
      if (this.config.debug) {
        console.log('工银溯藏SDK初始化成功');
      }
      
      return this;
    } catch (error) {
      console.error('工银溯藏SDK初始化失败:', error);
      this.initialized = false;
      throw error;
    }
  }
  
  // 创建基础模块
  createBaseModules() {
    try {
      // 尝试动态加载配置模块
      let ConfigModule = null;
      if (isBrowser && window.Config) {
        ConfigModule = window.Config;
      } else if (isNode) {
        try {
          ConfigModule = require('./config.js');
        } catch (e) {
          console.warn('未找到配置模块，使用默认配置');
        }
      }
      
      // 保存配置
      if (ConfigModule && ConfigModule.default) {
        this.config = { ...this.config, ...ConfigModule.default };
      }
      
      // 创建工具模块
      let UtilsModule = null;
      if (isBrowser && window.utils) {
        UtilsModule = window.utils;
      } else if (isNode) {
        try {
          UtilsModule = require('./utils.js').utils;
        } catch (e) {
          console.warn('未找到工具模块，将在需要时动态加载');
        }
      }
      
      if (UtilsModule) {
        this.modules.set('utils', UtilsModule);
      }
      
    } catch (error) {
      console.error('创建基础模块失败:', error);
    }
  }
  
  // 注册所有模块
  registerModules() {
    try {
      // 按顺序注册模块以确保依赖关系
      this.registerModule('config', this.config);
      this.registerModule('utils', this.getModule('utils') || this.createUtilsFallback());
      this.registerModule('request', this.createRequestModule());
      this.registerModule('auth', this.createAuthModule());
      this.registerModule('collectible', this.createCollectibleModule());
      this.registerModule('brand', this.createBrandModule());
    } catch (error) {
      console.error('注册模块失败:', error);
    }
  }
  
  // 注册单个模块
  registerModule(name, module) {
    if (!name || !module) return false;
    
    this.modules.set(name, module);
    
    // 为模块添加SDK引用
    if (typeof module === 'object' && !module._sdk) {
      module._sdk = this;
    }
    
    return true;
  }
  
  // 获取模块
  getModule(name) {
    return this.modules.get(name);
  }
  
  // 创建工具模块的降级实现
  createUtilsFallback() {
    const utils = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
      deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
      formatDate: (date, format = 'YYYY-MM-DD HH:mm:ss') => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
          .replace('YYYY', year)
          .replace('MM', month)
          .replace('DD', day)
          .replace('HH', hours)
          .replace('mm', minutes)
          .replace('ss', seconds);
      }
    };
    
    return utils;
  }
  
  // 创建请求模块
  createRequestModule() {
    try {
      let RequestModule = null;
      
      if (isBrowser && window.request) {
        // 浏览器环境中已存在request实例
        RequestModule = window.request;
      } else if (isNode) {
        try {
          // Node.js环境动态加载
          RequestModule = require('./request.js').request;
        } catch (e) {
          // 创建基础请求模块
          console.warn('未找到请求模块，创建基础请求模块');
          RequestModule = this.createBaseRequestModule();
        }
      } else {
        // 创建基础请求模块
        RequestModule = this.createBaseRequestModule();
      }
      
      return RequestModule;
    } catch (error) {
      console.error('创建请求模块失败:', error);
      return this.createBaseRequestModule();
    }
  }
  
  // 创建基础请求模块
  createBaseRequestModule() {
    const utils = this.getModule('utils');
    const config = this.getModule('config');
    
    const baseRequest = {
      config,
      utils,
      async get(url, options = {}) {
        return this.request('GET', url, options);
      },
      async post(url, data = {}, options = {}) {
        return this.request('POST', url, { ...options, data });
      },
      async put(url, data = {}, options = {}) {
        return this.request('PUT', url, { ...options, data });
      },
      async delete(url, options = {}) {
        return this.request('DELETE', url, options);
      },
      async patch(url, data = {}, options = {}) {
        return this.request('PATCH', url, { ...options, data });
      },
      async request(method, url, options = {}) {
        // 基础实现仅用于示例，实际使用时需要加载完整的request.js模块
        throw new Error('请求模块未正确加载，请确保request.js文件存在');
      }
    };
    
    return baseRequest;
  }
  
  // 创建认证模块
  createAuthModule() {
    try {
      let AuthModule = null;
      
      if (isBrowser && window.auth) {
        // 浏览器环境中已存在auth实例
        AuthModule = window.auth;
      } else if (isNode) {
        try {
          // Node.js环境动态加载
          AuthModule = require('./auth.js').auth;
        } catch (e) {
          console.warn('未找到认证模块，创建基础认证模块');
          AuthModule = this.createBaseAuthModule();
        }
      } else {
        // 创建基础认证模块
        AuthModule = this.createBaseAuthModule();
      }
      
      return AuthModule;
    } catch (error) {
      console.error('创建认证模块失败:', error);
      return this.createBaseAuthModule();
    }
  }
  
  // 创建基础认证模块
  createBaseAuthModule() {
    const request = this.getModule('request');
    const utils = this.getModule('utils');
    
    const baseAuth = {
      request,
      utils,
      isAuthenticated: () => false,
      getUserInfo: () => null,
      login: async (credentials) => {
        throw new Error('认证模块未正确加载，请确保auth.js文件存在');
      },
      logout: async () => {
        throw new Error('认证模块未正确加载，请确保auth.js文件存在');
      }
    };
    
    return baseAuth;
  }
  
  // 创建藏品模块
  createCollectibleModule() {
    try {
      let CollectibleModule = null;
      
      if (isBrowser && window.collectible) {
        // 浏览器环境中已存在collectible实例
        CollectibleModule = window.collectible;
      } else if (isNode) {
        try {
          // Node.js环境动态加载
          CollectibleModule = require('./collectible.js').collectible;
        } catch (e) {
          console.warn('未找到藏品模块，创建基础藏品模块');
          CollectibleModule = this.createBaseCollectibleModule();
        }
      } else {
        // 创建基础藏品模块
        CollectibleModule = this.createBaseCollectibleModule();
      }
      
      return CollectibleModule;
    } catch (error) {
      console.error('创建藏品模块失败:', error);
      return this.createBaseCollectibleModule();
    }
  }
  
  // 创建基础藏品模块
  createBaseCollectibleModule() {
    const request = this.getModule('request');
    const auth = this.getModule('auth');
    
    const baseCollectible = {
      request,
      auth,
      createCollectible: async (data) => {
        throw new Error('藏品模块未正确加载，请确保collectible.js文件存在');
      },
      getCollectibleDetails: async (id) => {
        throw new Error('藏品模块未正确加载，请确保collectible.js文件存在');
      }
    };
    
    return baseCollectible;
  }
  
  // 创建品牌模块
  createBrandModule() {
    try {
      let BrandModule = null;
      
      if (isBrowser && window.brand) {
        // 浏览器环境中已存在brand实例
        BrandModule = window.brand;
      } else if (isNode) {
        try {
          // Node.js环境动态加载
          BrandModule = require('./brand.js').brand;
        } catch (e) {
          console.warn('未找到品牌模块，创建基础品牌模块');
          BrandModule = this.createBaseBrandModule();
        }
      } else {
        // 创建基础品牌模块
        BrandModule = this.createBaseBrandModule();
      }
      
      return BrandModule;
    } catch (error) {
      console.error('创建品牌模块失败:', error);
      return this.createBaseBrandModule();
    }
  }
  
  // 创建基础品牌模块
  createBaseBrandModule() {
    const request = this.getModule('request');
    const auth = this.getModule('auth');
    
    const baseBrand = {
      request,
      auth,
      createBrand: async (data) => {
        throw new Error('品牌模块未正确加载，请确保brand.js文件存在');
      },
      getBrandList: async (params) => {
        throw new Error('品牌模块未正确加载，请确保brand.js文件存在');
      }
    };
    
    return baseBrand;
  }
  
  // 设置全局变量
  setupGlobalVariables() {
    if (!isBrowser) return;
    
    try {
      // 确保全局命名空间存在
      window.ICBC_COLLECTIBLE = window.ICBC_COLLECTIBLE || {};
      
      // 保存SDK实例
      window.ICBC_COLLECTIBLE.SDK = this;
      
      // 暴露主要模块
      window.ICBC_COLLECTIBLE.config = this.getModule('config');
      window.ICBC_COLLECTIBLE.utils = this.getModule('utils');
      window.ICBC_COLLECTIBLE.request = this.getModule('request');
      window.ICBC_COLLECTIBLE.auth = this.getModule('auth');
      window.ICBC_COLLECTIBLE.collectible = this.getModule('collectible');
      window.ICBC_COLLECTIBLE.brand = this.getModule('brand');
      
      // 提供简化的访问方式
      if (!window.sdk) {
        window.sdk = this;
      }
    } catch (error) {
      console.error('设置全局变量失败:', error);
    }
  }
  
  // 检查SDK状态
  getStatus() {
    return {
      initialized: this.initialized,
      modules: Array.from(this.modules.keys()),
      config: this.config,
      environment: isBrowser ? 'browser' : isNode ? 'node' : 'unknown'
    };
  }
  
  // 重新加载配置
  reloadConfig(newConfig = {}) {
    // 合并新配置
    this.config = { ...this.config, ...newConfig };
    
    // 更新模块配置
    const request = this.getModule('request');
    if (request && request.setConfig) {
      request.setConfig(this.config);
    }
    
    return this;
  }
  
  // 销毁SDK
  destroy() {
    try {
      // 清理模块
      this.modules.clear();
      
      // 清理全局变量
      if (isBrowser && window.ICBC_COLLECTIBLE) {
        delete window.ICBC_COLLECTIBLE;
        if (window.sdk === this) {
          delete window.sdk;
        }
      }
      
      this.initialized = false;
      
      if (this.config.debug) {
        console.log('工银溯藏SDK已销毁');
      }
    } catch (error) {
      console.error('销毁SDK失败:', error);
    }
  }
  
  // 批量导入模块（用于Node.js环境）
  static async importModules() {
    if (!isNode) {
      console.warn('批量导入模块仅支持Node.js环境');
      return {};
    }
    
    try {
      const modules = {
        config: require('./config.js'),
        request: require('./request.js'),
        auth: require('./auth.js'),
        collectible: require('./collectible.js'),
        brand: require('./brand.js'),
        utils: require('./utils.js')
      };
      
      return modules;
    } catch (error) {
      console.error('批量导入模块失败:', error);
      return {};
    }
  }
  
  // 静态方法：创建SDK实例
  static create(config = {}) {
    return new ICBCCollectibleSDK(config);
  }
  
  // 静态方法：检查依赖
  static checkDependencies() {
    const dependencies = {
      'config.js': false,
      'request.js': false,
      'auth.js': false,
      'collectible.js': false,
      'brand.js': false,
      'utils.js': false
    };
    
    if (isBrowser) {
      // 浏览器环境检查全局变量
      dependencies['config.js'] = !!window.Config;
      dependencies['request.js'] = !!window.request;
      dependencies['auth.js'] = !!window.auth;
      dependencies['collectible.js'] = !!window.collectible;
      dependencies['brand.js'] = !!window.brand;
      dependencies['utils.js'] = !!window.utils;
    } else if (isNode) {
      // Node.js环境检查文件存在
      try {
        const fs = require('fs');
        const path = require('path');
        
        Object.keys(dependencies).forEach(filename => {
          const filePath = path.resolve(__dirname, filename);
          dependencies[filename] = fs.existsSync(filePath);
        });
      } catch (e) {
        console.error('检查依赖失败:', e);
      }
    }
    
    return dependencies;
  }
}

// 创建默认SDK实例
const defaultSDK = new ICBCCollectibleSDK();

// 导出SDK类和默认实例
try {
  // 浏览器环境
  if (isBrowser) {
    window.ICBCCollectibleSDK = ICBCCollectibleSDK;
    window.sdk = defaultSDK;
  }
  
  // Node.js环境
  if (isNode) {
    module.exports = {
      ICBCCollectibleSDK,
      sdk: defaultSDK,
      // 直接导出各个模块以便快速访问
      config: require('./config.js').default,
      request: require('./request.js').request,
      auth: require('./auth.js').auth,
      collectible: require('./collectible.js').collectible,
      brand: require('./brand.js').brand,
      utils: require('./utils.js').utils
    };
  }
} catch (e) {
  console.error('导出SDK失败:', e);
}

// 自动初始化模块加载
(function autoLoadModules() {
  if (!isBrowser) return;
  
  // 定义模块加载顺序
  const moduleUrls = [
    './config.js',
    './utils.js',
    './request.js',
    './auth.js',
    './collectible.js',
    './brand.js'
  ];
  
  // 动态加载所有模块
  const loadModules = async () => {
    try {
      for (const url of moduleUrls) {
        // 检查模块是否已加载
        const moduleName = url.split('/').pop().split('.')[0];
        if (window[moduleName] || window[moduleName.charAt(0).toUpperCase() + moduleName.slice(1)]) {
          continue;
        }
        
        // 创建script标签加载模块
        const script = document.createElement('script');
        script.src = url;
        script.type = 'text/javascript';
        
        // 使用Promise等待加载完成
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // 所有模块加载完成后，重新初始化SDK
      if (window.sdk) {
        window.sdk.initialize();
      }
    } catch (error) {
      console.error('自动加载模块失败:', error);
    }
  };
  
  // 当DOM加载完成后开始加载模块
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadModules);
  } else {
    loadModules();
  }
})();