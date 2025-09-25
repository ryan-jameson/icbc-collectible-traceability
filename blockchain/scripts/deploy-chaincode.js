// 部署智能合约脚本

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 配置常量
const CONNECTION_PROFILE_PATH = path.resolve(__dirname, '..', 'network', 'connection-profile.json');
const WALLET_PATH = path.resolve(__dirname, '..', 'wallet');
const CHAINCODE_PATH = path.resolve(__dirname, '..', 'chaincode');
const CHAINCODE_NAME = 'collectible-chaincode';
const CHAINCODE_VERSION = '1.0';
let CHAINCODE_SEQUENCE = parseInt(process.env.CHAINCODE_SEQUENCE || '1', 10);
const CHANNEL_NAME = 'collectible-channel';
let CHAINCODE_LABEL = `${CHAINCODE_NAME}_${CHAINCODE_SEQUENCE}`;
const ORDERER_ENDPOINT = 'orderer.icbc.com:7050';
const ORDERER_HOSTNAME = 'orderer.icbc.com';
const ORDERER_CA_PATH = '/etc/hyperledger/fabric/crypto-config/ordererOrganizations/icbc.com/orderers/orderer.icbc.com/msp/tlscacerts/tlsca.icbc.com-cert.pem';

const ORG_CONFIGS = [
    {
        name: 'ICBC',
        container: 'peer0.icbc.com',
        mspId: 'ICBCMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.icbc.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt',
        commitTlsRoot: '/etc/hyperledger/fabric/tls/ca.crt'
    },
    {
        name: 'BrandA',
        container: 'peer0.branda.com',
        mspId: 'BrandAMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.branda.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt',
        commitTlsRoot: '/etc/hyperledger/fabric/crypto-config/peerOrganizations/branda.com/peers/peer0.branda.com/tls/ca.crt'
    },
    {
        name: 'BrandB',
        container: 'peer0.brandb.com',
        mspId: 'BrandBMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.brandb.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt',
        commitTlsRoot: '/etc/hyperledger/fabric/crypto-config/peerOrganizations/brandb.com/peers/peer0.brandb.com/tls/ca.crt'
    }
];

function buildDockerCommand(config, command) {
    const envArgs = [
        `-e CORE_PEER_LOCALMSPID=${config.mspId}`,
        `-e CORE_PEER_MSPCONFIGPATH=${config.mspPath}`,
        `-e CORE_PEER_ADDRESS=${config.address}`,
        '-e CORE_PEER_TLS_ENABLED=true',
        `-e CORE_PEER_TLS_ROOTCERT_FILE=${config.tlsRootCert}`
    ];

    return `docker exec ${envArgs.join(' ')} ${config.container} /bin/sh -c "${command}"`;
}

function runPeerCommand(config, command, options = { inherit: true }) {
    const dockerCommand = buildDockerCommand(config, command);
    if (options.inherit) {
        execSync(dockerCommand, { stdio: 'inherit' });
        return null;
    }
    return execSync(dockerCommand, { stdio: 'pipe', encoding: 'utf8' });
}

function refreshChaincodeDeploymentParams() {
    try {
        const output = runPeerCommand(
            ORG_CONFIGS[0],
            `peer lifecycle chaincode querycommitted --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME}`,
            { inherit: false }
        );

        const sequenceMatch = output && output.match(/Sequence:\s*(\d+)/);
        if (sequenceMatch) {
            const committedSequence = parseInt(sequenceMatch[1], 10);
            if (!Number.isNaN(committedSequence) && committedSequence >= CHAINCODE_SEQUENCE) {
                CHAINCODE_SEQUENCE = committedSequence + 1;
                CHAINCODE_LABEL = `${CHAINCODE_NAME}_${CHAINCODE_SEQUENCE}`;
                console.log(`检测到已提交的链码序列 ${committedSequence}，将使用序列 ${CHAINCODE_SEQUENCE}`);
            }
        }
    } catch (error) {
        const stderr = error?.stderr?.toString?.() || '';
        const stdout = error?.stdout?.toString?.() || '';
        const message = `${stderr} ${stdout} ${error?.message || ''}`.trim();
        if (message.includes('chaincode definition for') && message.includes('does not exist')) {
            console.log('未检测到已提交的链码定义，使用默认序列设置');
        } else if (message) {
            console.warn('查询现有链码定义信息时出现警告，将继续部署:', message);
        }
    }
}

