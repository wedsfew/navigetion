// 项目管理器 - 使用Cloudflare Worker API
class ProjectManager {
    constructor() {
        this.projects = [];
        this.categories = [];
        this.currentEditingId = null;
        this.currentDeleteId = null;
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.isAdmin = false;
        this.adminToken = null;
        this.adminUsername = null;
        
        // API配置 - 从config.js文件加载
        this.apiBaseUrl = window.API_CONFIG?.baseUrl || 
            (window.location.origin.includes('localhost') 
                ? 'http://localhost:8787'
                : 'https://navigation-worker.your-subdomain.workers.dev');
        
        this.init();
    }

    async init() {
        // 初始化网络状态监测
        this.initNetworkMonitoring();
        
        await this.loadAdminToken();
        await this.loadCategories();
        await this.loadProjects();
        this.bindEvents();
        this.updateEmptyState();
        this.updateUIForAdminStatus();
    }

    // API调用函数 - 增强版，支持重试和超时处理
    async apiCall(endpoint, options = {}, retryCount = 3) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: 15000, // 15秒超时
            ...options
        };

        // 如果有token，添加到请求头
        if (this.adminToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.adminToken}`;
        }

        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`API调用尝试 ${attempt}/${retryCount}: ${endpoint}`);
                
                // 创建超时控制器
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), defaultOptions.timeout);
                
                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ 
                        error: `HTTP ${response.status}: ${response.statusText}` 
                    }));
                    throw new Error(error.error || `请求失败 (${response.status})`);
                }

                console.log(`API调用成功: ${endpoint}`);
                return await response.json();
                
            } catch (error) {
                console.error(`API调用失败 (尝试 ${attempt}/${retryCount}):`, error);
                
                if (attempt === retryCount) {
                    // 最后一次尝试失败，抛出详细错误
                    if (error.name === 'AbortError') {
                        throw new Error('网络连接超时，请检查网络状况或稍后重试');
                    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        throw new Error('网络连接失败，请检查网络状况。如果在中国大陆访问，可能是网络限制导致的，建议使用VPN或稍后重试');
                    } else {
                        throw new Error(error.message || '服务器连接失败，请稍后重试');
                    }
                }
                
                // 等待一段时间再重试，避免频繁请求
                const delay = attempt * 1000; // 1秒, 2秒, 3秒...
                console.log(`等待 ${delay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
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
        // 显示加载状态
        this.showLoadingState('正在加载项目...');
        
        try {
            const response = await this.apiCall('/api/projects');
            this.projects = response.projects || [];
            this.renderProjects();
            this.hideLoadingState();
            
            // 缓存项目数据
            this.saveProjectsCache(this.projects);
            
            // 如果项目为空，可能是首次访问
            if (this.projects.length === 0) {
                this.showMessage('暂无项目，请添加您的第一个项目', 'info');
            }
        } catch (error) {
            console.error('加载项目失败:', error);
            this.hideLoadingState();
            
            // 显示更友好的错误信息和重试按钮
            this.showNetworkErrorMessage(error.message);
            
            // 尝试从缓存加载项目
            this.loadProjectsFromCache();
        }
    }

    // 加载分类列表
    async loadCategories() {
        try {
            const response = await this.apiCall('/api/categories');
            this.categories = response.categories || [];
            this.renderCategories();
            this.updateCategorySelect();
            
            // 缓存分类数据
            this.saveCategoriesCache(this.categories);
        } catch (error) {
            console.error('加载分类失败:', error);
            this.showMessage('加载分类失败: ' + error.message, 'error');
            
            // 尝试从缓存加载分类
            this.loadCategoriesFromCache();
        }
    }

    // 从缓存加载项目
    loadProjectsFromCache() {
        try {
            const cachedProjects = localStorage.getItem('projects_cache');
            if (cachedProjects) {
                this.projects = JSON.parse(cachedProjects);
                this.renderProjects();
                this.showMessage('已从缓存加载项目数据，部分数据可能不是最新的', 'info');
            }
        } catch (error) {
            console.error('从缓存加载项目失败:', error);
        }
    }

    // 保存项目到缓存
    saveProjectsCache(projects) {
        try {
            localStorage.setItem('projects_cache', JSON.stringify(projects));
            localStorage.setItem('projects_cache_time', Date.now().toString());
        } catch (error) {
            console.error('保存项目缓存失败:', error);
        }
    }

    // 从缓存加载分类
    loadCategoriesFromCache() {
        try {
            const cachedCategories = localStorage.getItem('categories_cache');
            if (cachedCategories) {
                this.categories = JSON.parse(cachedCategories);
                this.renderCategories();
                this.updateCategorySelect();
                this.showMessage('已从缓存加载分类数据', 'info');
            }
        } catch (error) {
            console.error('从缓存加载分类失败:', error);
        }
    }

    // 保存分类到缓存
    saveCategoriesCache(categories) {
        try {
            localStorage.setItem('categories_cache', JSON.stringify(categories));
        } catch (error) {
            console.error('保存分类缓存失败:', error);
        }
    }

    // 显示加载状态
    showLoadingState(message = '加载中...') {
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.textContent = message;
            loadingElement.style.display = 'block';
        } else {
            // 创建加载状态元素
            const loading = document.createElement('div');
            loading.id = 'loadingState';
            loading.className = 'loading-state';
            loading.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <span>${message}</span>
            `;
            document.querySelector('.container').appendChild(loading);
        }
    }

    // 隐藏加载状态
    hideLoadingState() {
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    // 初始化网络监测
    initNetworkMonitoring() {
        // 检测网络连接状态
        this.updateNetworkStatus();
        
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.updateNetworkStatus();
            this.showMessage('网络连接已恢复', 'success');
            // 网络恢复后重新加载数据
            this.loadProjects();
            this.loadCategories();
        });
        
        window.addEventListener('offline', () => {
            this.updateNetworkStatus();
            this.showMessage('网络连接已断开，将使用缓存数据', 'warning');
        });
        
        // 定期检测网络质量
        setInterval(() => {
            this.checkNetworkQuality();
        }, 30000); // 30秒检查一次
    }

    // 更新网络状态显示
    updateNetworkStatus() {
        const networkStatus = document.getElementById('networkStatus');
        const networkStatusText = document.getElementById('networkStatusText');
        const statusIcon = networkStatus.querySelector('i');
        
        if (!networkStatus) return;
        
        if (navigator.onLine) {
            networkStatus.className = 'network-status online';
            statusIcon.className = 'fas fa-wifi';
            networkStatusText.textContent = '网络连接正常';
            
            // 3秒后隐藏正常状态
            setTimeout(() => {
                if (networkStatus.classList.contains('online')) {
                    networkStatus.style.display = 'none';
                }
            }, 3000);
        } else {
            networkStatus.className = 'network-status offline';
            statusIcon.className = 'fas fa-wifi-slash';
            networkStatusText.textContent = '网络已断开';
            networkStatus.style.display = 'flex';
        }
    }

    // 检测网络质量
    async checkNetworkQuality() {
        if (!navigator.onLine) return;
        
        const networkStatus = document.getElementById('networkStatus');
        const networkStatusText = document.getElementById('networkStatusText');
        const statusIcon = networkStatus.querySelector('i');
        
        if (!networkStatus) return;
        
        try {
            const startTime = Date.now();
            const response = await fetch(this.apiBaseUrl + '/api/projects', {
                method: 'HEAD',
                cache: 'no-cache',
                signal: AbortSignal.timeout(5000) // 5秒超时
            });
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            if (response.ok) {
                if (responseTime > 3000) {
                    // 网络较慢
                    networkStatus.className = 'network-status slow';
                    statusIcon.className = 'fas fa-exclamation-triangle';
                    networkStatusText.textContent = '网络较慢，建议检查网络或使用VPN';
                    networkStatus.style.display = 'flex';
                    
                    // 10秒后隐藏
                    setTimeout(() => {
                        if (networkStatus.classList.contains('slow')) {
                            networkStatus.style.display = 'none';
                        }
                    }, 10000);
                } else {
                    // 网络正常，隐藏状态
                    networkStatus.style.display = 'none';
                }
            }
        } catch (error) {
            // 连接失败
            networkStatus.className = 'network-status offline';
            statusIcon.className = 'fas fa-exclamation-circle';
            networkStatusText.textContent = '服务器连接失败，可能是网络限制';
            networkStatus.style.display = 'flex';
                 }
     }

    // 显示网络错误消息和重试选项
    showNetworkErrorMessage(originalError) {
        // 创建自定义错误消息
        const errorContainer = document.createElement('div');
        errorContainer.className = 'network-error-message';
        errorContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #fed7d7;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            z-index: 2000;
            max-width: 400px;
            text-align: center;
        `;

        errorContainer.innerHTML = `
            <div style="color: #e53e3e; margin-bottom: 15px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px;"></i>
            </div>
            <h3 style="color: #2d3748; margin-bottom: 10px;">网络连接问题</h3>
            <p style="color: #4a5568; margin-bottom: 20px; line-height: 1.5;">
                ${originalError}
            </p>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="color: #856404; margin-bottom: 10px;">💡 解决方案</h4>
                <ul style="color: #856404; text-align: left; margin: 0; padding-left: 20px;">
                    <li>检查网络连接状况</li>
                    <li>如果在中国大陆，建议使用VPN</li>
                    <li>稍后重试或刷新页面</li>
                </ul>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="retry-button" onclick="projectManager.retryLoadData()">
                    <i class="fas fa-redo"></i> 重试
                </button>
                <button class="retry-button" onclick="projectManager.closeErrorMessage()" style="background: #6c757d;">
                    关闭
                </button>
            </div>
        `;

        document.body.appendChild(errorContainer);
        this.currentErrorMessage = errorContainer;
    }

    // 重试加载数据
    async retryLoadData() {
        this.closeErrorMessage();
        this.showMessage('正在重新加载...', 'info');
        
        try {
            await this.loadProjects();
            await this.loadCategories();
            this.showMessage('数据加载成功！', 'success');
        } catch (error) {
            this.showMessage('重试失败，请检查网络后再试', 'error');
        }
    }

    // 关闭错误消息
    closeErrorMessage() {
        if (this.currentErrorMessage) {
            this.currentErrorMessage.remove();
            this.currentErrorMessage = null;
        }
    }

    // 渲染分类过滤器
    renderCategories() {
        const filterButtons = document.querySelector('.filter-buttons');
        
        // 清空现有的分类按钮（保留"全部"按钮）
        const allButton = filterButtons.querySelector('.filter-btn[data-category="all"]');
        filterButtons.innerHTML = '';
        filterButtons.appendChild(allButton);
        
        // 添加自定义分类按钮
        this.categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.category = category.id;
            button.textContent = category.name;
            button.addEventListener('click', (e) => {
                // 更新按钮状态
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // 更新过滤器
                this.currentFilter = e.target.dataset.category;
                this.filterAndRenderProjects();
            });
            filterButtons.appendChild(button);
        });
    }

    // 更新项目表单中的分类选择
    updateCategorySelect() {
        const categorySelect = document.getElementById('projectCategory');
        if (!categorySelect) return;
        
        // 清空现有选项
        categorySelect.innerHTML = '';
        
        // 添加自定义分类选项
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    }

    // 创建分类
    async createCategory(name) {
        if (!this.isAdmin) {
            this.showMessage('需要管理员权限', 'error');
            return;
        }

        try {
            const response = await this.apiCall('/api/categories', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            
            this.showMessage('分类创建成功', 'success');
            await this.loadCategories();
            return response.category;
        } catch (error) {
            console.error('创建分类失败:', error);
            this.showMessage('创建分类失败: ' + error.message, 'error');
        }
    }

    // 更新分类
    async updateCategory(id, name) {
        if (!this.isAdmin) {
            this.showMessage('需要管理员权限', 'error');
            return;
        }

        try {
            const response = await this.apiCall(`/api/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name })
            });
            
            this.showMessage('分类更新成功', 'success');
            await this.loadCategories();
            return response.category;
        } catch (error) {
            console.error('更新分类失败:', error);
            this.showMessage('更新分类失败: ' + error.message, 'error');
        }
    }

    // 删除分类
    async deleteCategory(id) {
        if (!this.isAdmin) {
            this.showMessage('需要管理员权限', 'error');
            return;
        }

        try {
            await this.apiCall(`/api/categories/${id}`, {
                method: 'DELETE'
            });
            
            this.showMessage('分类删除成功', 'success');
            await this.loadCategories();
            
            // 如果当前筛选的是被删除的分类，切换到"全部"
            if (this.currentFilter === id) {
                this.currentFilter = 'all';
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('.filter-btn[data-category="all"]').classList.add('active');
                this.filterAndRenderProjects();
            }
        } catch (error) {
            console.error('删除分类失败:', error);
            this.showMessage('删除分类失败: ' + error.message, 'error');
        }
    }

    // 渲染分类管理列表
    renderCategoryList() {
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;
        
        if (this.categories.length === 0) {
            categoryList.innerHTML = '<div class="no-categories">暂无分类</div>';
            return;
        }
        
        categoryList.innerHTML = this.categories.map(category => `
            <div class="category-item" data-id="${category.id}">
                <div class="category-item-name">${this.escapeHtml(category.name)}</div>
                <div class="category-item-actions">
                    <button class="category-action-btn category-edit-btn" onclick="startEditCategory('${category.id}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="category-action-btn category-delete-btn" onclick="confirmDeleteCategory('${category.id}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
                <div class="category-edit-form" id="editForm-${category.id}">
                    <input type="text" class="category-edit-input" id="editInput-${category.id}" value="${this.escapeHtml(category.name)}">
                    <div class="category-edit-actions">
                        <button class="category-save-btn" onclick="saveEditCategory('${category.id}')">保存</button>
                        <button class="category-cancel-btn" onclick="cancelEditCategory('${category.id}')">取消</button>
                    </div>
                </div>
            </div>
        `).join('');
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

        // 分类表单提交
        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateCategory();
        });

        // 分类管理模态框点击外部关闭
        document.getElementById('categoryModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('categoryModal')) {
                this.closeCategoryModal();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
                this.closeLoginModal();
                this.closeSetupModal();
                this.closeCategoryModal();
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
            
            // 调试信息
            console.log('登录成功，管理员状态:', this.isAdmin);
            console.log('Token:', this.adminToken);
            
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
        
        // 调试信息
        console.log('登出成功，管理员状态:', this.isAdmin);
        console.log('Token已清除');
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
        
        // 调试信息
        console.log('创建项目卡片，管理员状态:', this.isAdmin, '项目ID:', project.id);
        
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
    getCategoryName(categoryId) {
        // 查找自定义分类
        const customCategory = this.categories.find(c => c.id === categoryId);
        if (customCategory) {
            return customCategory.name;
        }
        
        // 兼容旧的硬编码分类
        const names = {
            'web': '网站',
            'mobile': '移动端',
            'desktop': '桌面端',
            'other': '其他'
        };
        return names[categoryId] || categoryId;
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
    showMessage(message, type = 'success', duration = 3000) {
        // 创建消息提示
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        
        // 处理多行消息
        if (message.includes('\n')) {
            messageEl.innerHTML = message.split('\n').map(line => `<div>${this.escapeHtml(line)}</div>`).join('');
        } else {
            messageEl.textContent = message;
        }
        
        // 根据类型设置样式
        let bgColor, shadowColor, icon;
        switch (type) {
            case 'error':
                bgColor = '#f44336';
                shadowColor = 'rgba(244, 67, 54, 0.4)';
                icon = 'fas fa-exclamation-circle';
                break;
            case 'info':
                bgColor = '#2196f3';
                shadowColor = 'rgba(33, 150, 243, 0.4)';
                icon = 'fas fa-info-circle';
                break;
            case 'warning':
                bgColor = '#ff9800';
                shadowColor = 'rgba(255, 152, 0, 0.4)';
                icon = 'fas fa-exclamation-triangle';
                break;
            default: // success
                bgColor = '#48bb78';
                shadowColor = 'rgba(72, 187, 120, 0.4)';
                icon = 'fas fa-check-circle';
        }
        
        // 添加图标
        const iconEl = document.createElement('i');
        iconEl.className = icon;
        iconEl.style.marginRight = '8px';
        messageEl.insertBefore(iconEl, messageEl.firstChild);
        
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
            max-width: 350px;
            word-wrap: break-word;
            font-size: 14px;
            line-height: 1.4;
            display: flex;
            align-items: flex-start;
        `;

        document.body.appendChild(messageEl);

        // 自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, duration);
    }

    // 编辑项目
    editProject(id) {
        console.log('编辑项目被调用，项目ID:', id, '管理员状态:', this.isAdmin);
        
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }

        const project = this.projects.find(p => p.id === id);
        if (!project) {
            console.error('找不到项目，ID:', id, '现有项目:', this.projects);
            this.showMessage('项目不存在', 'error');
            return;
        }

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
        console.log('确认删除被调用，项目ID:', id, '管理员状态:', this.isAdmin);
        
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }
        
        const project = this.projects.find(p => p.id === id);
        if (!project) {
            console.error('找不到要删除的项目，ID:', id, '现有项目:', this.projects);
            this.showMessage('项目不存在', 'error');
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
        console.log('更新UI管理员状态，isAdmin:', this.isAdmin);
        
        const loginBtn = document.getElementById('loginBtn');
        const addBtn = document.getElementById('addBtn');
        const adminInfo = document.getElementById('adminInfo');
        const visitorNotice = document.getElementById('visitorNotice');
        const categoryManagement = document.getElementById('categoryManagement');

        if (this.isAdmin) {
            loginBtn.style.display = 'none';
            addBtn.style.display = 'flex';
            adminInfo.style.display = 'flex';
            visitorNotice.style.display = 'none';
            categoryManagement.style.display = 'block';
            
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
            categoryManagement.style.display = 'none';
        }

        // 更新项目卡片的操作按钮
        console.log('重新渲染项目，项目数量:', this.projects.length);
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

    // 打开分类管理模态框
    openCategoryModal() {
        if (!this.isAdmin) {
            this.showMessage('请先登录管理员账户', 'error');
            return;
        }
        document.getElementById('categoryModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        this.renderCategoryList();
    }

    // 关闭分类管理模态框
    closeCategoryModal() {
        document.getElementById('categoryModal').classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('categoryForm').reset();
    }

    // 处理创建分类
    async handleCreateCategory() {
        const categoryName = document.getElementById('categoryName').value.trim();
        
        if (!categoryName) {
            this.showMessage('请输入分类名称', 'error');
            return;
        }
        
        // 检查分类名称是否已存在
        const existingCategory = this.categories.find(c => c.name === categoryName);
        if (existingCategory) {
            this.showMessage('分类名称已存在', 'error');
            return;
        }
        
        await this.createCategory(categoryName);
        document.getElementById('categoryName').value = '';
        this.renderCategoryList();
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

// 分类管理相关的全局函数
function openCategoryModal() {
    projectManager.openCategoryModal();
}

function closeCategoryModal() {
    projectManager.closeCategoryModal();
}

function startEditCategory(id) {
    const editForm = document.getElementById(`editForm-${id}`);
    const categoryItem = document.querySelector(`[data-id="${id}"]`);
    
    if (editForm && categoryItem) {
        editForm.classList.add('active');
        const input = document.getElementById(`editInput-${id}`);
        if (input) {
            input.focus();
            input.select();
        }
    }
}

function saveEditCategory(id) {
    const input = document.getElementById(`editInput-${id}`);
    if (input) {
        const newName = input.value.trim();
        if (newName) {
            projectManager.updateCategory(id, newName);
            cancelEditCategory(id);
        } else {
            projectManager.showMessage('请输入分类名称', 'error');
        }
    }
}

function cancelEditCategory(id) {
    const editForm = document.getElementById(`editForm-${id}`);
    if (editForm) {
        editForm.classList.remove('active');
        // 恢复原始值
        const category = projectManager.categories.find(c => c.id === id);
        if (category) {
            const input = document.getElementById(`editInput-${id}`);
            if (input) {
                input.value = category.name;
            }
        }
    }
}

function confirmDeleteCategory(id) {
    const category = projectManager.categories.find(c => c.id === id);
    if (category) {
        if (confirm(`确定要删除分类"${category.name}"吗？\n\n删除分类不会影响已有的项目，但会将该分类从过滤器中移除。`)) {
            projectManager.deleteCategory(id);
        }
    }
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