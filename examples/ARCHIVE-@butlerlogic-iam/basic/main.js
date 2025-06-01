import IAM, { Resource, Role, Group, User, Right } from 'https://cdn.jsdelivr.net/npm/@author.io/iam/index.min.js'
// import IAM from '../../src/index.js'

// Define the system components
IAM.createResource({
  home: ['view'],
  blog: ['view', 'edit']
})

// console.log(IAM.resources)

// Set defaults. Allow users to view the home
// and blog tabs, but deny access to the administrator.
IAM.everyone({
  home: '*',
  blog: ['view', 'deny:edit']
})

// Create an admin role
IAM.createRole('administrator_role', {
  blog: ['allow:edit']
})

// Create a basic user
let basicUser = new User()

// Optionally give the user a descriptive name.
basicUser.name = 'John Doe'

// Create an admin user
let adminUser = new User()
adminUser.name = 'Almighty Blogmaster'

// Assign the admin user to the administrator role.
// adminUser.assign('administrator_role')

window.currentUser = basicUser

// =============================================//

// Groups
let adminGroup = IAM.createGroup('administrator')
let groups = IAM.createGroup('writer', 'reader')

IAM.group('writer').add('reader', 'administrator')

adminGroup.assign('administrator_role')
adminUser.join('administrator')

// =============================================//

// UI

// Basic UI interaction
const snippet = document.querySelector('.home code:last-of-type')
const template = document.querySelector('author-cycle')
const userList = document.querySelector('header > select[name="user"]')

document.querySelectorAll('header a').forEach(link => {
  link.addEventListener('click', evt => {
    if (!evt.target.getAttribute('selected')) {
      evt.preventDefault()

      let displaySection = evt.target.getAttribute('id')

      let resource = displaySection !== 'home' ? 'blog' : 'home'
      let permission = displaySection === 'editor' ? 'edit' : 'view'

      if (!currentUser.authorized(resource, permission)) {
        alert(`Sorry ${currentUser.name}, you aren't authorized to see that section.\n\n${currentUser.trace(resource, permission).description}`)
        return
      }

      try {
        console.log(`Checking if ${currentUser.name} has "${permission}" right on the "${resource}" resource.`)
        console.log(currentUser.trace(resource, permission).description)
      } catch (e) {
        console.error(e)
        console.log(resource, permission)
        console.log(currentUser.trace(resource, permission))
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


if (!currentUser) {
  console.warn('currentUser is not defined')
}

let userData = () => {
  const dataStr = JSON.stringify(currentUser?.data ?? {}, null, 2)
  const rightsStr = JSON.stringify(currentUser?.rights ?? {}, null, 2)
  return dataStr.trim() + '\n\n// Rights\n' + rightsStr.trim()
}

// 安全地設定 userData 顯示
if (currentUser) {
  snippet.innerHTML = userData()
} else {
  snippet.innerHTML = '// No user selected'
}

// 修正 resource 權限顯示
const resourceTable = document.querySelector('.resources table')
IAM.resources.forEach(resource => {
  const rights = resource.data.rights
  let rightsStr = ''

  if (Array.isArray(rights)) {
    rightsStr = rights.join(', ')
  } else if (typeof rights === 'object' && rights !== null) {
    rightsStr = Object.entries(rights).map(([k, v]) => `${k}: ${v}`).join(', ')
  } else {
    rightsStr = String(rights)
  }

  resourceTable.insertAdjacentHTML('beforeend',
    `<tr><td>${resource.name}</td><td>${rightsStr}</td></tr>`
  )
})




const roleTable = document.querySelector('.roles table tbody')
IAM.roles.forEach(role => {
  let rights = ''

  Object.entries(role.rights ?? {}).forEach(([resourceName, privileges]) => {
    privileges.forEach(privilege => {
      rights += `<div class="permission_${privilege.allowed ? 'granted' : 'denied'}">${resourceName}: ${privilege.allowed ? 'allowed' : 'denied'}</div>`
    })
  })

  roleTable.insertAdjacentHTML('beforeend', `<tr><td class="role_${role.name}">${role.name}</td><td>${rights}</td></tr>`)
})


const groupTable = document.querySelector('.groups table tbody')
IAM.groups.forEach(group => {
  groupTable.insertAdjacentHTML('beforeend', `<tr>
    <td>${group.name}</td>
    <td>${group.roleList?.join('<br/>') || ''}</td>
    <td>${
      group.members.map(m => {
        const isGroup = m?.roleList !== undefined // Group 通常有 roleList
        return (m?.name || '(unknown)') + (isGroup ? ' (group)' : '')
      }).join('<br/>')
    }</td>
  </tr>`)
})

