# Cloudflare 部署指南

本项目使用 Cloudflare Pages 部署前端，使用 Cloudflare Workers 和 KV 存储处理后端API。

## 📋 准备工作

1. 拥有 Cloudflare 账户
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
3. 配置 Wrangler 登录：`wrangler auth login`

## 🗄️ 步骤 1: 创建 KV 命名空间

```bash
# 创建生产环境KV命名空间
wrangler kv:namespace create "NAVIGATION_KV"

# 创建预览环境KV命名空间（用于开发测试）
wrangler kv:namespace create "NAVIGATION_KV" --preview
```

命令执行后会返回命名空间ID，例如：
```
{ binding = "NAVIGATION_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

## ⚙️ 步骤 2: 配置 wrangler.toml

将上一步获得的KV命名空间ID填入 `wrangler.toml` 文件：

```toml
name = "navigation-worker"
main = "worker.js"
compatibility_date = "2023-12-01"

# KV命名空间绑定
[[kv_namespaces]]
binding = "NAVIGATION_KV"
id = "你的生产环境KV命名空间ID"
preview_id = "你的预览环境KV命名空间ID"

# 环境变量
[vars]
ENVIRONMENT = "production"
```

## 🚀 步骤 3: 部署 Worker

```bash
# 部署Worker到Cloudflare
wrangler deploy
```

部署成功后，Worker会运行在：
```
https://navigation-worker.your-subdomain.workers.dev
```

记录这个URL，稍后需要用到。

## 🌐 步骤 4: 配置前端API

1. 复制配置文件：
   ```bash
   cp config.example.js config.js
   ```

2. 编辑 `config.js`，将生产环境的 `baseUrl` 修改为你的Worker URL：
   ```javascript
   production: {
       baseUrl: 'https://navigation-worker.your-subdomain.workers.dev'
   }
   ```

3. 在 `index.html` 中引入配置文件（在script.js之前）：
   ```html
   <script src="config.js"></script>
   <script src="script.js"></script>
   ```

4. 修改 `script.js` 中的API配置：
   ```javascript
   // 将这行：
   this.apiBaseUrl = window.location.origin.includes('localhost') 
       ? 'http://localhost:8787'
       : 'https://navigation-worker.your-subdomain.workers.dev';
   
   // 改为：
   this.apiBaseUrl = window.API_CONFIG?.baseUrl || 
       (window.location.origin.includes('localhost') 
           ? 'http://localhost:8787'
           : 'https://navigation-worker.your-subdomain.workers.dev');
   ```

## 📄 步骤 5: 部署前端到 Cloudflare Pages

### 方法 1: 通过 Git 仓库部署

1. 确保代码已推送到 GitHub
2. 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
3. 点击 "Create a project" → "Connect to Git"
4. 选择你的 GitHub 仓库
5. 配置构建设置：
   - Build command: 留空（静态文件）
   - Build output directory: `/`
6. 点击 "Save and Deploy"

### 方法 2: 直接上传文件

1. 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
2. 点击 "Create a project" → "Upload assets"
3. 上传项目文件：
   - `index.html`
   - `styles.css`
   - `script.js`
   - `config.js`
4. 点击 "Deploy site"

## 🔧 步骤 6: 自定义域名（可选）

1. 在 Cloudflare Pages 项目设置中
2. 前往 "Custom domains"
3. 添加你的域名
4. 配置 DNS 记录

## 🏃‍♂️ 本地开发

### 启动 Worker 开发服务器

```bash
# 在项目根目录运行
wrangler dev --local
```

Worker 将运行在 `http://localhost:8787`

### 启动前端开发服务器

```bash
# 启动HTTP服务器
python3 -m http.server 8000
# 或者
npx http-server
```

前端将运行在 `http://localhost:8000`

## 🔐 首次设置管理员

1. 访问部署后的网站
2. 点击 "管理员登录"
3. 点击 "设置管理员密码"
4. 填写用户名和密码（密码至少6位）
5. 设置完成后即可登录管理

## 📊 数据结构

### KV 存储的数据结构

- `admin`: 管理员信息
  ```json
  {
    "username": "admin",
    "password": "hashed_password",
    "createdAt": "2023-12-01T00:00:00.000Z"
  }
  ```

- `projects`: 项目列表
  ```json
  [
    {
      "id": "project_id",
      "name": "项目名称",
      "url": "https://example.com",
      "description": "项目描述",
      "category": "web",
      "tags": ["tag1", "tag2"],
      "createdAt": "2023-12-01T00:00:00.000Z",
      "updatedAt": "2023-12-01T00:00:00.000Z"
    }
  ]
  ```

## 🔒 安全说明

1. **JWT密钥**: 在生产环境中，建议将Worker中的JWT密钥改为更安全的随机字符串
2. **HTTPS**: 生产环境会自动使用HTTPS
3. **CORS**: Worker已配置了适当的CORS策略
4. **密码加密**: 管理员密码使用SHA-256哈希存储

## 🐛 故障排除

### 常见问题

1. **API请求失败**
   - 检查Worker URL是否正确
   - 确认Worker已成功部署
   - 检查浏览器控制台的错误信息

2. **KV数据读取失败**
   - 确认KV命名空间ID正确
   - 检查Worker绑定配置

3. **CORS错误**
   - 确认Worker已包含CORS处理代码
   - 检查请求的域名是否正确

### 查看日志

```bash
# 查看Worker日志
wrangler tail
```

## 📈 扩展功能

可以考虑添加的功能：

1. **数据备份**: 定期备份KV数据
2. **用户管理**: 支持多个管理员
3. **访问统计**: 记录项目访问次数
4. **分类管理**: 动态管理项目分类
5. **批量导入**: 支持JSON/CSV导入项目

## 💡 性能优化

1. **缓存策略**: 为静态资源设置适当的缓存头
2. **CDN**: 利用Cloudflare的全球CDN
3. **压缩**: 启用Gzip/Brotli压缩
4. **图片优化**: 如果有图片，使用Cloudflare Images

## 📞 技术支持

如果遇到问题，请：

1. 检查 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 查看 [Cloudflare KV 文档](https://developers.cloudflare.com/workers/runtime-apis/kv/)
3. 在项目GitHub仓库提交Issue 