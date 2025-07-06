# 🚀 Cloudflare 一键部署指南（中文界面）

## 第一步：部署 Worker

1. 访问 [Cloudflare Workers](https://workers.cloudflare.com/)
2. 点击 **"创建服务"** 或 **"创建应用程序"**
3. 选择 **"HTTP处理程序"** 模板
4. 删除默认代码，复制粘贴 `worker.js` 的全部内容
5. 点击 **"保存并部署"**

## 第二步：创建 KV 存储

1. 在Worker页面，点击 **"设置"** → **"变量"**
2. 点击 **"KV 命名空间绑定"** → **"添加绑定"**
3. 填写：
   - 变量名称: `NAVIGATION_KV`
   - KV 命名空间: 点击 **"创建新命名空间"**，名称填 `navigation-data`
4. 点击 **"保存"**

## 第三步：部署前端

1. 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
2. 点击 **"创建项目"**
3. 选择 **"连接到 Git"** 并连接此仓库
4. 部署设置：
   - 构建命令: 留空
   - 构建输出目录: `/`
5. 点击 **"保存并部署"**

## 第四步：配置 API

1. 复制Worker的URL（格式：`https://xxx.xxx.workers.dev`）
2. 在GitHub仓库中编辑 `config.js` 文件
3. 将 `production.baseUrl` 替换为您的Worker URL
4. 提交更改，Pages会自动重新部署

## 🎉 完成！

访问您的Pages网站，点击"管理员登录"→"设置管理员密码"开始使用。

---
💡 **中文界面使用提示**：
- 如果找不到对应按钮，可能是界面版本差异，按钮名称基本一致
- 遇到问题时，检查浏览器控制台（F12）的错误信息
- Worker部署后，记得等待1-2分钟再测试API连接 