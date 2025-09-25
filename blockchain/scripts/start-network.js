// 启动区块链网络脚本

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 配置常量
const FABRIC_BIN_PATH = path.resolve(__dirname, '..', '..', 'bin');
const FABRIC_SCRIPTS_PATH = path.resolve(__dirname, '..', 'network');
const CRYPTO_CONFIG_PATH = path.resolve(FABRIC_SCRIPTS_PATH, 'crypto-config');
const CHANNEL_ARTIFACTS_PATH = path.resolve(FABRIC_SCRIPTS_PATH, 'channel-artifacts');
const CHANNEL_NAME = 'collectible-channel';
const ORDERER_CONTAINER = 'orderer.icbc.com';
const ORDERER_CA_PATH = '/etc/hyperledger/fabric/crypto-config/ordererOrganizations/icbc.com/orderers/orderer.icbc.com/msp/tlscacerts/tlsca.icbc.com-cert.pem';
const DOCKER_NETWORK_NAME = 'icbc-collectible-network';

const PEER_CONFIG = {
    ICBC: {
        container: 'peer0.icbc.com',
        mspId: 'ICBCMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.icbc.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt',
        anchorTx: '/etc/hyperledger/fabric/channel/ICBCMSPanchors.tx'
    },
    BrandA: {
        container: 'peer0.branda.com',
        mspId: 'BrandAMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.branda.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt',
        anchorTx: '/etc/hyperledger/fabric/channel/BrandAMSPanchors.tx'
    },
    BrandB: {
        container: 'peer0.brandb.com',
        mspId: 'BrandBMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.brandb.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt',
        anchorTx: '/etc/hyperledger/fabric/channel/BrandBMSPanchors.tx'
    }
};

const JOIN_PEERS = [
    {
        container: 'peer0.icbc.com',
        mspId: 'ICBCMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.icbc.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt'
    },
    {
        container: 'peer1.icbc.com',
        mspId: 'ICBCMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer1.icbc.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt'
    },
    {
        container: 'peer0.branda.com',
        mspId: 'BrandAMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.branda.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt'
    },
    {
        container: 'peer0.brandb.com',
        mspId: 'BrandBMSP',
        mspPath: '/etc/hyperledger/fabric/admin/msp',
        address: 'peer0.brandb.com:7051',
        tlsRootCert: '/etc/hyperledger/fabric/tls/ca.crt'
    }
];

function sleep(ms) {
    const arr = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(arr, 0, 0, ms);
}

function runPeerCommand(container, peerOptions, command) {
    const envArgs = [
        `-e CORE_PEER_LOCALMSPID=${peerOptions.mspId}`,
        `-e CORE_PEER_MSPCONFIGPATH=${peerOptions.mspPath}`,
        `-e CORE_PEER_ADDRESS=${peerOptions.address}`,
        '-e CORE_PEER_TLS_ENABLED=true',
        `-e CORE_PEER_TLS_ROOTCERT_FILE=${peerOptions.tlsRootCert}`
    ];

    const dockerCommand = `docker exec ${envArgs.join(' ')} ${container} /bin/sh -c "${command}"`;
    execSync(dockerCommand, { stdio: 'inherit' });
}

function recreateDockerNetwork() {
    console.log(`重新创建 Docker 网络 ${DOCKER_NETWORK_NAME}...`);
    try {
        execSync(`docker network rm ${DOCKER_NETWORK_NAME}`, { stdio: 'pipe' });
    } catch (error) {
        const message = error?.stderr?.toString?.() || '';
        if (message && message.includes('No such network')) {
            // 忽略不存在的网络
        } else if (message && message.includes('has active endpoints')) {
            console.warn(`网络 ${DOCKER_NETWORK_NAME} 存在活动容器，请先执行 docker-compose -f docker-compose.yaml down`);
            throw new Error('Docker 网络仍在使用，无法重新创建');
        } else if (error && error.status) {
            console.warn(`删除网络 ${DOCKER_NETWORK_NAME} 时出现警告: ${message || error.message}`);
        }
    }

    execSync(`docker network create --driver bridge ${DOCKER_NETWORK_NAME}`, { stdio: 'inherit' });
    console.log(`Docker 网络 ${DOCKER_NETWORK_NAME} 已创建`);
}

