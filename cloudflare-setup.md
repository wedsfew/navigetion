# 🚀 Cloudflare 一键部署指南

## 第一步：部署 Worker

1. 访问 [Cloudflare Workers](https://workers.cloudflare.com/)
2. 点击 **"Create a Service"**
3. 选择 **"HTTP handler"** 模板
4. 删除默认代码，复制粘贴 `worker.js` 的全部内容
5. 点击 **"Save and Deploy"**

## 第二步：创建 KV 存储

1. 在Worker页面，点击 **"Settings"** → **"Variables"**
2. 点击 **"KV Namespace Bindings"** → **"Add binding"**
3. 填写：
   - Variable name: `NAVIGATION_KV`
   - KV namespace: 点击 **"Create a new namespace"**，名称填 `navigation-data`
4. 点击 **"Save"**

## 第三步：部署前端

1. 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
2. 点击 **"Create a project"**
3. 选择 **"Connect to Git"** 并连接此仓库
4. 部署设置：
   - Build command: 留空
   - Build output directory: `/`
5. 点击 **"Save and Deploy"**

## 第四步：配置 API

1. 复制Worker的URL（格式：`https://xxx.xxx.workers.dev`）
2. 编辑仓库中的 `config.js` 文件
3. 将 `production.baseUrl` 替换为您的Worker URL
4. 提交更改，Pages会自动重新部署

## 🎉 完成！

访问您的Pages网站，点击"管理员登录"→"设置管理员密码"开始使用。

---
💡 **提示**：如果遇到问题，检查浏览器控制台的错误信息。 