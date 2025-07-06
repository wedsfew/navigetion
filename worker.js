// Cloudflare Worker for Navigation Website
// 处理KV存储和API请求

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// 处理CORS预检请求
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  return null;
}

// 生成JWT token
async function generateToken(payload) {
  const secret = 'navigation-secret-key'; // 在生产环境中应该使用更安全的密钥
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// 验证JWT token
async function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const secret = 'navigation-secret-key';
    
    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new TextEncoder().encode(`${header}.${payload}`)
    );
    
    const expectedEncodedSignature = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));
    
    if (signature !== expectedEncodedSignature) {
      return null;
    }
    
    const decodedPayload = JSON.parse(atob(payload));
    
    // 检查token是否过期
    if (decodedPayload.exp && Date.now() / 1000 > decodedPayload.exp) {
      return null;
    }
    
    return decodedPayload;
  } catch (error) {
    return null;
  }
}

// 密码哈希
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
async function verifyPassword(password, hash) {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

// 主要的请求处理函数
export default {
  async fetch(request, env, ctx) {
    // 处理CORS
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // 路由处理
      if (path === '/api/auth/setup' && method === 'POST') {
        return await handleSetupAdmin(request, env);
      }
      
      if (path === '/api/auth/login' && method === 'POST') {
        return await handleLogin(request, env);
      }
      
      if (path === '/api/auth/verify' && method === 'POST') {
        return await handleVerifyToken(request, env);
      }
      
      if (path === '/api/projects' && method === 'GET') {
        return await handleGetProjects(request, env);
      }
      
      if (path === '/api/projects' && method === 'POST') {
        return await handleCreateProject(request, env);
      }
      
      if (path.startsWith('/api/projects/') && method === 'PUT') {
        const projectId = path.split('/').pop();
        return await handleUpdateProject(request, env, projectId);
      }
      
      if (path.startsWith('/api/projects/') && method === 'DELETE') {
        const projectId = path.split('/').pop();
        return await handleDeleteProject(request, env, projectId);
      }
      
      // 默认返回404
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// 设置管理员账户
async function handleSetupAdmin(request, env) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: '密码长度至少为6位' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 检查是否已经设置过管理员
    const existingAdmin = await env.NAVIGATION_KV.get('admin');
    if (existingAdmin) {
      return new Response(JSON.stringify({ error: '管理员已经设置过了' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 创建管理员账户
    const hashedPassword = await hashPassword(password);
    const adminData = {
      username: username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };
    
    await env.NAVIGATION_KV.put('admin', JSON.stringify(adminData));
    
    return new Response(JSON.stringify({ message: '管理员账户创建成功' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Setup admin error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 管理员登录
async function handleLogin(request, env) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 获取管理员信息
    const adminData = await env.NAVIGATION_KV.get('admin');
    if (!adminData) {
      return new Response(JSON.stringify({ error: '管理员账户不存在，请先设置' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const admin = JSON.parse(adminData);
    
    // 验证用户名和密码
    if (admin.username !== username || !await verifyPassword(password, admin.password)) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 生成JWT token
    const token = await generateToken({
      username: username,
      isAdmin: true,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时过期
    });
    
    return new Response(JSON.stringify({ 
      token: token,
      username: username,
      message: '登录成功' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 验证token
async function handleVerifyToken(request, env) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: 'Token不能为空' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ valid: false, error: 'Token无效或已过期' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      valid: true,
      username: payload.username,
      isAdmin: payload.isAdmin 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Verify token error:', error);
    return new Response(JSON.stringify({ valid: false, error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 获取项目列表
async function handleGetProjects(request, env) {
  try {
    const projectsData = await env.NAVIGATION_KV.get('projects');
    const projects = projectsData ? JSON.parse(projectsData) : [];
    
    return new Response(JSON.stringify({ projects }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Get projects error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 验证管理员token的中间件
async function verifyAdminToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyToken(token);
  
  if (!payload || !payload.isAdmin) {
    return null;
  }
  
  return payload;
}

// 创建项目
async function handleCreateProject(request, env) {
  try {
    // 验证管理员权限
    const adminPayload = await verifyAdminToken(request);
    if (!adminPayload) {
      return new Response(JSON.stringify({ error: '需要管理员权限' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const projectData = await request.json();
    
    // 验证项目数据
    if (!projectData.name || !projectData.url) {
      return new Response(JSON.stringify({ error: '项目名称和链接不能为空' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 生成项目ID
    const projectId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // 创建项目对象
    const project = {
      id: projectId,
      name: projectData.name,
      url: projectData.url,
      description: projectData.description || '',
      category: projectData.category || 'other',
      tags: projectData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // 获取现有项目
    const existingProjectsData = await env.NAVIGATION_KV.get('projects');
    const existingProjects = existingProjectsData ? JSON.parse(existingProjectsData) : [];
    
    // 添加新项目到列表开头
    existingProjects.unshift(project);
    
    // 保存到KV
    await env.NAVIGATION_KV.put('projects', JSON.stringify(existingProjects));
    
    return new Response(JSON.stringify({ 
      message: '项目创建成功',
      project: project 
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Create project error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 更新项目
async function handleUpdateProject(request, env, projectId) {
  try {
    // 验证管理员权限
    const adminPayload = await verifyAdminToken(request);
    if (!adminPayload) {
      return new Response(JSON.stringify({ error: '需要管理员权限' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const projectData = await request.json();
    
    // 验证项目数据
    if (!projectData.name || !projectData.url) {
      return new Response(JSON.stringify({ error: '项目名称和链接不能为空' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 获取现有项目
    const existingProjectsData = await env.NAVIGATION_KV.get('projects');
    const existingProjects = existingProjectsData ? JSON.parse(existingProjectsData) : [];
    
    // 找到要更新的项目
    const projectIndex = existingProjects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
      return new Response(JSON.stringify({ error: '项目不存在' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 更新项目
    existingProjects[projectIndex] = {
      ...existingProjects[projectIndex],
      name: projectData.name,
      url: projectData.url,
      description: projectData.description || '',
      category: projectData.category || 'other',
      tags: projectData.tags || [],
      updatedAt: new Date().toISOString(),
    };
    
    // 保存到KV
    await env.NAVIGATION_KV.put('projects', JSON.stringify(existingProjects));
    
    return new Response(JSON.stringify({ 
      message: '项目更新成功',
      project: existingProjects[projectIndex] 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Update project error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 删除项目
async function handleDeleteProject(request, env, projectId) {
  try {
    // 验证管理员权限
    const adminPayload = await verifyAdminToken(request);
    if (!adminPayload) {
      return new Response(JSON.stringify({ error: '需要管理员权限' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 获取现有项目
    const existingProjectsData = await env.NAVIGATION_KV.get('projects');
    const existingProjects = existingProjectsData ? JSON.parse(existingProjectsData) : [];
    
    // 找到要删除的项目
    const projectIndex = existingProjects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
      return new Response(JSON.stringify({ error: '项目不存在' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 删除项目
    existingProjects.splice(projectIndex, 1);
    
    // 保存到KV
    await env.NAVIGATION_KV.put('projects', JSON.stringify(existingProjects));
    
    return new Response(JSON.stringify({ message: '项目删除成功' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Delete project error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
} 