// API配置文件
// 复制此文件为 config.js 并修改相应的URL

const API_CONFIG = {
    // 开发环境 - 本地Cloudflare Worker
    development: {
        baseUrl: 'http://localhost:8787'
    },
    
    // 生产环境 - 实际的Cloudflare Worker URL
    production: {
        baseUrl: 'https://navigation-worker.your-subdomain.workers.dev'
    }
};

// 根据当前环境自动选择配置
const getApiConfig = () => {
    const isDevelopment = window.location.origin.includes('localhost') || 
                         window.location.origin.includes('127.0.0.1');
    
    return isDevelopment ? API_CONFIG.development : API_CONFIG.production;
};

// 导出配置
window.API_CONFIG = getApiConfig(); 