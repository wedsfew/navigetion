# 📋 项目导航网站

一个现代化的个人项目导航网站，帮助您轻松管理和展示您的项目链接。

## 🌟 功能特色

- **项目管理**: 添加、编辑、删除项目链接
- **智能搜索**: 通过项目名称、描述或标签快速查找项目
- **分类过滤**: 按项目类型（网站、移动端、桌面端、其他）筛选
- **标签系统**: 为项目添加标签，便于分类和搜索
- **用户管理**: 管理员登录系统，支持用户名密码认证
- **权限控制**: 只有管理员可以添加、编辑、删除项目
- **云端存储**: 使用Cloudflare KV存储，数据安全可靠
- **响应式设计**: 完美适配手机、平板和桌面设备
- **现代UI**: 毛玻璃效果、流畅动画和美观界面

## 🚀 快速开始

### Cloudflare 一键部署

🔥 **超简单部署方式**：查看 [cloudflare-setup.md](cloudflare-setup.md) 获取详细的中文界面部署教程

**快速步骤**：
1. **Worker**：创建Worker → 粘贴`worker.js`代码 → 添加KV绑定
2. **前端**：Pages连接仓库 → 自动部署
3. **配置**：更新`config.js`中的Worker URL
4. **完成**：设置管理员账户开始使用

## 🎯 使用方法

### 首次设置管理员
1. 访问网站，点击"管理员登录"
2. 点击"设置管理员密码"
3. 填写管理员用户名和密码（密码至少6位）
4. 设置完成后即可登录管理

### 管理员登录
1. 点击"管理员登录"按钮
2. 输入用户名和密码
3. 登录成功后可进行项目管理

### 添加项目
1. 管理员登录后，点击"添加项目"按钮
2. 填写项目信息：
   - 项目名称（必填）
   - 项目链接（必填）
   - 项目描述
   - 项目类别
   - 标签（用逗号分隔）
3. 点击"保存"按钮

### 管理项目
- **搜索**: 在搜索框中输入关键词查找项目
- **过滤**: 点击分类按钮筛选特定类型的项目
- **编辑**: 点击项目卡片上的编辑按钮（需要管理员权限）
- **删除**: 点击删除按钮，确认后删除项目（需要管理员权限）
- **访问**: 点击"访问项目"链接直接打开项目
- **登出**: 点击右上角的"登出"按钮退出管理员账户

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Cloudflare Workers
- **存储**: Cloudflare KV 存储
- **认证**: JWT Token
- **图标**: Font Awesome
- **设计**: 响应式设计，毛玻璃效果
- **部署**: Cloudflare Pages + Workers

## 📁 文件结构

```
navigetion/
├── index.html          # 主页面
├── styles.css          # 样式文件  
├── script.js           # 前端功能脚本
├── config.js           # API配置文件 (需要更新Worker URL)
├── worker.js           # Cloudflare Worker后端API
├── wrangler.toml       # Worker配置文件
├── cloudflare-setup.md # 🔥 中文界面部署教程
└── README.md           # 项目说明
```

## 📱 截图预览

项目包含以下界面：
- 主页面 - 项目展示网格
- 搜索和过滤功能
- 添加/编辑项目模态框
- 响应式移动端界面

## 🔒 安全特性

- **JWT认证**: 使用JSON Web Token进行安全的身份验证
- **密码加密**: 管理员密码使用SHA-256哈希存储
- **会话管理**: Token有效期24小时，自动过期保护
- **权限控制**: 严格的前后端权限验证
- **CORS保护**: 配置了适当的跨域请求策略
- **HTTPS加密**: 生产环境强制使用HTTPS

## 🌐 在线演示

访问 [GitHub Pages](https://wedsfew.github.io/navigetion) 查看在线演示。

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 这个项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👨‍💻 作者

- **wedsfew** - [GitHub](https://github.com/wedsfew)

## 🙏 致谢

- [Font Awesome](https://fontawesome.com/) - 图标库
- [MDN Web Docs](https://developer.mozilla.org/) - 技术文档

---

⭐ 如果这个项目对您有帮助，请给它一个星星！