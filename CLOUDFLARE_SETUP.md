# 🚀 Cloudflare 一键部署指南

只需要3个步骤，就能在Cloudflare上部署您的导航网站！

## 📋 准备工作

确保您有Cloudflare账户（免费即可）

## 🔥 方式一：最简单部署（推荐）

### 步骤1: 部署前端到 Pages
1. 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
2. 点击 **"Connect to Git"**
3. 选择您的GitHub仓库 `navigetion`
4. 配置设置：
   - **Project name**: `navigation-website`
   - **Production branch**: `main`
   - **Build command**: 留空
   - **Build output directory**: `/`
5. 点击 **"Save and Deploy"**

### 步骤2: 部署后端 Worker
1. 访问 [Cloudflare Workers](https://workers.cloudflare.com/)
2. 点击 **"Create a Service"**
3. 输入服务名: `navigation-worker`
4. 点击 **"Create Service"**
5. 在代码编辑器中，删除所有内容
6. 复制粘贴项目中的 `worker.js` 文件内容
7. 点击 **"Save and Deploy"**

### 步骤3: 创建 KV 存储
1. 在Worker页面，点击 **"Settings"** → **"Variables"**
2. 滚动到 **"KV Namespace Bindings"**
3. 点击 **"Add binding"**
4. 填写：
   - **Variable name**: `NAVIGATION_KV`
   - **KV namespace**: 点击 **"Create a new namespace"**
   - **Namespace name**: `NAVIGATION_KV`
5. 点击 **"Save"**

## ✅ 完成！

现在访问您的Pages URL，就可以使用导航网站了！

- **前端地址**: `https://navigation-website.pages.dev`
- **后端地址**: `https://navigation-worker.your-subdomain.workers.dev`

## 🔧 方式二：命令行部署（高级用户）

如果您熟悉命令行：

```bash
# 1. 安装Wrangler CLI
npm install -g wrangler

# 2. 登录Cloudflare
wrangler auth login

# 3. 自动设置（会创建KV并部署）
npm run setup
npm run deploy

# 4. 部署前端
npm run deploy-pages
```

## 🎯 首次使用

1. 访问部署好的网站
2. 点击 **"管理员登录"**
3. 点击 **"设置管理员密码"**
4. 创建用户名和密码
5. 开始管理您的项目！

## ❓ 常见问题

**Q: Worker部署后API调用失败？**
A: 检查config.js中的baseUrl是否正确，应该是您的Worker地址

**Q: 无法创建管理员账户？**
A: 确保KV存储已正确绑定到Worker

**Q: 想要自定义域名？**
A: 在Pages设置中添加自定义域名即可

## 🆘 需要帮助？

如果遇到问题，请：
1. 查看 [详细部署文档](DEPLOYMENT.md)
2. 在GitHub仓库提交Issue
3. 检查Cloudflare Workers日志

---

🎉 **恭喜！您的项目导航网站已经部署完成！** 