// 创建钱包并导入身份
async function createWallet() {
    console.log('创建钱包并导入身份...');
    
    try {
        // 创建文件系统钱包
        const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);
        console.log(`钱包已创建: ${WALLET_PATH}`);
        
        // 检查 admin 身份是否已存在
        const existingIdentity = await wallet.get('admin');

        const certPath = path.resolve(__dirname, '..', 'network', 'crypto-config', 'peerOrganizations', 'icbc.com', 'users', 'Admin@icbc.com', 'msp', 'signcerts', 'Admin@icbc.com-cert.pem');
        const keyPath = path.resolve(__dirname, '..', 'network', 'crypto-config', 'peerOrganizations', 'icbc.com', 'users', 'Admin@icbc.com', 'msp', 'keystore', 'priv_sk');

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
            console.log('证书或私钥文件不存在，请确保已运行 start-network.js 脚本');
            return null;
        }

        const certificate = fs.readFileSync(certPath, 'utf8');
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        let shouldImport = false;
        if (!existingIdentity) {
            console.log('admin 身份不存在，需要导入');
            shouldImport = true;
        } else {
            const storedCert = existingIdentity.credentials?.certificate || '';
            const storedKey = existingIdentity.credentials?.privateKey || '';
            if (storedCert.trim() !== certificate.trim() || storedKey.trim() !== privateKey.trim()) {
                console.log('检测到 admin 身份证书已更新，重新导入钱包');
                shouldImport = true;
            } else {
                console.log('admin 身份已存在于钱包中');
            }
        }

        if (shouldImport) {
            if (existingIdentity) {
                await wallet.remove('admin');
            }

            const identity = {
                credentials: {
                    certificate,
                    privateKey
                },
                mspId: 'ICBCMSP',
                type: 'X.509'
            };

            await wallet.put('admin', identity);
            console.log('admin 身份已导入钱包');
        }
        
        return wallet;
    } catch (error) {
        console.error('创建钱包失败:', error);
        return null;
    }
}

// 打包智能合约
function packageChaincode() {
    console.log('开始打包智能合约...');

    try {
        if (!fs.existsSync(CHAINCODE_PATH)) {
            console.error(`智能合约目录不存在: ${CHAINCODE_PATH}`);
            return false;
        }

        const mainChaincodeFile = path.resolve(CHAINCODE_PATH, 'collectible-chaincode.js');
        if (!fs.existsSync(mainChaincodeFile)) {
            console.error(`主智能合约文件不存在: ${mainChaincodeFile}`);
            return false;
        }

        const packageMarker = path.resolve(CHAINCODE_PATH, `${CHAINCODE_NAME}.tar.gz`);
        if (fs.existsSync(packageMarker)) {
            fs.unlinkSync(packageMarker);
        }

    const command = `peer lifecycle chaincode package /opt/gopath/src/github.com/chaincode/${CHAINCODE_NAME}.tar.gz --lang node --path /opt/gopath/src/github.com/chaincode --label ${CHAINCODE_LABEL}`;
        runPeerCommand(ORG_CONFIGS[0], command);

        console.log('智能合约打包成功');
        return true;
    } catch (error) {
        console.error('打包智能合约失败:', error);
        return false;
    }
}

function installChaincodeOnPeers() {
    console.log('在各组织的对等节点上安装链码...');

    ORG_CONFIGS.forEach((config) => {
        try {
            const output = runPeerCommand(
                config,
                `peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/${CHAINCODE_NAME}.tar.gz`,
                { inherit: false }
            );
            if (output) {
                console.log(output.trim());
            }
            console.log(`${config.name} 已安装链码包`);
        } catch (error) {
            const stderr = error?.stderr?.toString?.() || '';
            const stdout = error?.stdout?.toString?.() || '';
            const combinedMessage = `${stderr} ${stdout} ${error?.message || ''}`;

            if (combinedMessage.includes('already installed') || combinedMessage.includes('already successfully installed') || combinedMessage.includes('exists')) {
                console.log(`${config.name} 已存在链码安装，跳过`);
            } else {
                console.error(`${config.name} 安装链码失败:`, error);
                throw error;
            }
        }
    });
}