function ensureDockerNetwork() {
    try {
        const inspectOutput = execSync(`docker network inspect ${DOCKER_NETWORK_NAME}`, { encoding: 'utf8' });
        const info = JSON.parse(inspectOutput)[0];
        const driver = info?.Driver || 'unknown';
        const ipamConfig = info?.IPAM?.Config || [];
        const hasSubnet = ipamConfig.some((cfg) => cfg.Subnet);

        if (!hasSubnet) {
            console.warn(`检测到 Docker 网络 ${DOCKER_NETWORK_NAME} 缺少 IPAM 配置 (driver: ${driver})`);
            recreateDockerNetwork();
        } else {
            console.log(`Docker 网络 ${DOCKER_NETWORK_NAME} 已存在 (driver: ${driver})`);
        }
    } catch (error) {
        console.warn(`检查 Docker 网络 ${DOCKER_NETWORK_NAME} 失败，将尝试创建新网络: ${error.message}`);
        recreateDockerNetwork();
    }
}

function getContainerEndpoint(containerName, port, retries = 5, delayMs = 2000) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const inspectOutput = execSync(`docker inspect ${containerName}`, {
                encoding: 'utf8'
            });
            const info = JSON.parse(inspectOutput)[0];
            const networks = info?.NetworkSettings?.Networks || {};

            let ip = null;
            if (networks[DOCKER_NETWORK_NAME]?.IPAddress) {
                ip = networks[DOCKER_NETWORK_NAME].IPAddress;
            } else {
                const firstNetwork = Object.values(networks)[0];
                if (firstNetwork?.IPAddress) {
                    ip = firstNetwork.IPAddress;
                    console.warn(
                        `${containerName} 不在指定网络 ${DOCKER_NETWORK_NAME}，将使用首个网络 IP: ${ip}`
                    );
                }
            }

            if (ip) {
                const endpoint = `${ip}:${port}`;
                console.log(`已获取 ${containerName} 地址: ${endpoint}`);
                return endpoint;
            }

            console.warn(`未能从 docker inspect 获取 ${containerName} 的 IP 信息`);
        } catch (error) {
            console.warn(`第 ${attempt + 1} 次获取容器 ${containerName} IP 失败: ${error.message}`);
        }

        if (attempt < retries - 1) {
            sleep(delayMs);
        }
    }

    console.warn(`多次尝试后仍无法获取 ${containerName} IP，使用容器名称作为地址`);
    return `${containerName}:${port}`;
}

function createDirectories() {
    if (!fs.existsSync(CRYPTO_CONFIG_PATH)) {
        fs.mkdirSync(CRYPTO_CONFIG_PATH, { recursive: true });
        console.log(`创建目录: ${CRYPTO_CONFIG_PATH}`);
    }

    if (!fs.existsSync(CHANNEL_ARTIFACTS_PATH)) {
        fs.mkdirSync(CHANNEL_ARTIFACTS_PATH, { recursive: true });
        console.log(`创建目录: ${CHANNEL_ARTIFACTS_PATH}`);
    }
}

function generateCryptoMaterial() {
    console.log('开始生成加密材料...');

    try {
        const cryptogenPath = path.join(FABRIC_BIN_PATH, 'cryptogen');
        execSync(`${cryptogenPath} generate --config=./crypto-config.yaml`, {
            cwd: FABRIC_SCRIPTS_PATH,
            stdio: 'inherit'
        });
        console.log('加密材料生成成功');
    } catch (error) {
        console.error('生成加密材料失败:', error);
        process.exit(1);
    }
}

function normalizeCryptoConfigPaths() {
    console.log('规范化 MSP 配置文件中的路径分隔符...');

    const configFiles = [];

    function collectConfigFiles(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach((entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                collectConfigFiles(fullPath);
            } else if (entry.isFile() && entry.name === 'config.yaml') {
                configFiles.push(fullPath);
            }
        });
    }

    collectConfigFiles(CRYPTO_CONFIG_PATH);

    configFiles.forEach((filePath) => {
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const normalizedContent = originalContent.replace(/\\/g, '/');

        if (normalizedContent !== originalContent) {
            fs.writeFileSync(filePath, normalizedContent);
            console.log(`已修正路径: ${filePath}`);
        }
    });

    console.log('MSP 配置文件路径规范化完成');
}

function generateGenesisBlock() {
    console.log('开始生成创世区块...');

    try {
        const configtxgenPath = path.join(FABRIC_BIN_PATH, 'configtxgen');
        const env = { ...process.env, FABRIC_CFG_PATH: FABRIC_SCRIPTS_PATH };

        execSync(
            `${configtxgenPath} -profile OneOrgOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block`,
            {
                cwd: FABRIC_SCRIPTS_PATH,
                env,
                stdio: 'inherit'
            }
        );
        console.log('创世区块生成成功');
    } catch (error) {
        console.error('生成创世区块失败:', error);
        process.exit(1);
    }
}

