// 工银溯藏区块链模块入口文件

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const CryptoUtils = require('./utils/crypto-utils');
const logger = require('./utils/log-utils');

// 配置文件路径
const networkConfigPath = path.resolve(__dirname, 'network', 'network-config.yaml');
const connectionProfilePath = path.resolve(__dirname, 'network', 'connection-profile.json');
const walletPath = path.resolve(__dirname, 'wallet');

// 全局变量
let gateway = null;
let network = null;
let contract = null;

const parseChaincodeResult = (resultBuffer) => {
    if (!resultBuffer || resultBuffer.length === 0) {
        return {};
    }

    const resultString = resultBuffer.toString();
    if (!resultString) {
        return {};
    }

    try {
        return JSON.parse(resultString);
    } catch (parseError) {
        logger.warn('解析链码返回值失败，返回原始字符串', { resultString, error: parseError.message });
        return { rawResult: resultString };
    }
};

function resolveTlsPath(originalPath) {
    if (!originalPath) {
        return originalPath;
    }

    if (fs.existsSync(originalPath)) {
        return originalPath;
    }

    const normalized = originalPath.replace(/\\/g, '/');
    const candidates = [];

    const anchor = '/blockchain/';
    const anchorIndex = normalized.indexOf(anchor);
    if (anchorIndex !== -1) {
        const relativePart = normalized.substring(anchorIndex + anchor.length);
        candidates.push(path.resolve(__dirname, relativePart));
    }

    candidates.push(path.resolve(__dirname, normalized));
    if (!path.isAbsolute(normalized)) {
        candidates.push(path.resolve(process.cwd(), normalized));
    }

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            logger.debug(`修正 TLS 证书路径: ${originalPath} -> ${candidate}`);
            return candidate;
        }
    }

    logger.warn(`无法找到 TLS 证书文件: ${originalPath}`);
    return originalPath;
}

function normalizeTlsCertPaths(connectionProfile) {
    if (!connectionProfile) {
        return;
    }

    const sections = ['orderers', 'peers', 'certificateAuthorities'];
    sections.forEach((section) => {
        const entries = connectionProfile[section];
        if (!entries) {
            return;
        }

        Object.values(entries).forEach((entry) => {
            if (entry?.tlsCACerts?.path) {
                entry.tlsCACerts.path = resolveTlsPath(entry.tlsCACerts.path);
            }
        });
    });
}

// 初始化区块链网络连接
exports.initialize = async () => {
    const startTime = Date.now();
    try {
        // 创建网关实例
        gateway = new Gateway();

        // 读取连接配置
        logger.debug('读取区块链连接配置...');
        const connectionProfile = await CryptoUtils.safeParseJSON(fs.readFileSync(connectionProfilePath, 'utf8'));
        normalizeTlsCertPaths(connectionProfile);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // 设置连接选项
        const connectionOptions = {
            wallet,
            identity: 'admin',
            discovery: {
                enabled: true,
                asLocalhost: true
            }
        };

        // 连接到区块链网络
        logger.debug('开始连接区块链网络...');
        await gateway.connect(connectionProfile, connectionOptions);

        // 获取网络通道
        network = await gateway.getNetwork('collectible-channel');

        // 获取智能合约
        contract = network.getContract('collectible-chaincode');
        try {
            contract.addDiscoveryInterest({ name: 'collectible-chaincode' });
        } catch (discoveryError) {
            logger.warn('添加智能合约发现兴趣失败，将使用默认发现配置', {
                error: discoveryError.message
            });
        }

        const connectionTime = Date.now() - startTime;
        logger.logNetworkConnection('icbc-collectible-network', 'admin', 'success', connectionTime);
        return true;
    } catch (error) {
        logger.logErrorDetails('初始化区块链网络', error);
        if (gateway) {
            gateway.disconnect();
        }
        return false;
    }
};

// 断开区块链网络连接
exports.disconnect = async () => {
    try {
        if (gateway) {
            await gateway.disconnect();
            logger.info('已断开区块链网络连接');
            gateway = null;
            network = null;
            contract = null;
        }
    } catch (error) {
        logger.error('断开区块链网络连接时出错:', error);
    }
};

