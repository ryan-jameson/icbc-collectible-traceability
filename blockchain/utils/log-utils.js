// 日志工具函数
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { formatDateTime } = require('./crypto-utils');

class LogUtils {
  constructor(config = {}) {
    // 默认配置
    this.defaultConfig = {
      level: 'info',
      format: 'json',
      file: {
        enabled: true,
        path: './logs/application.log',
        maxSize: '20m',
        maxFiles: '14d'
      },
      console: {
        enabled: true
      }
    };

    // 合并用户配置和默认配置
    this.config = { ...this.defaultConfig, ...config };
    
    // 初始化日志目录
    this.initLogDirectory();
    
    // 创建logger实例
    this.logger = this.createLogger();
  }

  /**
   * 初始化日志目录
   */
  async initLogDirectory() {
    try {
      if (this.config.file && this.config.file.enabled) {
        const logDir = path.dirname(this.config.file.path);
        await fs.mkdir(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('初始化日志目录时出错:', error);
    }
  }

  /**
   * 创建logger实例
   * @returns {winston.Logger}
   */
  createLogger() {
    const transports = [];
    const format = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.printf(info => {
        return `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`;
      })
    );

    // 添加控制台传输
    if (this.config.console && this.config.console.enabled) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            format
          )
        })
      );
    }

    // 添加文件传输
    if (this.config.file && this.config.file.enabled) {
      transports.push(
        new winston.transports.File({
          filename: this.config.file.path,
          format: format,
          maxsize: this.config.file.maxSize,
          maxFiles: this.config.file.maxFiles,
          level: this.config.level
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      transports
    });
  }

  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加信息
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加信息
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加信息
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * 记录错误日志
   * @param {string|Error} message - 日志消息或错误对象
   * @param {Object} meta - 附加信息
   */
  error(message, meta = {}) {
    if (message instanceof Error) {
      this.logger.error(message.message, {
        ...meta,
        stack: message.stack
      });
    } else {
      this.logger.error(message, meta);
    }
  }

  /**
   * 记录区块链交易日志
   * @param {string} transactionId - 交易ID
   * @param {string} functionName - 函数名
   * @param {Object} params - 参数
   * @param {string} status - 状态
   * @param {number} executionTime - 执行时间(毫秒)
   */
  logTransaction(transactionId, functionName, params, status, executionTime = 0) {
    this.info(`区块链交易 ${functionName}`, {
      transactionId,
      functionName,
      params: JSON.stringify(params),
      status,
      executionTime,
      timestamp: formatDateTime()
    });
  }

  /**
   * 记录智能合约部署日志
   * @param {string} chaincodeName - 链码名称
   * @param {string} version - 版本
   * @param {string} channelName - 通道名称
   * @param {string} status - 状态
   * @param {number} deploymentTime - 部署时间(毫秒)
   */
  logChaincodeDeployment(chaincodeName, version, channelName, status, deploymentTime = 0) {
    this.info(`链码部署 ${chaincodeName}@${version}`, {
      chaincodeName,
      version,
      channelName,
      status,
      deploymentTime,
      timestamp: formatDateTime()
    });
  }

  /**
   * 记录网络连接日志
   * @param {string} networkName - 网络名称
   * @param {string} identity - 身份
   * @param {string} status - 状态
   * @param {number} connectionTime - 连接时间(毫秒)
   */
  logNetworkConnection(networkName, identity, status, connectionTime = 0) {
    this.info(`网络连接 ${networkName}`, {
      networkName,
      identity,
      status,
      connectionTime,
      timestamp: formatDateTime()
    });
  }

  /**
   * 记录藏品操作日志
   * @param {string} collectibleId - 藏品ID
   * @param {string} operation - 操作类型
   * @param {string} userId - 用户ID
   * @param {string} fromOwner - 来源所有者
   * @param {string} toOwner - 目标所有者
   */
  logCollectibleOperation(collectibleId, operation, userId, fromOwner = null, toOwner = null) {
    this.info(`藏品操作 ${operation}`, {
      collectibleId,
      operation,
      userId,
      fromOwner,
      toOwner,
      timestamp: formatDateTime()
    });
  }

  /**
   * 记录API请求日志
   * @param {string} endpoint - API端点
   * @param {string} method - HTTP方法
   * @param {string} userId - 用户ID
   * @param {number} responseTime - 响应时间(毫秒)
   * @param {number} statusCode - 状态码
   */
  logApiRequest(endpoint, method, userId, responseTime = 0, statusCode = 200) {
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this.logger[logLevel](`API请求 ${method} ${endpoint}`, {
      endpoint,
      method,
      userId,
      responseTime,
      statusCode,
      timestamp: formatDateTime()
    });
  }

  /**
   * 记录错误详情
   * @param {string} operation - 操作名称
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  logErrorDetails(operation, error, context = {}) {
    this.error(`${operation} 失败`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: formatDateTime()
    });
  }

  /**
   * 创建性能指标日志
   * @param {string} operation - 操作名称
   * @param {number} duration - 持续时间(毫秒)
   * @param {Object} metrics - 性能指标
   */
  logPerformanceMetrics(operation, duration, metrics = {}) {
    this.info(`性能指标 ${operation}`, {
      duration,
      metrics,
      timestamp: formatDateTime()
    });
  }

  /**
   * 设置日志级别
   * @param {string} level - 日志级别
   */
  setLogLevel(level) {
    this.logger.level = level;
    this.info(`日志级别已设置为: ${level}`);
  }

  /**
   * 获取当前日志级别
   * @returns {string} - 当前日志级别
   */
  getLogLevel() {
    return this.logger.level;
  }

  /**
   * 创建自定义日志格式
   * @param {Object} options - 格式选项
   * @returns {winston.Logform.Format}
   */
  static createCustomFormat(options = {}) {
    const { timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS', includeMeta = true } = options;
    
    let formatChain = winston.format.combine(
      winston.format.timestamp({ format: timestampFormat })
    );

    if (includeMeta) {
      formatChain = winston.format.combine(
        formatChain,
        winston.format.metadata()
      );
    }

    return formatChain;
  }

  /**
   * 创建单例实例
   * @param {Object} config - 配置
   * @returns {LogUtils}
   */
  static getInstance(config = {}) {
    if (!LogUtils.instance) {
      LogUtils.instance = new LogUtils(config);
    }
    return LogUtils.instance;
  }
}

// 默认导出单例
module.exports = LogUtils.getInstance();

// 导出类，以便创建多个实例
module.exports.LogUtils = LogUtils;