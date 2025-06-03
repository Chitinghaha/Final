// =============================================//

// UI

// Basic UI interaction
const snippet = document.querySelector('.home code:last-of-type')
const template = document.querySelector('author-cycle')
const userList = document.querySelector('header > select[name="user"]')

const currentUser = 'John Doe'

const userAuthorized = async (userName, resource, permission) =>
  await fetch('/api/user/authorized', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: userName, resource: resource, permission: permission })
  })
    .then(res => res.json()).then(data => data.data);

const userTrace = async (userName, resource, permission) =>
  await fetch('/api/user/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: userName, resource: resource, permission: permission })
  })
    .then(res => res.json()).then(data => data.data);

document.querySelectorAll('header a').forEach(link => {
  link.addEventListener('click', async evt => {
    if (!evt.target.getAttribute('selected')) {
      evt.preventDefault()

      let displaySection = evt.target.getAttribute('id')

      let resource = displaySection !== 'home' ? 'blog' : 'home'
      let permission = displaySection === 'editor' ? 'edit' : 'view'

      if (!await userAuthorized(currentUser, resource, permission)) {
        alert(`Sorry ${currentUser}, you aren't authorized to see that section.\n\n${(await userTrace(currentUser, resource, permission)).description}`)
        return
      }

      try {
        console.log(`Checking if ${currentUser} has "${permission}" right on the "${resource}" resource.`)
        console.log((await userTrace(currentUser, resource, permission)).description)
      } catch (e) {
        console.error(e)
        console.log(resource, permission)
        console.log(await userTrace(currentUser, resource, permission))
      }

      template.show(`.${displaySection}`)
    }
  })
})

userList.addEventListener('change', evt => {
  currentUser = IAM.users[parseInt(evt.target.selectedOptions[0].value, 10)]
  snippet.innerHTML = userData()
})

IAM.users.forEach((user, index) => {
  userList.insertAdjacentHTML('beforeend', `<option value="${index}">${user.name}</option>`)
})

let userData = () => {
  return JSON.stringify(currentUser.data, null, 2).trim()
    + '\n\n// Rights\n' + JSON.stringify(currentUser.data.rights ?? {}, null, 2).trim()

}

snippet.innerHTML = userData()

const resourceTable = document.querySelector('.resources table')
IAM.resources.forEach(resource => {
  const rightElements = resource.data.rights.map((priv) =>
    `<span class="permission_${priv.granted ? 'granted' : 'denied'}">${priv.right}</span>`
  );

  resourceTable.insertAdjacentHTML('beforeend', `<tr><td>${resource.name}</td><td>${rightElements.join(', ')}</td></tr>`)
})


const roleTable = document.querySelector('.roles table tbody')
IAM.roles.forEach(role => {
  const rightElements = Object.entries(role.data.rights)
    .map(([resource, rights]) =>
      rights.map(priv =>
        `<div class="permission_${priv.granted ? 'granted' : 'denied'}">
          ${resource}: ${priv.right}
        </div>`
      ).join("")
    )

  roleTable.insertAdjacentHTML(
    'beforeend',
    `<tr><td class="role_${role.name}">${role.name}</td><td>${rightElements.join("\n")}</td></tr>`
  )
})


const groupTable = document.querySelector('.groups table tbody')
IAM.groups.forEach(group => {
  groupTable.insertAdjacentHTML('beforeend', `<tr><td>${group.name}</td><td>${group.roleList.join('<br/>')}</td><td>${group.members.map(m => m.name + (m instanceof Group ? ' (group)' : '')).join('<br/>')}</td></tr>`)
})
