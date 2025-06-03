let currentUser = 'John Doe';
let iamCache = null;

const snippet = document.querySelector('.home code');
const template = document.querySelector('author-cycle');
const userList = document.querySelector('header > select[name="user"]');
const headerLinks = document.querySelectorAll('header a');
const permissionsContainer = document.querySelector('.permissions .permissions-container');

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

// 點擊 header 欄位時增加判斷
headerLinks.forEach(link => {
  link.addEventListener('click', async evt => {
    evt.preventDefault();
    const displaySection = evt.target.id;

    if (displaySection === 'permissions') {
      const authorized = await userAuthorized(currentUser, 'permissions', 'view'); // 或 'edit'
      // if (!authorized) {
      //   const trace = await userTrace(currentUser, 'permissions', 'view');
      //   alert(`抱歉，${currentUser}，您沒有權限瀏覽此區域。\n\n${trace.description || ''}`);
      //   return;
      // }

      await renderPermissionsPage();
      template.show('.permissions');
      setSelectedHeader('permissions');
      return;
    }

    // 既有邏輯...
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

// 使用者選單綁定一次事件
userList.addEventListener('change', async evt => {
  currentUser = evt.target.value;
  await updateUserSnippet();
});

// 渲染 IAM 資料
const renderIAM = async () => {
  const res = await fetchIAMData();
  const { roles, groups, users, resources } = res;

  // 清空表格
  document.querySelector('.roles table tbody').innerHTML = '';
  document.querySelector('.groups table tbody').innerHTML = '';
  document.querySelector('.resources table tbody').innerHTML = '';
  userList.innerHTML = '';

  // 角色
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

  // 群組
  groups.forEach(group => {
    const rolesHTML = group.roles.join('<br/>');
    const membersHTML = group.members.map(m => m.name).join('<br/>');
    document.querySelector('.groups table tbody').insertAdjacentHTML('beforeend', `<tr><td>${group.name}</td><td>${rolesHTML}</td><td>${membersHTML}</td></tr>`);
  });

  // 資源
  resources.forEach(resource => {
    const rights = resource.rights
      .map(priv => `<span class="permission_${priv.granted ? 'granted' : 'denied'}">${priv.right}</span>`)
      .join(', ');
    document.querySelector('.resources table tbody').insertAdjacentHTML('beforeend', `<tr><td>${resource.name}</td><td>${rights}</td></tr>`);
  });

  // 使用者清單
  users.forEach(user => {
    userList.insertAdjacentHTML('beforeend', `<option value="${user.name}" ${user.name === currentUser ? 'selected' : ''}>${user.name}</option>`);
  });

  await updateUserSnippet();
};

// 顯示目前使用者資料
const updateUserSnippet = async () => {
  const res = await fetchIAMData();
  const user = res.users.find(u => u.name === currentUser);
  snippet.textContent = JSON.stringify(user, null, 2);
};

renderIAM();

// 渲染 Permissions 頁面
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

      // 呼叫 API 判斷權限
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

// 使用者切換時，若在權限頁面也要更新
userList.addEventListener('change', async evt => {
  currentUser = evt.target.value;
  await updateUserSnippet();

  // 如果目前在 permissions 頁，刷新
  if (document.querySelector('author-cycle > section.permissions[selected]')) {
    await renderPermissionsPage();
  }
});
