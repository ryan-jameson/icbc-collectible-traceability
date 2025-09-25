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

// 初始化区块链网络连接
exports.initialize = async () => {
    const startTime = Date.now();
    try {
        // 创建网关实例
        gateway = new Gateway();

        // 读取连接配置
        logger.debug('读取区块链连接配置...');
        const connectionProfile = await CryptoUtils.safeParseJSON(fs.readFileSync(connectionProfilePath, 'utf8'));
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
        const txId = gateway.getClient().newTransactionID();
        const txIdStr = txId.getTransactionID();
        
        logger.logTransaction(txIdStr, functionName, args, 'started');
        
        // 调用智能合约方法
        const result = await contract.submitTransaction(functionName, ...args);
        
        const executionTime = Date.now() - startTime;
        logger.logTransaction(txIdStr, functionName, args, 'success', executionTime);
        
        return JSON.parse(result.toString());
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
        const txCommitter = network.getChannel().newCommitter();
        const results = [];

        for (const tx of transactions) {
            const txStartTime = Date.now();
            try {
                const txId = gateway.getClient().newTransactionID();
                const txIdStr = txId.getTransactionID();
                
                logger.logTransaction(txIdStr, tx.functionName, tx.args, 'started');
                
                const request = {
                    chaincodeId: 'collectible-chaincode',
                    fcn: tx.functionName,
                    args: tx.args,
                    txId
                };

                // 提交事务
                const proposalResponse = await network.getChannel().sendTransactionProposal(request);
                const commitResult = await txCommitter.commit(proposalResponse);
                
                const txExecutionTime = Date.now() - txStartTime;
                const status = commitResult.status === 'VALID' ? 'success' : 'failed';
                
                logger.logTransaction(txIdStr, tx.functionName, tx.args, status, txExecutionTime);
                
                results.push({
                    txId: txIdStr,
                    status: commitResult.status
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