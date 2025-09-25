// 通用工具函数
class Utils {
  constructor() {
    // 存储实例
    this.storage = null;
    this.initializeStorage();
  }
  
  // 初始化存储机制
  initializeStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 浏览器环境使用localStorage
      this.storage = window.localStorage;
    } else if (typeof global !== 'undefined') {
      // Node.js环境使用内存存储
      this.memoryStorage = {};
      this.storage = {
        getItem: (key) => this.memoryStorage[key] || null,
        setItem: (key, value) => { this.memoryStorage[key] = value; },
        removeItem: (key) => { delete this.memoryStorage[key]; },
        clear: () => { this.memoryStorage = {}; }
      };
    }
  }
  
  // 日期格式化
  formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = date instanceof Date ? date : new Date(date);
    
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
  
  // 存储管理
  setStorage(key, value, expireTime = null) {
    if (!this.storage) return false;
    
    try {
      const data = {
        value,
        expireTime: expireTime ? Date.now() + expireTime : null
      };
      this.storage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('设置存储失败:', error);
      return false;
    }
  }
  
  getStorage(key) {
    if (!this.storage) return null;
    
    try {
      const item = this.storage.getItem(key);
      if (!item) return null;
      
      const data = JSON.parse(item);
      
      // 检查是否过期
      if (data.expireTime && data.expireTime < Date.now()) {
        this.removeStorage(key);
        return null;
      }
      
      return data.value;
    } catch (error) {
      console.error('获取存储失败:', error);
      return null;
    }
  }
  
  removeStorage(key) {
    if (!this.storage) return false;
    
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.error('移除存储失败:', error);
      return false;
    }
  }
  
  clearStorage() {
    if (!this.storage) return false;
    
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error('清理存储失败:', error);
      return false;
    }
  }
  
  // 防抖函数
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // 节流函数
  throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // 深拷贝
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }
    
    return clonedObj;
  }
  
  // 验证邮箱
  isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  }
  
  // 验证手机号
  isValidPhone(phone) {
    const re = /^1[3-9]\d{9}$/;
    return re.test(phone);
  }
  
  // 验证身份证号
  isValidIdCard(idCard) {
    // 简单验证，完整验证比较复杂
    const re = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
    return re.test(idCard);
  }
  
  // 生成唯一ID
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // 加密函数（简单实现，实际使用时应考虑更安全的加密方式）
  encrypt(text, key) {
    try {
      // 简单的异或加密，仅用于示例，实际应用应使用专业加密库
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const keyCharCode = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyCharCode);
      }
      
      // 转换为base64以便传输
      if (typeof window !== 'undefined') {
        return btoa(unescape(encodeURIComponent(result)));
      } else if (typeof Buffer !== 'undefined') {
        return Buffer.from(result).toString('base64');
      }
      
      return result;
    } catch (error) {
      console.error('加密失败:', error);
      return text;
    }
  }
  
  // 解密函数
  decrypt(encrypted, key) {
    try {
      let text;
      
      // 从base64解码
      if (typeof window !== 'undefined') {
        text = decodeURIComponent(escape(atob(encrypted)));
      } else if (typeof Buffer !== 'undefined') {
        text = Buffer.from(encrypted, 'base64').toString();
      } else {
        text = encrypted;
      }
      
      // 异或解密
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const keyCharCode = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyCharCode);
      }
      
      return result;
    } catch (error) {
      console.error('解密失败:', error);
      return encrypted;
    }
  }
  
  // 获取URL参数
  getUrlParams(url) {
    const params = {};
    const urlObj = url ? new URL(url) : window.location;
    const searchParams = new URLSearchParams(urlObj.search);
    
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  }
  
  // 设置URL参数
  setUrlParams(params, url) {
    const urlObj = url ? new URL(url) : window.location;
    const searchParams = new URLSearchParams(urlObj.search);
    
    // 清除所有现有参数
    searchParams.forEach((_, key) => {
      searchParams.delete(key);
    });
    
    // 设置新参数
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value);
      }
    });
    
    urlObj.search = searchParams.toString();
    return urlObj.toString();
  }
  
  // 下载文件
  downloadFile(data, filename, type = 'application/json') {
    if (typeof window === 'undefined') {
      console.warn('下载文件功能仅支持浏览器环境');
      return false;
    }
    
    try {
      let blob;
      
      if (data instanceof Blob) {
        blob = data;
      } else if (typeof data === 'object') {
        // JSON对象
        blob = new Blob([JSON.stringify(data, null, 2)], { type });
      } else {
        // 字符串
        blob = new Blob([data], { type });
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // 模拟点击下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('下载文件失败:', error);
      return false;
    }
  }
  
  // 处理错误信息
  handleError(error) {
    if (!error) return '未知错误';
    
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error && typeof error.error === 'string') return error.error;
    if (error.data && error.data.error) return error.data.error;
    
    // 尝试将错误对象转换为字符串
    try {
      return JSON.stringify(error);
    } catch (e) {
      return '未知错误';
    }
  }
  
  // 格式化数字（千分位）
  formatNumber(num, decimals = 2) {
    if (isNaN(num)) return '0';
    
    const n = Number(num);
    return n.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  // 格式化金额
  formatCurrency(amount, symbol = '¥', decimals = 2) {
    const formattedNumber = this.formatNumber(amount, decimals);
    return `${symbol}${formattedNumber}`;
  }
  
  // 计算两个日期之间的天数
  daysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  
  // 检查对象是否为空
  isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (typeof obj !== 'object') return false;
    if (obj instanceof Array) return obj.length === 0;
    return Object.keys(obj).length === 0;
  }
  
  // 合并对象
  mergeObjects(...objects) {
    return objects.reduce((acc, obj) => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          if (obj[key] && typeof obj[key] === 'object' && !obj[key] instanceof Array) {
            // 递归合并嵌套对象
            acc[key] = this.mergeObjects(acc[key] || {}, obj[key]);
          } else {
            acc[key] = obj[key];
          }
        });
      }
      return acc;
    }, {});
  }
  
  // 生成随机数
  random(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // 随机颜色生成
  randomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  
  // 检查是否为移动设备
  isMobile() {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
    return mobileRegex.test(userAgent);
  }
  
  // 获取设备信息
  getDeviceInfo() {
    if (typeof window === 'undefined') {
      return { type: 'server', platform: process.platform };
    }
    
    const isMobile = this.isMobile();
    const isTablet = isMobile && window.innerWidth >= 768;
    
    return {
      type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      browser: this.getBrowserName(),
      platform: window.navigator.platform,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    };
  }
  
  // 获取浏览器名称
  getBrowserName() {
    if (typeof window === 'undefined') return 'unknown';
    
    const userAgent = window.navigator.userAgent;
    
    if (userAgent.indexOf('MSIE') !== -1 || userAgent.indexOf('Trident/') !== -1) {
      return 'Internet Explorer';
    }
    if (userAgent.indexOf('Edge/') !== -1) {
      return 'Edge';
    }
    if (userAgent.indexOf('Chrome/') !== -1) {
      return 'Chrome';
    }
    if (userAgent.indexOf('Firefox/') !== -1) {
      return 'Firefox';
    }
    if (userAgent.indexOf('Safari/') !== -1) {
      return 'Safari';
    }
    
    return 'Unknown';
  }
  
  // 打印日志
  log(level, ...messages) {
    const timestamp = this.formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss.SSS');
    const logPrefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    switch (level.toLowerCase()) {
      case 'error':
        console.error(logPrefix, ...messages);
        break;
      case 'warn':
        console.warn(logPrefix, ...messages);
        break;
      case 'info':
        console.info(logPrefix, ...messages);
        break;
      case 'debug':
        if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production' || 
            typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
          console.debug(logPrefix, ...messages);
        }
        break;
      default:
        console.log(logPrefix, ...messages);
    }
  }
  
  // 延迟执行
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 滚动到指定元素
  scrollToElement(element, options = {}) {
    if (typeof window === 'undefined') return;
    
    const defaultOptions = {
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    };
    
    const mergedOptions = this.mergeObjects(defaultOptions, options);
    
    if (typeof element === 'string') {
      const el = document.querySelector(element);
      if (el) {
        el.scrollIntoView(mergedOptions);
      }
    } else if (element && element.scrollIntoView) {
      element.scrollIntoView(mergedOptions);
    }
  }
  
  // 复制文本到剪贴板
  async copyToClipboard(text) {
    if (typeof window === 'undefined') {
      throw new Error('复制功能仅支持浏览器环境');
    }
    
    try {
      // 尝试使用现代API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // 回退到传统方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return result;
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      throw error;
    }
  }
  
  // 加载脚本
  loadScript(url, options = {}) {
    if (typeof window === 'undefined') {
      throw new Error('加载脚本功能仅支持浏览器环境');
    }
    
    return new Promise((resolve, reject) => {
      // 检查脚本是否已加载
      const existingScript = document.querySelector(`script[src="${url}"]`);
      if (existingScript && !options.forceReload) {
        resolve(existingScript);
        return;
      }
      
      // 移除已存在的脚本（如果需要强制重新加载）
      if (existingScript && options.forceReload) {
        existingScript.remove();
      }
      
      const script = document.createElement('script');
      script.src = url;
      
      // 设置选项
      if (options.type) script.type = options.type;
      if (options.charset) script.charset = options.charset;
      if (options.async !== undefined) script.async = options.async;
      if (options.defer !== undefined) script.defer = options.defer;
      
      // 成功回调
      script.onload = () => resolve(script);
      
      // 错误回调
      script.onerror = (event) => {
        console.error(`加载脚本失败: ${url}`, event);
        reject(new Error(`Failed to load script: ${url}`));
      };
      
      // 添加到文档
      document.head.appendChild(script);
    });
  }
  
  // 检测网络状态
  checkNetworkStatus() {
    if (typeof window === 'undefined') {
      return { online: true, type: 'unknown' };
    }
    
    return {
      online: navigator.onLine,
      type: navigator.connection?.effectiveType || 'unknown',
      rtt: navigator.connection?.rtt || 0,
      downlink: navigator.connection?.downlink || 0
    };
  }
  
  // 计算文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 验证JSON格式
  isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
}

// 创建默认实例
const utils = new Utils();

// 导出类和默认实例
try {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    window.Utils = Utils;
    window.utils = utils;
  }
  // Node.js环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils, utils };
  }
} catch (e) {
  console.error('导出工具函数失败:', e);
}