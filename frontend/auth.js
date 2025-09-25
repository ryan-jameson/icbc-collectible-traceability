// 认证SDK
class AuthSDK {
  constructor(requestTool) {
    // 使用传入的请求工具或全局请求实例
    this.request = requestTool || (typeof window !== 'undefined' && window.request);
    
    if (!this.request) {
      throw new Error('请求工具未初始化');
    }
    
    // 事件监听器存储
    this.listeners = new Map();
    
    // 绑定事件处理
    this.bindEvents();
  }
  
  // 绑定全局事件
  bindEvents() {
    if (typeof window !== 'undefined') {
      // 监听认证过期事件
      window.addEventListener('auth:expired', () => {
        this.handleAuthExpired();
      });
      
      // 监听页面可见性变化，检查认证状态
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkAuthStatus();
        }
      });
    }
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
  
  // 用户注册
  async register(userData) {
    try {
      const response = await this.request.post('/auth/register', userData, { includeAuth: false });
      
      if (response.success) {
        // 保存认证信息
        if (response.data?.token) {
          this.request.saveAuthToken(response.data.token);
        }
        
        // 保存用户信息
        this.saveUserInfo(response.data?.user);
        
        // 触发注册成功事件
        this.emit('register:success', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('register:error', error);
      throw error;
    }
  }
  
  // 用户登录（邮箱密码）
  async login(email, password) {
    try {
      const response = await this.request.post('/auth/login', 
        { email, password }, 
        { includeAuth: false }
      );
      
      if (response.success) {
        // 保存认证信息
        if (response.data?.token) {
          this.request.saveAuthToken(response.data.token);
        }
        
        // 保存用户信息
        this.saveUserInfo(response.data?.user);
        
        // 触发登录成功事件
        this.emit('login:success', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('login:error', error);
      throw error;
    }
  }
  
  // 工行一键登录
  async icbcLogin(icbcToken) {
    try {
      const response = await this.request.post('/auth/login/icbc', 
        { icbcToken }, 
        { includeAuth: false }
      );
      
      if (response.success) {
        // 保存认证信息
        if (response.data?.token) {
          this.request.saveAuthToken(response.data.token);
        }
        
        // 保存用户信息
        this.saveUserInfo(response.data?.user);
        
        // 触发登录成功事件
        this.emit('login:success', response.data);
        this.emit('icbc:login:success', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('login:error', error);
      this.emit('icbc:login:error', error);
      throw error;
    }
  }
  
  // 获取当前用户信息
  async getCurrentUser() {
    try {
      const response = await this.request.get('/auth/me');
      
      if (response.success) {
        // 保存用户信息
        this.saveUserInfo(response.data);
        
        // 触发获取用户信息成功事件
        this.emit('user:loaded', response.data);
      }
      
      return response;
    } catch (error) {
      this.emit('user:load:error', error);
      throw error;
    }
  }
  
  // 刷新令牌
  async refreshToken() {
    try {
      const response = await this.request.post('/auth/refresh');
      
      if (response.success) {
        // 保存新令牌
        if (response.data?.token) {
          this.request.saveAuthToken(response.data.token);
          this.emit('token:refreshed', response.data.token);
        }
      }
      
      return response;
    } catch (error) {
      this.emit('token:refresh:error', error);
      // 令牌刷新失败，需要重新登录
      this.handleAuthExpired();
      throw error;
    }
  }
  
  // 注销登录
  async logout() {
    try {
      // 尝试调用API注销
      const response = await this.request.post('/auth/logout');
      
      // 清除认证信息
      this.clearAuthInfo();
      
      // 触发注销成功事件
      this.emit('logout:success', response);
      
      return response;
    } catch (error) {
      // 即使API调用失败，也要清除本地认证信息
      this.clearAuthInfo();
      this.emit('logout:error', error);
      throw error;
    }
  }
  
  // 检查认证状态
  checkAuthStatus() {
    const token = this.request.getAuthToken();
    if (!token) {
      this.emit('auth:unauthenticated');
      return false;
    }
    
    // 简单检查令牌是否过期
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('无效的令牌格式');
      }
      
      const payload = JSON.parse(atob(tokenParts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      // 令牌即将过期，自动刷新
      if (payload.exp && now > payload.exp - 300) { // 5分钟内过期
        this.refreshToken();
      } else if (payload.exp && now > payload.exp) { // 已过期
        this.handleAuthExpired();
        return false;
      }
    } catch (e) {
      console.error('检查令牌状态时出错:', e);
      this.handleAuthExpired();
      return false;
    }
    
    this.emit('auth:authenticated');
    return true;
  }
  
  // 处理认证过期
  handleAuthExpired() {
    this.clearAuthInfo();
    this.emit('auth:expired');
    
    // 如果有配置的登录页面，可以重定向
    if (typeof window !== 'undefined' && window.location) {
      // 保存当前页面以便登录后跳转回来
      const currentPath = window.location.pathname + window.location.search;
      localStorage.setItem('redirect_after_login', currentPath);
      
      // 这里可以触发银行APP的登录弹窗或跳转到登录页面
      this.emit('auth:login:required');
    }
  }
  
  // 保存用户信息
  saveUserInfo(userInfo) {
    if (typeof localStorage !== 'undefined' && userInfo) {
      const storageKey = this.request.config?.STORAGE_KEYS?.USER_INFO || 'icbc_collectible_user_info';
      localStorage.setItem(storageKey, JSON.stringify(userInfo));
    }
  }
  
  // 获取保存的用户信息
  getUserInfo() {
    if (typeof localStorage !== 'undefined') {
      const storageKey = this.request.config?.STORAGE_KEYS?.USER_INFO || 'icbc_collectible_user_info';
      const userInfoStr = localStorage.getItem(storageKey);
      if (userInfoStr) {
        try {
          return JSON.parse(userInfoStr);
        } catch (e) {
          console.error('解析用户信息失败:', e);
        }
      }
    }
    return null;
  }
  
  // 清除认证信息
  clearAuthInfo() {
    this.request.removeAuthToken();
    
    if (typeof localStorage !== 'undefined') {
      const storageKey = this.request.config?.STORAGE_KEYS?.USER_INFO || 'icbc_collectible_user_info';
      localStorage.removeItem(storageKey);
    }
  }
  
  // 是否已认证
  isAuthenticated() {
    const token = this.request.getAuthToken();
    return !!token;
  }
  
  // 获取用户角色
  getUserRole() {
    const userInfo = this.getUserInfo();
    return userInfo?.role || null;
  }
  
  // 检查用户角色
  hasRole(role) {
    const userRole = this.getUserRole();
    if (!userRole) return false;
    
    // 角色层级检查
    const roleHierarchy = {
      'USER': ['USER'],
      'BRAND_ADMIN': ['BRAND_ADMIN', 'USER'],
      'ICBC_ADMIN': ['ICBC_ADMIN', 'BRAND_ADMIN', 'USER'],
      'SUPER_ADMIN': ['SUPER_ADMIN', 'ICBC_ADMIN', 'BRAND_ADMIN', 'USER']
    };
    
    return roleHierarchy[userRole]?.includes(role) || false;
  }
  
  // 工行认证中间件（用于特定操作）
  async withIcbcAuth(operationFn, verificationData = {}) {
    try {
      // 检查是否已通过工行认证
      const userInfo = this.getUserInfo();
      if (!userInfo?.icbcUserId) {
        throw new Error('需要工行账户认证');
      }
      
      // 如果需要额外验证（如验证码），这里可以添加逻辑
      // 例如：请求用户输入验证码或调用银行APP的生物识别
      
      // 执行操作
      const result = await operationFn(verificationData);
      
      // 触发工行认证操作成功事件
      this.emit('icbc:auth:success', { operation: operationFn.name, result });
      
      return result;
    } catch (error) {
      this.emit('icbc:auth:error', error);
      throw error;
    }
  }
}

// 创建默认实例
const auth = new AuthSDK();

// 导出类和默认实例
try {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    window.AuthSDK = AuthSDK;
    window.auth = auth;
  }
  // Node.js环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthSDK, auth };
  }
} catch (e) {
  console.error('导出认证SDK失败:', e);
}