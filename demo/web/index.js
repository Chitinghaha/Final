// ==========================
// 🔧 變數與 DOM 選擇器
// ==========================
let currentUser = 'John Doe';
let iamCache = null;

const snippet = document.querySelector('.home code');
const template = document.querySelector('author-cycle');
const userList = document.querySelector('header > select[name="user"]');
const headerLinks = document.querySelectorAll('header a');
const permissionsContainer = document.querySelector('.permissions .permissions-container');
const adminUserSelect = document.getElementById('admin-user-select');
const adminPermissionsContainer = document.getElementById('admin-permissions');

let adminSelectedUser = null;

// ==========================
// 🧠 IAM 資料相關 API
// ==========================
const fetchIAMData = async () => {
  if (iamCache) return iamCache;
  const res = await fetch('/api/iam-data');
  iamCache = await res.json();
  return iamCache;
};

const userAuthorized = async (userName, resource, permission) => {
  const res = await fetch('/api/user/authorized', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, resource, permission }),
  });
  const data = await res.json();
  return data.data;
};

const userTrace = async (userName, resource, permission) => {
  const res = await fetch('/api/user/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, resource, permission }),
  });
  const data = await res.json();
  return data.data;
};

// ==========================
// 🎨 Header 操作邏輯
// ==========================
const setSelectedHeader = (selectedId) => {
  headerLinks.forEach(link => {
    if (link.id === selectedId) {
      link.setAttribute('selected', '');
    } else {
      link.removeAttribute('selected');
    }
  });
};

headerLinks.forEach(link => {
  link.addEventListener('click', async evt => {
    evt.preventDefault();
    const displaySection = evt.target.id;

    if (displaySection === 'permissions') {
      const authorized = await userAuthorized(currentUser, 'permissions', 'view');
      if (!authorized) {
        const trace = await userTrace(currentUser, 'permissions', 'view');
        alert(`抱歉，${currentUser}，您沒有權限瀏覽此區域。\n\n${trace.description || ''}`);
        return;
      }

      await renderPermissionsPage();
      template.show('.permissions');
      setSelectedHeader('permissions');
      return;
    }

    if (displaySection === 'admin_settings') {
      const authorized = await userAuthorized(currentUser, 'admin_settings', 'view');
      if (!authorized) {
        const trace = await userTrace(currentUser, 'admin_settings', 'view');
        alert(`抱歉，${currentUser}，您沒有權限瀏覽此區域。\n\n${trace.description || ''}`);
        return;
      }

      template.show('.admin_settings');
      setSelectedHeader('admin_settings');
      await loadAdminUserList();
      return;
    }

    if (displaySection === 'home') {
      iamCache = null;       // ✅ 清空快取
      await renderIAM();     // 🔁 強制刷新資料
    }


    const resource = displaySection !== 'home' ? 'blog' : 'home';
    const permission = displaySection === 'editor' ? 'edit' : 'view';

    const authorized = await userAuthorized(currentUser, resource, permission);
    if (!authorized) {
      const trace = await userTrace(currentUser, resource, permission);
      alert(`抱歉，${currentUser}，您沒有權限瀏覽此區域。\n\n${trace.description || ''}`);
      return;
    }

    template.show(`.${displaySection}`);
    setSelectedHeader(displaySection);
  });
});

// ==========================
// 👤 使用者選單事件
// ==========================
userList.addEventListener('change', async evt => {
  currentUser = evt.target.value;
  await updateUserSnippet();

  if (document.querySelector('author-cycle > section.permissions[selected]')) {
    await renderPermissionsPage();
  }
});