function generateChannelTransaction() {
    console.log('开始生成通道配置交易...');

    try {
        const configtxgenPath = path.join(FABRIC_BIN_PATH, 'configtxgen');
        const env = { ...process.env, FABRIC_CFG_PATH: FABRIC_SCRIPTS_PATH };

        execSync(
            `${configtxgenPath} -profile OneOrgChannel -outputCreateChannelTx ./channel-artifacts/channel.tx -channelID ${CHANNEL_NAME}`,
            {
                cwd: FABRIC_SCRIPTS_PATH,
                env,
                stdio: 'inherit'
            }
        );
        console.log('通道配置交易生成成功');
    } catch (error) {
        console.error('生成通道配置交易失败:', error);
        process.exit(1);
    }
}

function generateAnchorPeerTransactions() {
    console.log('开始生成锚节点更新交易...');

    try {
        const configtxgenPath = path.join(FABRIC_BIN_PATH, 'configtxgen');
        const env = { ...process.env, FABRIC_CFG_PATH: FABRIC_SCRIPTS_PATH };

        Object.values(PEER_CONFIG).forEach((config) => {
            execSync(
                `${configtxgenPath} -profile OneOrgChannel -outputAnchorPeersUpdate ./channel-artifacts/${config.mspId}anchors.tx -channelID ${CHANNEL_NAME} -asOrg ${config.mspId}`,
                {
                    cwd: FABRIC_SCRIPTS_PATH,
                    env,
                    stdio: 'inherit'
                }
            );
        });

        console.log('锚节点更新交易生成成功');
    } catch (error) {
        console.error('生成锚节点更新交易失败:', error);
        process.exit(1);
    }
}

function startDockerContainers() {
    console.log('开始启动 Docker 容器...');

    try {
        execSync('docker-compose -f docker-compose.yaml up -d', {
            cwd: FABRIC_SCRIPTS_PATH,
            stdio: 'inherit'
        });
        console.log('Docker 容器启动成功');
    } catch (error) {
        console.error('启动 Docker 容器失败:', error);
        process.exit(1);
    }
}

function waitForNetworkStart() {
    return new Promise((resolve) => {
        console.log('等待网络启动完成...');
        setTimeout(resolve, 10000);
    });
}

function createChannel(ordererEndpoint) {
    const blockPath = path.resolve(CHANNEL_ARTIFACTS_PATH, `${CHANNEL_NAME}.block`);
    if (fs.existsSync(blockPath)) {
        console.log(`通道区块已存在，跳过创建: ${blockPath}`);
        return;
    }

    console.log('创建 Fabric 通道...');
    runPeerCommand(
        PEER_CONFIG.ICBC.container,
        PEER_CONFIG.ICBC,
        `peer channel create -o ${ordererEndpoint} --ordererTLSHostnameOverride orderer.icbc.com -c ${CHANNEL_NAME} -f /etc/hyperledger/fabric/channel/channel.tx --outputBlock /etc/hyperledger/fabric/channel/${CHANNEL_NAME}.block --tls true --cafile ${ORDERER_CA_PATH}`
    );
    console.log('通道创建成功');
}

function joinPeersToChannel(ordererEndpoint) {
    console.log('让对等节点加入通道...');
    JOIN_PEERS.forEach((peerConfig) => {
        try {
            runPeerCommand(
                peerConfig.container,
                peerConfig,
                `peer channel join -o ${ordererEndpoint} --ordererTLSHostnameOverride orderer.icbc.com -b /etc/hyperledger/fabric/channel/${CHANNEL_NAME}.block --tls true --cafile ${ORDERER_CA_PATH}`
            );
            console.log(`${peerConfig.container} 已加入通道`);
        } catch (error) {
            const message = error?.stderr?.toString?.() || '';
            if (message.includes('LedgerID already exists') || message.includes('exists')) {
                console.log(`${peerConfig.container} 已在通道中，跳过`);
            } else {
                throw error;
            }
        }
    });
}

function updateAnchorPeers(ordererEndpoint) {
    console.log('更新各组织的锚节点...');
    Object.values(PEER_CONFIG).forEach((config) => {
        try {
            runPeerCommand(
                config.container,
                config,
                `peer channel update -o ${ordererEndpoint} --ordererTLSHostnameOverride orderer.icbc.com -c ${CHANNEL_NAME} -f ${config.anchorTx} --tls true --cafile ${ORDERER_CA_PATH}`
            );
            console.log(`${config.container} 锚节点更新成功`);
        } catch (error) {
            const message = error?.stderr?.toString?.() || '';
            if (message.includes('BAD_REQUEST') || message.includes('exists')) {
                console.log(`${config.container} 锚节点已更新，跳过`);
            } else {
                throw error;
            }
        }
    });
}

