// API配置文件 - 自动检测环境
// 本文件会根据当前域名自动选择正确的API地址

const API_CONFIG = (() => {
    const currentHost = window.location.hostname;
    
    // 如果是本地开发环境
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        return {
            baseUrl: 'http://localhost:8787',
            environment: 'development'
        };
    }
    
    // 如果是GitHub Pages
    if (currentHost.includes('github.io')) {
        return {
            baseUrl: 'https://navigation-worker.wedsfew.workers.dev',
            environment: 'github-pages'
        };
    }
    
    // 如果是Cloudflare Pages
    if (currentHost.includes('pages.dev') || currentHost.includes('cloudflare')) {
        // 自动构建Worker URL - 基于当前域名
        const subdomain = currentHost.split('.')[0];
        return {
            baseUrl: `https://navigation-worker.${subdomain}.workers.dev`,
            environment: 'cloudflare-pages'
        };
    }
    
    // 自定义域名 - 默认使用通用Worker地址
    return {
        baseUrl: 'https://navigation-worker.wedsfew.workers.dev',
        environment: 'custom-domain'
    };
})();

// 导出配置供script.js使用
window.API_CONFIG = API_CONFIG;

// 调试信息（仅在开发环境显示）
if (API_CONFIG.environment === 'development') {
    console.log('🔧 API配置:', API_CONFIG);
} 