// ==========================
// 🖼️ 主畫面渲染邏輯
// ==========================
const renderIAM = async () => {
  const res = await fetchIAMData();
  const { roles, groups, users, resources } = res;

  document.querySelector('.roles table tbody').innerHTML = '';
  document.querySelector('.groups table tbody').innerHTML = '';
  document.querySelector('.resources table tbody').innerHTML = '';
  userList.innerHTML = '';

  roles.forEach(role => {
    const rights = Object.entries(role.rights)
      .map(([resource, perms]) =>
        perms.map(priv =>
          `<div class="permission_${priv.granted ? 'granted' : 'denied'}">${resource}: ${priv.right}</div>`
        ).join('')
      ).join('');
    document.querySelector('.roles table tbody').insertAdjacentHTML('beforeend', `<tr><td>${role.name}</td><td>${rights}</td></tr>`);
  });

  groups.forEach(group => {
    const rolesHTML = group.roles.join('<br/>');
    const membersHTML = group.members.map(m => m.name).join('<br/>');
    document.querySelector('.groups table tbody').insertAdjacentHTML('beforeend', `<tr><td>${group.name}</td><td>${rolesHTML}</td><td>${membersHTML}</td></tr>`);
  });

  resources.forEach(resource => {
    const rights = resource.rights
      .map(priv => `<span class="permission_${priv.granted ? 'granted' : 'denied'}">${priv.right}</span>`)
      .join(', ');
    document.querySelector('.resources table tbody').insertAdjacentHTML('beforeend', `<tr><td>${resource.name}</td><td>${rights}</td></tr>`);
  });

  users.forEach(user => {
    userList.insertAdjacentHTML('beforeend', `<option value="${user.name}" ${user.name === currentUser ? 'selected' : ''}>${user.name}</option>`);
  });

  await updateUserSnippet();
};

const updateUserSnippet = async () => {
  const res = await fetchIAMData();
  const user = res.users.find(u => u.name === currentUser);
  snippet.textContent = JSON.stringify(user, null, 2);
};

renderIAM();

// ==========================
// 👨‍💼 Admin 權限設定頁面
// ==========================
async function loadAdminUserList() {
  const iamData = await fetchIAMData();
  adminUserSelect.innerHTML = '';
  iamData.users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.name;
    option.textContent = user.name;
    adminUserSelect.appendChild(option);
  });

  if (iamData.users.length > 0) {
    adminSelectedUser = iamData.users[0].name;
    adminUserSelect.value = adminSelectedUser;
    await renderAdminPermissionsPage();
  }
}

adminUserSelect.addEventListener('change', async (e) => {
  adminSelectedUser = e.target.value;
  await renderAdminPermissionsPage();

});

async function renderAdminPermissionsPage() {
  adminPermissionsContainer.innerHTML = '載入中...';
  const iamData = await fetchIAMData();
  const { resources } = iamData;
  const userName = adminSelectedUser;

  adminPermissionsContainer.innerHTML = '';

  const resourceSelect = document.createElement('select');
  resourceSelect.id = 'admin-resource-select';
  resources.forEach(res => {
    const option = document.createElement('option');
    option.value = res.name;
    option.textContent = res.name;
    resourceSelect.appendChild(option);
  });
  adminPermissionsContainer.appendChild(resourceSelect);

  const rightSelect = document.createElement('select');
  rightSelect.id = 'admin-right-select';
  adminPermissionsContainer.appendChild(rightSelect);

  const allowDenySelect = document.createElement('select');
  allowDenySelect.id = 'admin-allow-deny-select';
  ['allow', 'deny'].forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    allowDenySelect.appendChild(opt);
  });
  adminPermissionsContainer.appendChild(allowDenySelect);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '儲存';
  adminPermissionsContainer.appendChild(saveBtn);

  const updateRightsOptions = async (resourceName) => {
    rightSelect.innerHTML = '';
    const resource = resources.find(r => r.name === resourceName);
    if (!resource) return;

    resource.rights.forEach(r => {
      const option = document.createElement('option');
      option.value = r.right;
      option.textContent = r.right;
      rightSelect.appendChild(option);
    });

    const selectedRight = rightSelect.value;
    const hasPermission = await userAuthorized(userName, resourceName, selectedRight);
    allowDenySelect.value = hasPermission ? 'allow' : 'deny';
  };

  resourceSelect.addEventListener('change', async (e) => {
    await updateRightsOptions(e.target.value);
  });

  rightSelect.addEventListener('change', async (e) => {
    const resourceName = resourceSelect.value;
    const rightName = e.target.value;
    const hasPermission = await userAuthorized(userName, resourceName, rightName);
    allowDenySelect.value = hasPermission ? 'allow' : 'deny';
  });

  if (resources.length > 0) {
    resourceSelect.value = resources[0].name;
    await updateRightsOptions(resources[0].name);
  }

  saveBtn.addEventListener('click', async () => {
    const resourceName = resourceSelect.value;
    const rightName = rightSelect.value;
    const value = allowDenySelect.value;

    try {
      const res = await fetch('/api/user/set-right', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, resource: resourceName, right: rightName, value }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`伺服器未回傳 JSON：\n${text}`);
      }

      const data = await res.json();
      if (data.success) {
        alert(`更新成功：${resourceName} - ${rightName} 設為 ${value}`);
      } else {
        alert('更新失敗，請稍後再試。');
      }
    } catch (err) {
      alert('更新時發生錯誤: ' + err.message);
    }
  });

  await renderGroupRoleManagement();
}