function createConnectionProfile() {
    console.log('创建连接配置文件...');

    const peerEntries = {
        'peer0.icbc.com': {
            url: 'grpcs://localhost:7051',
            tlsCACerts: {
                path: path.resolve(CRYPTO_CONFIG_PATH, 'peerOrganizations/icbc.com/peers/peer0.icbc.com/tls/ca.crt')
            },
            grpcOptions: {
                'ssl-target-name-override': 'peer0.icbc.com',
                hostnameOverride: 'peer0.icbc.com'
            }
        },
        'peer0.branda.com': {
            url: 'grpcs://localhost:9051',
            tlsCACerts: {
                path: path.resolve(CRYPTO_CONFIG_PATH, 'peerOrganizations/branda.com/peers/peer0.branda.com/tls/ca.crt')
            },
            grpcOptions: {
                'ssl-target-name-override': 'peer0.branda.com',
                hostnameOverride: 'peer0.branda.com'
            }
        },
        'peer0.brandb.com': {
            url: 'grpcs://localhost:10051',
            tlsCACerts: {
                path: path.resolve(CRYPTO_CONFIG_PATH, 'peerOrganizations/brandb.com/peers/peer0.brandb.com/tls/ca.crt')
            },
            grpcOptions: {
                'ssl-target-name-override': 'peer0.brandb.com',
                hostnameOverride: 'peer0.brandb.com'
            }
        }
    };

    const connectionProfile = {
        name: 'ICBCCollectibleNetwork',
        version: '1.0.0',
        client: {
            organization: 'ICBC',
            connection: {
                timeout: {
                    peer: {
                        endorser: '300'
                    }
                }
            }
        },
        channels: {
            [CHANNEL_NAME]: {
                orderers: ['orderer.icbc.com'],
                peers: {
                    'peer0.icbc.com': {},
                    'peer0.branda.com': {},
                    'peer0.brandb.com': {}
                }
            }
        },
        organizations: {
            ICBC: {
                mspid: 'ICBCMSP',
                peers: Object.keys(peerEntries),
                certificateAuthorities: ['ca.icbc.com']
            }
        },
        orderers: {
            'orderer.icbc.com': {
                url: 'grpcs://localhost:7050',
                tlsCACerts: {
                    path: path.resolve(CRYPTO_CONFIG_PATH, 'ordererOrganizations/icbc.com/orderers/orderer.icbc.com/msp/tlscacerts/tlsca.icbc.com-cert.pem')
                },
                grpcOptions: {
                    'ssl-target-name-override': 'orderer.icbc.com',
                    hostnameOverride: 'orderer.icbc.com'
                }
            }
        },
        peers: peerEntries,
        certificateAuthorities: {
            'ca.icbc.com': {
                url: 'https://localhost:7054',
                caName: 'ca.icbc.com',
                tlsCACerts: {
                    path: path.resolve(CRYPTO_CONFIG_PATH, 'peerOrganizations/icbc.com/ca/ca.icbc.com-cert.pem')
                },
                httpOptions: {
                    verify: false
                }
            }
        }
    };

    const connectionProfilePath = path.resolve(FABRIC_SCRIPTS_PATH, 'connection-profile.json');
    fs.writeFileSync(connectionProfilePath, JSON.stringify(connectionProfile, null, 2));
    console.log(`连接配置文件已保存到: ${connectionProfilePath}`);
}

async function main() {
    try {
        console.log('==================== 开始启动区块链网络 ====================');

        createDirectories();
        generateCryptoMaterial();
    normalizeCryptoConfigPaths();
        generateGenesisBlock();
        generateChannelTransaction();
        generateAnchorPeerTransactions();

        ensureDockerNetwork();
        startDockerContainers();
        await waitForNetworkStart();

        const ordererEndpoint = getContainerEndpoint(ORDERER_CONTAINER, 7050);
        createChannel(ordererEndpoint);
        joinPeersToChannel(ordererEndpoint);
        updateAnchorPeers(ordererEndpoint);

        createConnectionProfile();

        console.log('==================== 区块链网络启动成功 ====================');
        console.log('网络状态: 已启动');
        console.log(`通道名称: ${CHANNEL_NAME}`);
        console.log('下一步: 使用 npm run deploy 部署智能合约');
    } catch (error) {
        console.error('启动区块链网络失败:', error);
        process.exit(1);
    }
}

main();