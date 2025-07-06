// API配置文件
const API_CONFIG = {
    // 开发环境 - 本地Cloudflare Worker
    development: {
        baseUrl: 'http://localhost:8787'
    },
    
    // 生产环境 - Cloudflare Worker URL
    // 🔧 部署Worker后，请将下面的URL替换为您的实际Worker地址
    // 格式：https://your-worker-name.your-subdomain.workers.dev
    production: {
        baseUrl: 'https://project.goxi.top'
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
