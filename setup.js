#!/usr/bin/env node

/**
 * 自动化设置脚本
 * 用于创建Cloudflare KV命名空间并更新wrangler.toml配置
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始设置Cloudflare Workers项目...\n');

// 检查是否安装了wrangler
try {
    execSync('wrangler --version', { stdio: 'pipe' });
    console.log('✅ Wrangler CLI已安装');
} catch (error) {
    console.error('❌ 请先安装Wrangler CLI: npm install -g wrangler');
    process.exit(1);
}

// 检查是否已登录
try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('✅ 已登录Cloudflare账户');
} catch (error) {
    console.error('❌ 请先登录Cloudflare: wrangler auth login');
    process.exit(1);
}

console.log('\n📦 创建KV命名空间...');

try {
    // 创建生产环境KV命名空间
    console.log('创建生产环境KV命名空间...');
    const prodResult = execSync('wrangler kv:namespace create NAVIGATION_KV', { encoding: 'utf8' });
    const prodMatch = prodResult.match(/id = "([^"]+)"/);
    const prodId = prodMatch ? prodMatch[1] : '';
    
    // 创建预览环境KV命名空间
    console.log('创建预览环境KV命名空间...');
    const previewResult = execSync('wrangler kv:namespace create NAVIGATION_KV --preview', { encoding: 'utf8' });
    const previewMatch = previewResult.match(/id = "([^"]+)"/);
    const previewId = previewMatch ? previewMatch[1] : '';
    
    if (!prodId || !previewId) {
        throw new Error('无法获取KV命名空间ID');
    }
    
    console.log(`✅ 生产环境KV ID: ${prodId}`);
    console.log(`✅ 预览环境KV ID: ${previewId}`);
    
    // 更新wrangler.toml文件
    console.log('\n📝 更新wrangler.toml配置...');
    const wranglerPath = path.join(__dirname, 'wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    // 替换KV命名空间ID
    wranglerContent = wranglerContent.replace(
        /id = ""/,
        `id = "${prodId}"`
    );
    wranglerContent = wranglerContent.replace(
        /preview_id = ""/,
        `preview_id = "${previewId}"`
    );
    
    fs.writeFileSync(wranglerPath, wranglerContent);
    console.log('✅ wrangler.toml已更新');
    
} catch (error) {
    console.error('❌ 创建KV命名空间失败:', error.message);
    process.exit(1);
}

console.log('\n🔧 设置完成！下一步操作:');
console.log('1. 部署Worker: npm run deploy');
console.log('2. 记录Worker URL (例如: https://navigation-worker.your-name.workers.dev)');
console.log('3. 更新config.js中的baseUrl (如果需要)');
console.log('4. 部署前端到Cloudflare Pages');
console.log('\n或者使用一键部署: npm run deploy-pages\n');

console.log('📖 详细部署说明请查看 DEPLOYMENT.md 文件');
console.log('🎉 享受您的导航网站！'); 