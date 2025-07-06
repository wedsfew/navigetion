// 项目管理器 - 使用Cloudflare Worker API
class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentEditingId = null;
        this.currentDeleteId = null;
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.isAdmin = false;
        this.adminToken = null;
        this.adminUsername = null;
        
        // API配置 - 在部署时需要更新为实际的Worker URL
        this.apiBaseUrl = window.location.origin.includes('localhost') 
            ? 'http://localhost:8787' // 本地开发时的Worker URL
            : 'https://navigation-worker.your-subdomain.workers.dev'; // 生产环境Worker URL
        
        this.init();
    }

    async init() {
        await this.loadAdminToken();
        await this.loadProjects();
        this.bindEvents();
        this.updateEmptyState();
        this.updateUIForAdminStatus();
    }

    // API调用函数
    async apiCall(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // 如果有token，添加到请求头
        if (this.adminToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.adminToken}`;
        }

        const response = await fetch(url, {
            ...defaultOptions,
            ...options
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: '网络错误' }));
            throw new Error(error.error || '请求失败');
        }

        return await response.json();
    }

    // 加载管理员token
    async loadAdminToken() {
        const token = localStorage.getItem('adminToken');
        const username = localStorage.getItem('adminUsername');
        
        if (token && username) {
            try {
                // 验证token是否有效
                const response = await this.apiCall('/api/auth/verify', {
                    method: 'POST',
                    body: JSON.stringify({ token })
                });
                
                if (response.valid) {
                    this.adminToken = token;
                    this.adminUsername = username;
                    this.isAdmin = true;
                } else {
                    // Token无效，清除本地存储
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUsername');
                }
            } catch (error) {
                console.error('Token验证失败:', error);
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUsername');
            }
        }
    }

    // 保存管理员token
    saveAdminToken(token, username) {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminUsername', username);
        this.adminToken = token;
        this.adminUsername = username;
        this.isAdmin = true;
    }

    // 清除管理员token
    clearAdminToken() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        this.adminToken = null;
        this.adminUsername = null;
        this.isAdmin = false;
    }

    // 加载项目列表
    async loadProjects() {
        try {
            const response = await this.apiCall('/api/projects');
            this.projects = response.projects || [];
            this.renderProjects();
        } catch (error) {
            console.error('加载项目失败:', error);
            this.showMessage('加载项目失败: ' + error.message, 'error');
        }
    }

    // 绑定事件
    bindEvents() {
        // 表单提交
        document.getElementById('projectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProject();
        });

        // 搜索功能
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterAndRenderProjects();
        });

        // 分类过滤
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 更新按钮状态
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // 更新过滤器
                this.currentFilter = e.target.dataset.category;
                this.filterAndRenderProjects();
            });
        });

        // 模态框点击外部关闭
        document.getElementById('projectModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('projectModal')) {
                this.closeModal();
            }
        });

        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('deleteModal')) {
                this.closeDeleteModal();
            }
        });

        document.getElementById('loginModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('loginModal')) {
                this.closeLoginModal();
            }
        });

        document.getElementById('setupModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('setupModal')) {
                this.closeSetupModal();
            }
        });

        // 登录表单提交
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 设置密码表单提交
        document.getElementById('setupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSetupPassword();
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
                this.closeLoginModal();
                this.closeSetupModal();
            }
        });
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 保存项目
    async saveProject() {
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }

        const project = {
            name: document.getElementById('projectName').value.trim(),
            url: document.getElementById('projectUrl').value.trim(),
            description: document.getElementById('projectDescription').value.trim(),
            category: document.getElementById('projectCategory').value,
            tags: document.getElementById('projectTags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
        };

        // 验证必填字段
        if (!project.name || !project.url) {
            this.showMessage('请填写项目名称和链接', 'error');
            return;
        }

        // 验证URL格式
        try {
            new URL(project.url);
        } catch {
            this.showMessage('请输入有效的URL', 'error');
            return;
        }

        try {
            if (this.currentEditingId) {
                // 编辑现有项目
                const response = await this.apiCall(`/api/projects/${this.currentEditingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(project)
                });
                
                // 更新本地项目列表
                const index = this.projects.findIndex(p => p.id === this.currentEditingId);
                if (index !== -1) {
                    this.projects[index] = response.project;
                }
                
                this.showMessage('项目更新成功！');
            } else {
                // 添加新项目
                const response = await this.apiCall('/api/projects', {
                    method: 'POST',
                    body: JSON.stringify(project)
                });
                
                // 添加到本地项目列表
                this.projects.unshift(response.project);
                
                this.showMessage('项目添加成功！');
            }

            this.renderProjects();
            this.closeModal();
            this.updateEmptyState();
            
        } catch (error) {
            console.error('保存项目失败:', error);
            this.showMessage('保存项目失败: ' + error.message, 'error');
        }
    }

    // 删除项目
    async deleteProject(id) {
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }

        try {
            await this.apiCall(`/api/projects/${id}`, {
                method: 'DELETE'
            });
            
            // 从本地列表中移除
            this.projects = this.projects.filter(p => p.id !== id);
            
            this.renderProjects();
            this.updateEmptyState();
            this.showMessage('项目删除成功！');
            
        } catch (error) {
            console.error('删除项目失败:', error);
            this.showMessage('删除项目失败: ' + error.message, 'error');
        }
    }

    // 处理登录
    async handleLogin() {
        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value;
        
        if (!username || !password) {
            this.showMessage('请填写用户名和密码', 'error');
            return;
        }

        try {
            const response = await this.apiCall('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            this.saveAdminToken(response.token, response.username);
            this.updateUIForAdminStatus();
            this.closeLoginModal();
            this.showMessage('管理员登录成功！');
            
        } catch (error) {
            console.error('登录失败:', error);
            if (error.message.includes('管理员账户不存在')) {
                this.showMessage('管理员账户不存在，请先设置', 'error');
                this.openSetupModal();
            } else {
                this.showMessage('登录失败: ' + error.message, 'error');
            }
        }
    }

    // 处理设置密码
    async handleSetupPassword() {
        const username = document.getElementById('setupUsername').value.trim();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username) {
            this.showMessage('请填写管理员用户名', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showMessage('密码长度至少为6位', 'error');
            return;
        }

        try {
            const response = await this.apiCall('/api/auth/setup', {
                method: 'POST',
                body: JSON.stringify({ username, password: newPassword })
            });
            
            this.showMessage('管理员账户创建成功！');
            this.closeSetupModal();
            
            // 自动登录
            setTimeout(() => {
                document.getElementById('adminUsername').value = username;
                document.getElementById('adminPassword').value = newPassword;
                this.openLoginModal();
            }, 1000);
            
        } catch (error) {
            console.error('设置密码失败:', error);
            this.showMessage('设置密码失败: ' + error.message, 'error');
        }
    }

    // 登出
    logout() {
        this.clearAdminToken();
        this.updateUIForAdminStatus();
        this.showMessage('已退出管理员账户');
    }

    // 渲染项目列表
    renderProjects() {
        const container = document.getElementById('projectsGrid');
        container.innerHTML = '';

        const filteredProjects = this.getFilteredProjects();

        filteredProjects.forEach(project => {
            const projectCard = this.createProjectCard(project);
            container.appendChild(projectCard);
        });
    }

    // 过滤和渲染项目
    filterAndRenderProjects() {
        this.renderProjects();
        this.updateEmptyState();
    }

    // 获取过滤后的项目
    getFilteredProjects() {
        let filtered = this.projects;

        // 按分类过滤
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(p => p.category === this.currentFilter);
        }

        // 按搜索词过滤
        if (this.searchTerm) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(this.searchTerm) ||
                p.description.toLowerCase().includes(this.searchTerm) ||
                p.tags.some(tag => tag.toLowerCase().includes(this.searchTerm))
            );
        }

        return filtered;
    }

    // 创建项目卡片
    createProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const actionsHTML = this.isAdmin ? `
            <div class="project-actions">
                <button class="action-btn edit-btn" onclick="projectManager.editProject('${project.id}')" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="projectManager.confirmDelete('${project.id}')" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="project-header">
                <div>
                    <h3 class="project-title">${this.escapeHtml(project.name)}</h3>
                    <span class="project-category">${this.getCategoryName(project.category)}</span>
                </div>
                ${actionsHTML}
            </div>
            <p class="project-description">${this.escapeHtml(project.description)}</p>
            <div class="project-tags">
                ${project.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
            <a href="${project.url}" class="project-link" target="_blank" rel="noopener noreferrer">
                <i class="fas fa-external-link-alt"></i>
                访问项目
            </a>
        `;
        return card;
    }

    // 获取分类名称
    getCategoryName(category) {
        const names = {
            'web': '网站',
            'mobile': '移动端',
            'desktop': '桌面端',
            'other': '其他'
        };
        return names[category] || category;
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 更新空状态显示
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const filteredProjects = this.getFilteredProjects();
        
        if (filteredProjects.length === 0) {
            emptyState.classList.remove('hidden');
            if (this.projects.length === 0) {
                emptyState.innerHTML = `
                    <i class="fas fa-folder-open"></i>
                    <h3>还没有项目</h3>
                    <p>点击"添加项目"按钮来添加您的第一个项目</p>
                `;
            } else {
                emptyState.innerHTML = `
                    <i class="fas fa-search"></i>
                    <h3>没有找到匹配的项目</h3>
                    <p>尝试调整搜索条件或筛选器</p>
                `;
            }
        } else {
            emptyState.classList.add('hidden');
        }
    }

    // 显示消息
    showMessage(message, type = 'success') {
        // 创建消息提示
        const messageEl = document.createElement('div');
        messageEl.className = 'message';
        messageEl.textContent = message;
        
        const bgColor = type === 'error' ? '#f44336' : '#48bb78';
        const shadowColor = type === 'error' ? 'rgba(244, 67, 54, 0.4)' : 'rgba(72, 187, 120, 0.4)';
        
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 4px 20px ${shadowColor};
            z-index: 2000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(messageEl);

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    // 编辑项目
    editProject(id) {
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }

        const project = this.projects.find(p => p.id === id);
        if (!project) return;

        this.currentEditingId = id;

        // 填充表单
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectUrl').value = project.url;
        document.getElementById('projectDescription').value = project.description;
        document.getElementById('projectCategory').value = project.category;
        document.getElementById('projectTags').value = project.tags.join(', ');

        // 更新模态框标题
        document.getElementById('modalTitle').textContent = '编辑项目';

        this.openModal();
    }

    // 确认删除
    confirmDelete(id) {
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }
        
        this.currentDeleteId = id;
        document.getElementById('deleteModal').classList.add('active');
    }

    // 执行删除
    confirmDeleteAction() {
        if (this.currentDeleteId) {
            this.deleteProject(this.currentDeleteId);
            this.currentDeleteId = null;
            this.closeDeleteModal();
        }
    }

    // 更新UI管理员状态
    updateUIForAdminStatus() {
        const loginBtn = document.getElementById('loginBtn');
        const addBtn = document.getElementById('addBtn');
        const adminInfo = document.getElementById('adminInfo');
        const visitorNotice = document.getElementById('visitorNotice');

        if (this.isAdmin) {
            loginBtn.style.display = 'none';
            addBtn.style.display = 'flex';
            adminInfo.style.display = 'flex';
            visitorNotice.style.display = 'none';
            
            // 更新管理员名称显示
            const adminName = adminInfo.querySelector('.admin-name');
            if (adminName) {
                adminName.textContent = `管理员: ${this.adminUsername}`;
            }
        } else {
            loginBtn.style.display = 'flex';
            addBtn.style.display = 'none';
            adminInfo.style.display = 'none';
            visitorNotice.style.display = 'flex';
        }

        // 更新项目卡片的操作按钮
        this.renderProjects();
    }

    // 打开添加模态框
    openModal() {
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }
        document.getElementById('projectModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // 关闭模态框
    closeModal() {
        document.getElementById('projectModal').classList.remove('active');
        document.body.style.overflow = '';
        
        // 重置表单
        document.getElementById('projectForm').reset();
        this.currentEditingId = null;
        document.getElementById('modalTitle').textContent = '添加项目';
    }

    // 关闭删除确认模态框
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.remove('active');
        document.body.style.overflow = '';
        this.currentDeleteId = null;
    }

    // 打开登录模态框
    openLoginModal() {
        document.getElementById('loginModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // 关闭登录模态框
    closeLoginModal() {
        document.getElementById('loginModal').classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('loginForm').reset();
    }

    // 打开设置密码模态框
    openSetupModal() {
        document.getElementById('setupModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        this.closeLoginModal();
    }

    // 关闭设置密码模态框
    closeSetupModal() {
        document.getElementById('setupModal').classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('setupForm').reset();
    }
}

// 全局函数（用于HTML中的onclick事件）
function openAddModal() {
    projectManager.openModal();
}

function closeModal() {
    projectManager.closeModal();
}

function closeDeleteModal() {
    projectManager.closeDeleteModal();
}

function confirmDelete() {
    projectManager.confirmDeleteAction();
}

function openLoginModal() {
    projectManager.openLoginModal();
}

function closeLoginModal() {
    projectManager.closeLoginModal();
}

function openSetupModal() {
    projectManager.openSetupModal();
}

function closeSetupModal() {
    projectManager.closeSetupModal();
}

function logout() {
    projectManager.logout();
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 初始化项目管理器
const projectManager = new ProjectManager();

// 添加一些示例项目（仅在第一次访问时）
if (projectManager.projects.length === 0) {
    const sampleProjects = [
        {
            id: 'sample1',
            name: '个人博客',
            url: 'https://example.com/blog',
            description: '使用React和Node.js构建的个人博客系统，支持Markdown写作和评论功能。',
            category: 'web',
            tags: ['React', 'Node.js', 'MongoDB', 'Express']
        },
        {
            id: 'sample2',
            name: '任务管理应用',
            url: 'https://example.com/todo',
            description: '简洁高效的任务管理工具，支持项目分组、优先级设置和团队协作。',
            category: 'web',
            tags: ['Vue.js', 'Firebase', 'PWA']
        },
        {
            id: 'sample3',
            name: '天气预报App',
            url: 'https://example.com/weather',
            description: '基于React Native开发的天气预报应用，提供详细的天气信息和美观的UI。',
            category: 'mobile',
            tags: ['React Native', 'API', 'iOS', 'Android']
        }
    ];

    projectManager.projects = sampleProjects;
    projectManager.saveProjects();
    projectManager.renderProjects();
    projectManager.updateEmptyState();
} 