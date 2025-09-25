// 停止区块链网络脚本

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置常量
const FABRIC_SCRIPTS_PATH = path.resolve(__dirname, '..', 'network');
const CRYPTO_CONFIG_PATH = path.resolve(__dirname, '..', 'network', 'crypto-config');
const CHANNEL_ARTIFACTS_PATH = path.resolve(__dirname, '..', 'network', 'channel-artifacts');
const COMPOSE_FILE = path.resolve(__dirname, '..', 'network', 'docker-compose.yaml');
const WALLET_PATH = path.resolve(__dirname, '..', 'wallet');

// 停止并删除 Docker 容器
function stopDockerContainers() {
    console.log('开始停止并删除 Docker 容器...');
    
    try {
        // 停止并删除所有相关容器
        execSync('docker-compose -f docker-compose.yaml down', {
            cwd: FABRIC_SCRIPTS_PATH,
            stdio: 'inherit'
        });
        console.log('Docker 容器已停止并删除');
    } catch (error) {
        console.error('停止 Docker 容器失败:', error);
        // 继续执行清理操作
    }
}

// 删除未标记的 Docker 容器
function removeUnlabeledContainers() {
    try {
        console.log('删除未标记的相关 Docker 容器...');
        
        // 获取并删除所有与 fabric 相关的容器
        const containers = execSync('docker ps -aq --filter "name=dev-"').toString().trim();
        if (containers) {
            execSync(`docker rm -f ${containers}`, {
                stdio: 'inherit'
            });
            console.log('未标记的容器已删除');
        } else {
            console.log('没有找到需要删除的未标记容器');
        }
    } catch (error) {
        console.error('删除未标记容器失败:', error);
        // 继续执行清理操作
    }
}

// 删除网络相关的卷
function removeNetworkVolumes() {
    try {
        console.log('删除网络相关的 Docker 卷...');
        
        // 获取并删除所有与 fabric 相关的卷
        const volumes = execSync('docker volume ls -q --filter "name=dev-"').toString().trim();
        if (volumes) {
            execSync(`docker volume rm ${volumes}`, {
                stdio: 'inherit'
            });
            console.log('网络卷已删除');
        } else {
            console.log('没有找到需要删除的网络卷');
        }
    } catch (error) {
        console.error('删除网络卷失败:', error);
        // 继续执行清理操作
    }
}

// 清理生成的文件
function cleanupGeneratedFiles() {
    console.log('开始清理生成的文件...');
    
    try {
        // 删除加密材料
        if (fs.existsSync(CRYPTO_CONFIG_PATH)) {
            execSync(`rm -rf ${CRYPTO_CONFIG_PATH}`, {
                stdio: 'inherit'
            });
            console.log('加密材料已删除');
        }
        
        // 删除通道工件
        if (fs.existsSync(CHANNEL_ARTIFACTS_PATH)) {
            execSync(`rm -rf ${CHANNEL_ARTIFACTS_PATH}`, {
                stdio: 'inherit'
            });
            console.log('通道工件已删除');
        }
        
        // 删除钱包文件
        if (fs.existsSync(WALLET_PATH)) {
            execSync(`rm -rf ${WALLET_PATH}`, {
                stdio: 'inherit'
            });
            console.log('钱包文件已删除');
        }
        
        // 删除连接配置文件
        const connectionProfilePath = path.resolve(__dirname, '..', 'network', 'connection-profile.json');
        if (fs.existsSync(connectionProfilePath)) {
            fs.unlinkSync(connectionProfilePath);
            console.log('连接配置文件已删除');
        }
        
    } catch (error) {
        console.error('清理文件失败:', error);
        // 继续执行
    }
}

// 检查网络状态
function checkNetworkStatus() {
    try {
        console.log('检查网络状态...');
        
        const containers = execSync('docker ps --filter "name=dev-"').toString().trim();
        if (containers.includes('No such container')) {
            console.log('所有相关容器已停止');
        } else {
            console.log('以下容器仍在运行:');
            console.log(containers);
        }
    } catch (error) {
        console.error('检查网络状态失败:', error);
    }
}

// 主函数
function main() {
    try {
        console.log('==================== 开始停止区块链网络 ====================');
        
        // 停止并删除 Docker 容器
        stopDockerContainers();
        
        // 删除未标记的 Docker 容器
        removeUnlabeledContainers();
        
        // 删除网络相关的卷
        removeNetworkVolumes();
        
        // 清理生成的文件
        cleanupGeneratedFiles();
        
        // 检查网络状态
        checkNetworkStatus();
        
        console.log('==================== 区块链网络已停止并清理完毕 ====================');
    } catch (error) {
        console.error('停止区块链网络过程中发生错误:', error);
        process.exit(1);
    }
}

// 运行主函数
main();