function queryInstalledPackageId() {
    console.log('查询链码包 ID...');

    const output = runPeerCommand(ORG_CONFIGS[0], 'peer lifecycle chaincode queryinstalled', { inherit: false });
    const match = output.match(new RegExp(`Package ID: ([^,]+), Label: ${CHAINCODE_LABEL}`));

    if (!match) {
        throw new Error('无法在已安装链码列表中找到链码包 ID');
    }

    const packageId = match[1].trim();
    console.log(`链码包 ID: ${packageId}`);
    return packageId;
}

function approveChaincodeForOrgs(packageId) {
    console.log('为各组织批准链码定义...');

    ORG_CONFIGS.forEach((config) => {
        try {
            const command = `peer lifecycle chaincode approveformyorg -o ${ORDERER_ENDPOINT} --ordererTLSHostnameOverride ${ORDERER_HOSTNAME} --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --package-id ${packageId} --sequence ${CHAINCODE_SEQUENCE} --tls true --cafile ${ORDERER_CA_PATH}`;
            const output = runPeerCommand(config, command, { inherit: false });
            if (output) {
                console.log(output.trim());
            }
            console.log(`${config.name} 已批准链码定义`);
        } catch (error) {
            const stderr = error?.stderr?.toString?.() || '';
            const stdout = error?.stdout?.toString?.() || '';
            const combinedMessage = `${stderr} ${stdout} ${error?.message || ''}`;

            if (combinedMessage.includes('already approved') || combinedMessage.includes('already submitted') || combinedMessage.includes('ENDORSEMENT_POLICY_FAILURE')) {
                console.log(`${config.name} 已批准链码，跳过`);
            } else {
                console.error(`${config.name} 批准链码失败:`, error);
                throw error;
            }
        }
    });
}

function checkCommitReadiness() {
    console.log('检查链码提交就绪状态...');
    const command = `peer lifecycle chaincode checkcommitreadiness --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --sequence ${CHAINCODE_SEQUENCE} --output json`;
    try {
        const output = runPeerCommand(ORG_CONFIGS[0], command, { inherit: false });
        console.log(output);
    } catch (error) {
        const stderr = error?.stderr?.toString?.() || '';
        const stdout = error?.stdout?.toString?.() || '';
        const combinedMessage = `${stderr} ${stdout} ${error?.message || ''}`;

        if (combinedMessage.includes('requested sequence') || combinedMessage.includes('new definition must be')) {
            console.log('链码已提交，跳过提交就绪检查');
        } else {
            throw error;
        }
    }
}

function commitChaincode() {
    console.log('提交链码定义到通道...');

    const peerArgs = ORG_CONFIGS.map((config) => `--peerAddresses ${config.address} --tlsRootCertFiles ${config.commitTlsRoot}`).join(' ');
    const command = `peer lifecycle chaincode commit -o ${ORDERER_ENDPOINT} --ordererTLSHostnameOverride ${ORDERER_HOSTNAME} --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --sequence ${CHAINCODE_SEQUENCE} --tls true --cafile ${ORDERER_CA_PATH} ${peerArgs}`;

    try {
        const output = runPeerCommand(ORG_CONFIGS[0], command, { inherit: false });
        if (output) {
            console.log(output.trim());
        }
        console.log('链码定义已提交');
    } catch (error) {
        const stderr = error?.stderr?.toString?.() || '';
        const stdout = error?.stdout?.toString?.() || '';
        const combinedMessage = `${stderr} ${stdout} ${error?.message || ''}`;

        if (combinedMessage.includes('exists with sequence') || combinedMessage.includes('requested sequence') || combinedMessage.includes('new definition must be')) {
            console.log('链码已提交，跳过');
        } else {
            console.error('链码提交失败:', error);
            throw error;
        }
    }
}