// ==============================
// 管理群組角色功能（群組 + 角色 assign/revoke）
// ==============================
async function renderGroupRoleManagement() {
  const iamData = await fetchIAMData();
  const { groups, roles } = iamData;

  const container = document.createElement('div');
  container.classList.add('group-role-management');

  const title = document.createElement('h3');
  title.textContent = '群組角色管理';
  container.appendChild(title);

  // 群組下拉選單
  const groupSelect = document.createElement('select');
  groupSelect.id = 'admin-group-select';
  groups.forEach(group => {
    const opt = document.createElement('option');
    opt.value = group.name;
    opt.textContent = group.name;
    groupSelect.appendChild(opt);
  });
  container.appendChild(groupSelect);

  // 角色下拉選單
  const roleSelect = document.createElement('select');
  roleSelect.id = 'admin-role-select';
  roles.forEach(role => {
    const opt = document.createElement('option');
    opt.value = role.name;
    opt.textContent = role.name;
    roleSelect.appendChild(opt);
  });
  container.appendChild(roleSelect);

  // assign 按鈕
  const assignBtn = document.createElement('button');
  assignBtn.textContent = '指派角色';
  container.appendChild(assignBtn);

  // revoke 按鈕
  const revokeBtn = document.createElement('button');
  revokeBtn.textContent = '移除角色';
  container.appendChild(revokeBtn);

  adminPermissionsContainer.appendChild(container);

  // 綁定事件：assign
  assignBtn.addEventListener('click', async () => {
    const groupName = groupSelect.value;
    const roleName = roleSelect.value;

    try {
      const res = await fetch('/api/group/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: groupName, role: roleName }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`已成功將角色 ${roleName} 指派給群組 ${groupName}`);
        await updateUserSnippet();
      } else {
        alert('指派失敗，請稍後再試。');
      }
    } catch (err) {
      alert('指派角色時發生錯誤: ' + err.message);
    }
  });

  // 綁定事件：revoke
  revokeBtn.addEventListener('click', async () => {
    const groupName = groupSelect.value;
    const roleName = roleSelect.value;

    try {
      const res = await fetch('/api/group/revoke-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: groupName, role: roleName }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`已成功從群組 ${groupName} 移除角色 ${roleName}`);
        await updateUserSnippet();
      } else {
        alert('移除失敗，請稍後再試。');
      }
    } catch (err) {
      alert('移除角色時發生錯誤: ' + err.message);
    }
  });
}


// ==========================
// 🔍 權限檢視頁面渲染
// ==========================
async function renderPermissionsPage() {
  permissionsContainer.innerHTML = '載入中...';
  const iamData = await fetchIAMData();
  const { resources } = iamData;

  permissionsContainer.innerHTML = '';

  for (const resource of resources) {
    const resourceDiv = document.createElement('div');
    resourceDiv.classList.add('resource-block');

    const title = document.createElement('h2');
    title.textContent = resource.name;
    resourceDiv.appendChild(title);

    const permList = document.createElement('ul');

    for (const right of resource.rights) {
      const li = document.createElement('li');
      li.textContent = right.right + ': ';

      const hasPermission = await userAuthorized(currentUser, resource.name, right.right);

      const statusSpan = document.createElement('span');
      statusSpan.textContent = hasPermission ? '✔️' : '❌';
      statusSpan.style.color = hasPermission ? 'green' : 'red';

      li.appendChild(statusSpan);
      permList.appendChild(li);
    }

    resourceDiv.appendChild(permList);
    permissionsContainer.appendChild(resourceDiv);
  }
}

