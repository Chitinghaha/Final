let currentUser = 'John Doe';

const snippet = document.querySelector('.home code:last-of-type');
const template = document.querySelector('author-cycle');
const userList = document.querySelector('header > select[name="user"]');

// API 調用
const fetchIAMData = async () => (await fetch('/api/iam-data')).json();
const userAuthorized = async (userName, resource, permission) =>
  (await fetch('/api/user/authorized', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, resource, permission })
  })).json().then(res => res.data);

const userTrace = async (userName, resource, permission) =>
  (await fetch('/api/user/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, resource, permission })
  })).json().then(res => res.data);

// 動態 UI 行為
document.querySelectorAll('header a').forEach(link => {
  link.addEventListener('click', async evt => {
    if (!evt.target.getAttribute('selected')) {
      evt.preventDefault();

      const displaySection = evt.target.getAttribute('id');
      const resource = displaySection !== 'home' ? 'blog' : 'home';
      const permission = displaySection === 'editor' ? 'edit' : 'view';

      const authorized = await userAuthorized(currentUser, resource, permission);
      const trace = await userTrace(currentUser, resource, permission);

      if (!authorized) {
        alert(`Sorry ${currentUser}, you aren't authorized to see that section.\n\n${trace.description}`);
        return;
      }

      console.log(`Checking if ${currentUser} has "${permission}" on "${resource}".`);
      console.log(trace.description);

      template.show(`.${displaySection}`);
    }
  });
});

// 初始載入 IAM 資料
const renderIAM = async () => {
  const res = await fetchIAMData();
  const { roles, groups, users, resources } = res;

  // 角色
  const roleTable = document.querySelector('.roles table tbody');
  roles.forEach(role => {
    const rights = Object.entries(role.rights)
      .map(([resource, perms]) =>
        perms.map(priv => `<div class="permission_${priv.granted ? 'granted' : 'denied'}">${resource}: ${priv.right}</div>`).join('')
      ).join('');

    roleTable.insertAdjacentHTML('beforeend', `<tr><td>${role.name}</td><td>${rights}</td></tr>`);
  });

  // 群組
  const groupTable = document.querySelector('.groups table tbody');
  groups.forEach(group => {
    const rolesHTML = group.roles.join('<br/>');
    const membersHTML = group.members.map(m => m.name).join('<br/>');
    groupTable.insertAdjacentHTML('beforeend', `<tr><td>${group.name}</td><td>${rolesHTML}</td><td>${membersHTML}</td></tr>`);
  });

  // 使用者
  users.forEach((user, index) => {
    userList.insertAdjacentHTML('beforeend', `<option value="${user.name}" ${user.name === currentUser ? 'selected' : ''}>${user.name}</option>`);
  });

  // 切換使用者
  userList.addEventListener('change', async evt => {
    currentUser = evt.target.value;
    await updateUserSnippet();
  });

  // 資源
  const resourceTable = document.querySelector('.resources table');
  resources.forEach(resource => {
    const rights = resource.rights.map(priv =>
      `<span class="permission_${priv.granted ? 'granted' : 'denied'}">${priv.right}</span>`
    ).join(', ');
    resourceTable.insertAdjacentHTML('beforeend', `<tr><td>${resource.name}</td><td>${rights}</td></tr>`);
  });

  await updateUserSnippet();
};

// 顯示目前使用者資料
const updateUserSnippet = async () => {
  const res = await fetchIAMData();
  const user = res.users.find(u => u.name === currentUser);
  snippet.innerHTML = JSON.stringify(user, null, 2);
};

renderIAM();