function queryCommitted() {
    console.log('查询通道上的链码定义...');
    const command = `peer lifecycle chaincode querycommitted --channelID ${CHANNEL_NAME}`;
    const output = runPeerCommand(ORG_CONFIGS[0], command, { inherit: false });
    console.log(output);
}

async function initializeChaincode() {
    console.log('初始化智能合约并验证部署...');

    try {
        const connectionProfile = JSON.parse(fs.readFileSync(CONNECTION_PROFILE_PATH, 'utf8'));
        const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);
        const gateway = new Gateway();

        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: {
                enabled: true,
                asLocalhost: true
            }
        });

        const network = await gateway.getNetwork(CHANNEL_NAME);
        const contract = network.getContract(CHAINCODE_NAME, 'CollectibleTraceabilityContract');
        contract.addDiscoveryInterest({ name: CHAINCODE_NAME });
        const transaction = contract.createTransaction('initLedger');
        transaction.setEndorsingOrganizations('ICBCMSP', 'BrandAMSP', 'BrandBMSP');

        const channel = network.getChannel();
        const icbcEndorsers = channel.getEndorsers('ICBCMSP');
        const brandAEndorsers = channel.getEndorsers('BrandAMSP');
        const brandBEndorsers = channel.getEndorsers('BrandBMSP');
        const endorsers = [...icbcEndorsers, ...brandAEndorsers, ...brandBEndorsers];

        if (endorsers.length === 0) {
            console.warn('未能获取任何背书节点，将依赖服务发现结果');
        } else {
            transaction.setEndorsingPeers(endorsers);
        }

        try {
            await transaction.submit();
            console.log('initLedger 事务执行成功');
        } catch (initError) {
            const message = initError?.message || '';
            if (message.includes('already exists') || message.includes('duplicate key')) {
                console.log('链码已初始化，跳过 initLedger');
            } else {
                throw initError;
            }
        }

        await gateway.disconnect();
        console.log('智能合约部署验证成功');
        return true;
    } catch (error) {
        console.error('智能合约初始化失败:', error);
        return false;
    }
}

// 主函数
async function main() {
    try {
        console.log('==================== 开始部署智能合约 ====================');
        
        // 1. 检查连接配置文件是否存在
        if (!fs.existsSync(CONNECTION_PROFILE_PATH)) {
            console.error(`连接配置文件不存在: ${CONNECTION_PROFILE_PATH}`);
            console.error('请先运行 start-network.js 脚本');
            process.exit(1);
        }
        
        // 2. 创建钱包并导入身份
        const wallet = await createWallet();
        if (!wallet) {
            console.error('创建钱包失败，无法继续部署');
            process.exit(1);
        }

        refreshChaincodeDeploymentParams();
        
        // 3. 打包智能合约
        const packaged = packageChaincode();
        if (!packaged) {
            console.error('打包智能合约失败，无法继续部署');
            process.exit(1);
        }

        // 4. 在各组织安装链码
        installChaincodeOnPeers();

        // 5. 查询链码包 ID
        const packageId = queryInstalledPackageId();

        // 6. 为各组织批准链码
        approveChaincodeForOrgs(packageId);

        // 7. 检查是否满足提交条件
        checkCommitReadiness();

        // 8. 提交链码定义
        commitChaincode();

        // 9. 查询提交结果
        queryCommitted();

        // 10. 初始化链码
        const initialized = await initializeChaincode();

        if (initialized) {
            console.log('==================== 智能合约部署完成 ====================');
            console.log(`链码名称: ${CHAINCODE_NAME}`);
            console.log(`链码版本: ${CHAINCODE_VERSION}`);
            console.log(`通道名称: ${CHANNEL_NAME}`);
            console.log('下一步: 启动 API 服务并开始使用藏品溯源功能');
        } else {
            console.error('==================== 智能合约部署失败 ====================');
            console.error('请检查区块链网络状态和配置后重试');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('部署智能合约过程中发生错误:', error);
        process.exit(1);
    }
}

// 运行主函数
main();