// 调用智能合约方法
exports.invoke = async (functionName, ...args) => {
    const startTime = Date.now();
    try {
        if (!contract) {
            throw new Error('区块链网络未初始化');
        }

        // 生成交易ID
        const transaction = contract.createTransaction(functionName);
    const txIdStr = transaction.getTransactionId();

        try {
            const channel = network ? network.getChannel() : null;
            if (channel) {
                const endorsers = [
                    ...(channel.getEndorsers('ICBCMSP') || []),
                    ...(channel.getEndorsers('BrandAMSP') || []),
                    ...(channel.getEndorsers('BrandBMSP') || [])
                ].filter(Boolean);

                if (endorsers.length > 0) {
                    transaction.setEndorsingPeers(endorsers);
                } else {
                    transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');
                }
            } else {
                transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');
            }
        } catch (endorserError) {
            logger.warn('设置背书节点失败，回退到组织背书策略', {
                error: endorserError.message
            });
            try {
                transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');
            } catch (fallbackError) {
                logger.warn('设置背书组织失败，将依赖服务发现', {
                    error: fallbackError.message
                });
            }
        }

    logger.logTransaction(txIdStr, functionName, args, 'started');

    // 调用智能合约方法
    const resultBuffer = await transaction.submit(...args);

    const executionTime = Date.now() - startTime;
    const parsedResult = parseChaincodeResult(resultBuffer);
    logger.logTransaction(txIdStr, functionName, parsedResult, 'success', executionTime);

    return parsedResult;
    } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.logErrorDetails(`调用智能合约方法 ${functionName}`, error, {
            functionName,
            args,
            executionTime
        });
        throw error;
    }
};

// 查询智能合约数据
exports.query = async (functionName, ...args) => {
    const startTime = Date.now();
    try {
        if (!contract) {
            throw new Error('区块链网络未初始化');
        }

        logger.debug(`开始查询智能合约方法: ${functionName}`, { args });
        
        // 查询智能合约数据
        const result = await contract.evaluateTransaction(functionName, ...args);
        
        const executionTime = Date.now() - startTime;
        logger.debug(`查询智能合约方法 ${functionName} 完成`, {
            executionTime,
            resultLength: result.length
        });
        
        return JSON.parse(result.toString());
    } catch (error) {
        logger.logErrorDetails(`查询智能合约方法 ${functionName}`, error, {
            functionName,
            args
        });
        throw error;
    }
};

// 批量调用智能合约方法
exports.batchInvoke = async (transactions) => {
    const startTime = Date.now();
    try {
        if (!contract) {
            throw new Error('区块链网络未初始化');
        }

        logger.info(`开始批量调用智能合约方法，共 ${transactions.length} 笔交易`);
        
        // 创建事务提交器
        const results = [];

        for (const tx of transactions) {
            const txStartTime = Date.now();
            try {
                const transaction = contract.createTransaction(tx.functionName);
                const txIdStr = transaction.getTransactionId();

                try {
                    const channel = network ? network.getChannel() : null;
                    if (channel) {
                        const endorsers = [
                            ...(channel.getEndorsers('ICBCMSP') || []),
                            ...(channel.getEndorsers('BrandAMSP') || []),
                            ...(channel.getEndorsers('BrandBMSP') || [])
                        ].filter(Boolean);

                        if (endorsers.length > 0) {
                            transaction.setEndorsingPeers(endorsers);
                        } else {
                            transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');
                        }
                    } else {
                        transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');
                    }
                } catch (endorserError) {
                    logger.warn('批量调用设置背书节点失败，回退到组织背书策略', {
                        error: endorserError.message
                    });
                    try {
                        transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');
                    } catch (fallbackError) {
                        logger.warn('批量调用设置背书组织失败，将依赖服务发现', {
                            error: fallbackError.message
                        });
                    }
                }

                logger.logTransaction(txIdStr, tx.functionName, tx.args, 'started');

            const resultBuffer = await transaction.submit(...(tx.args || []));
                const parsedResult = parseChaincodeResult(resultBuffer);
                const txExecutionTime = Date.now() - txStartTime;
                const status = 'success';

                logger.logTransaction(txIdStr, tx.functionName, parsedResult, status, txExecutionTime);

                results.push({
                    txId: txIdStr,
                    status: 'VALID',
                    result: parsedResult
                });
            } catch (error) {
                const txExecutionTime = Date.now() - txStartTime;
                logger.logErrorDetails(`批量调用智能合约方法 ${tx.functionName}`, error, {
                    functionName: tx.functionName,
                    args: tx.args,
                    executionTime: txExecutionTime
                });
                
                results.push({
                    txId: 'error',
                    status: 'FAILED',
                    error: error.message
                });
            }
        }

        const totalExecutionTime = Date.now() - startTime;
        logger.logPerformanceMetrics('批量调用智能合约', totalExecutionTime, {
            transactionsCount: transactions.length,
            successCount: results.filter(r => r.status === 'VALID').length
        });

        return results;
    } catch (error) {
        logger.logErrorDetails('批量调用智能合约方法', error, {
            transactionsCount: transactions.length
        });
        throw error;
    }
};