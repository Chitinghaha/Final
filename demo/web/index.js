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

// 當 admin 選擇使用者時更新權限顯示
adminUserSelect.addEventListener('change', async (e) => {
  adminSelectedUser = e.target.value;
  await renderAdminPermissionsPage();
});

// API 調用
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

// 切換 header 選單樣式
const setSelectedHeader = (selectedId) => {
  headerLinks.forEach(link => {
    if (link.id === selectedId) {
      link.setAttribute('selected', '');
    } else {
      link.removeAttribute('selected');
    }
  });
};

// 點擊 header 欄位事件處理
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

    // 其他頁面權限判斷
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

// 使用者選單綁定事件
userList.addEventListener('change', async evt => {
  currentUser = evt.target.value;
  await updateUserSnippet();

  // 如果目前在 permissions 頁，刷新
  if (document.querySelector('author-cycle > section.permissions[selected]')) {
    await renderPermissionsPage();
  }
});

// 渲染 IAM 資料
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
        perms
          .map(
            (priv) =>
              `<div class="permission_${priv.granted ? 'granted' : 'denied'}">${resource}: ${priv.right}</div>`
          )
          .join('')
      )
      .join('');
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

// 新增：載入 Admin User List
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

// Admin 頁面渲染與即時更新（含三下拉選單與儲存按鈕）
async function renderAdminPermissionsPage() {
  adminPermissionsContainer.innerHTML = '載入中...';
  const iamData = await fetchIAMData();
  const { resources } = iamData;
  const userName = adminSelectedUser;

  adminPermissionsContainer.innerHTML = '';

  // 建立 resource 下拉選單
  const resourceSelect = document.createElement('select');
  resourceSelect.id = 'admin-resource-select';

  resources.forEach(res => {
    const option = document.createElement('option');
    option.value = res.name;
    option.textContent = res.name;
    resourceSelect.appendChild(option);
  });

  adminPermissionsContainer.appendChild(resourceSelect);

  // 建立 rights 下拉選單（依 resource 動態更新）
  const rightSelect = document.createElement('select');
  rightSelect.id = 'admin-right-select';
  adminPermissionsContainer.appendChild(rightSelect);

  // allow/deny 下拉選單
  const allowDenySelect = document.createElement('select');
  allowDenySelect.id = 'admin-allow-deny-select';

  const allowOption = document.createElement('option');
  allowOption.value = 'allow';
  allowOption.textContent = 'allow';

  const denyOption = document.createElement('option');
  denyOption.value = 'deny';
  denyOption.textContent = 'deny';

  allowDenySelect.appendChild(allowOption);
  allowDenySelect.appendChild(denyOption);
  adminPermissionsContainer.appendChild(allowDenySelect);

  // 儲存按鈕
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '儲存';
  adminPermissionsContainer.appendChild(saveBtn);

  // 當切換 resource 時，更新 rights 下拉選單
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

    // 更新 allow/deny 狀態
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

  // 頁面初始載入時，設定初始選項並取得權限狀態
  if (resources.length > 0) {
    resourceSelect.value = resources[0].name;
    await updateRightsOptions(resources[0].name);
  }

  // 儲存按鈕事件
  saveBtn.addEventListener('click', async () => {
    const resourceName = resourceSelect.value;
    const rightName = rightSelect.value;
    const value = allowDenySelect.value;

    try {
      const res = await fetch('/api/user/set-right', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName,
          resource: resourceName,
          right: rightName,
          value
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text(); // 把錯誤內容印出來
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

}

// 渲染使用者權限頁面
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
