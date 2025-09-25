// 修复 MSP 配置文件中的路径分隔符

const fs = require('fs');
const path = require('path');

const FABRIC_SCRIPTS_PATH = path.resolve(__dirname, '..', 'network');
const CRYPTO_CONFIG_PATH = path.resolve(FABRIC_SCRIPTS_PATH, 'crypto-config');

function collectConfigFiles(dir, result) {
    if (!fs.existsSync(dir)) {
        return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectConfigFiles(fullPath, result);
        } else if (entry.isFile() && entry.name === 'config.yaml') {
            result.push(fullPath);
        }
    });
}

function normalizeCryptoConfigPaths() {
    console.log('开始修复 MSP 配置文件路径...');

    const configFiles = [];
    collectConfigFiles(CRYPTO_CONFIG_PATH, configFiles);

    configFiles.forEach((filePath) => {
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const normalizedContent = originalContent.replace(/\\/g, '/');

        if (normalizedContent !== originalContent) {
            fs.writeFileSync(filePath, normalizedContent);
            console.log(`已修正路径: ${filePath}`);
        }
    });

    console.log('MSP 配置文件路径修复完成');
}

normalizeCryptoConfigPaths();
