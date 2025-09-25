// 加密工具函数
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class CryptoUtils {
  /**
   * 计算数据的SHA256哈希
   * @param {string|Buffer} data - 要哈希的数据
   * @returns {string} - 十六进制格式的哈希值
   */
  static sha256(data) {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(data);
      return hash.digest('hex');
    } catch (error) {
      console.error('计算SHA256哈希时出错:', error);
      throw error;
    }
  }

  /**
   * 计算文件的SHA256哈希
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} - 十六进制格式的文件哈希
   */
  static async hashFile(filePath) {
    try {
      const fileData = await fs.readFile(filePath);
      return this.sha256(fileData);
    } catch (error) {
      console.error('计算文件哈希时出错:', error);
      throw error;
    }
  }

  /**
   * 验证数据的哈希
   * @param {string|Buffer} data - 要验证的数据
   * @param {string} expectedHash - 预期的哈希值
   * @returns {boolean} - 验证结果
   */
  static verifyHash(data, expectedHash) {
    try {
      const actualHash = this.sha256(data);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('验证哈希时出错:', error);
      return false;
    }
  }

  /**
   * 生成随机密钥
   * @param {number} length - 密钥长度
   * @returns {string} - 随机密钥
   */
  static generateKey(length = 32) {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      console.error('生成随机密钥时出错:', error);
      throw error;
    }
  }

  /**
   * 生成唯一ID
   * @returns {string} - 唯一ID
   */
  static generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * 加载YAML配置文件
   * @param {string} configPath - 配置文件路径
   * @returns {Promise<Object>} - 配置对象
   */
  static async loadYamlConfig(configPath) {
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      return yaml.parse(configData);
    } catch (error) {
      console.error('加载YAML配置时出错:', error);
      throw error;
    }
  }

  /**
   * 保存YAML配置文件
   * @param {string} configPath - 配置文件路径
   * @param {Object} configData - 配置数据
   * @returns {Promise<void>}
   */
  static async saveYamlConfig(configPath, configData) {
    try {
      const yamlData = yaml.stringify(configData);
      await fs.writeFile(configPath, yamlData, 'utf8');
    } catch (error) {
      console.error('保存YAML配置时出错:', error);
      throw error;
    }
  }

  /**
   * 读取环境配置
   * @param {string} envPath - .env文件路径
   * @returns {Promise<Object>} - 环境配置对象
   */
  static async loadEnvConfig(envPath) {
    try {
      const envData = await fs.readFile(envPath, 'utf8');
      const config = {};
      
      envData.split('\n').forEach(line => {
        // 忽略空行和注释行
        if (line.trim() === '' || line.trim().startsWith('#')) {
          return;
        }
        
        const [key, value] = line.split('=', 2);
        if (key && value) {
          config[key.trim()] = value.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
      });
      
      return config;
    } catch (error) {
      console.error('加载环境配置时出错:', error);
      return {};
    }
  }

  /**
   * 格式化日期时间
   * @param {Date} date - 日期对象
   * @returns {string} - 格式化的日期时间字符串
   */
  static formatDateTime(date = new Date()) {
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  /**
   * 检查目录是否存在，不存在则创建
   * @param {string} dirPath - 目录路径
   * @returns {Promise<void>}
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error('创建目录时出错:', error);
      throw error;
    }
  }

  /**
   * 安全地解析JSON字符串
   * @param {string} jsonString - JSON字符串
   * @returns {Object|null} - 解析后的对象或null
   */
  static safeParseJSON(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('解析JSON时出错:', error);
      return null;
    }
  }

  /**
   * 深度合并两个对象
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   * @returns {Object} - 合并后的对象
   */
  static deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 验证数据库ID格式
   * @param {string|number} id - 要验证的ID
   * @returns {boolean} - 验证结果
   */
  static isValidId(id) {
    // 支持数字ID和UUID格式
    if (typeof id === 'number') {
      return id > 0;
    }
    if (typeof id === 'string') {
      // 数字字符串格式
      if (/^\d+$/.test(id)) {
        return parseInt(id) > 0;
      }
      // UUID格式
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
    }
    return false;
  }

  /**
   * 转义正则表达式特殊字符
   * @param {string} string - 要转义的字符串
   * @returns {string} - 转义后的字符串
   */
  static escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 生成QR码数据URL
   * @param {string} data - 要编码到QR码的数据
   * @returns {Promise<string>} - 数据URL
   */
  static async generateQRCodeDataURL(data) {
    try {
      // 动态加载qrcode库，避免不必要的依赖
      const QRCode = await import('qrcode');
      return QRCode.toDataURL(data);
    } catch (error) {
      console.error('生成QR码时出错:', error);
      throw error;
    }
  }

  /**
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试执行函数
   * @param {Function} fn - 要执行的函数
   * @param {number} retries - 重试次数
   * @param {number} delayMs - 重试间隔
   * @returns {Promise<any>}
   */
  static async retry(fn, retries = 3, delayMs = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        console.warn(`操作失败，${delayMs}ms后重试 (剩余${retries}次)...`, error.message);
        await this.delay(delayMs);
        return this.retry(fn, retries - 1, delayMs);
      } else {
        console.error('重试次数用尽，操作失败:', error);
        throw error;
      }
    }
  }

  /**
   * 规范化文件路径
   * @param {string} filePath - 文件路径
   * @returns {string} - 规范化的文件路径
   */
  static normalizePath(filePath) {
    return path.resolve(filePath).replace(/\\/g, '/');
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} - 文件是否存在
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = CryptoUtils;