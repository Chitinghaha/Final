import express from 'express'
import http from 'http'
import api from '@butlerlogic/common-api'
import IAM, { Resource, Role, Group, User, Right } from '../../../src/index.js'

// Setup Express
const app = express()
app.use(express.json()) // 解析 JSON body

// In-memory user store
const users = {}

// Create IAM System Resources & Rights
IAM.createResource('blog', ['create', 'read', 'update', 'delete', 'list'])

// Identify rights associated with all users of the system.
IAM.everyone({
  blog: ['read', 'list']
})

// Create a blog "master" role granting access to all blog resources.
IAM.createRole('blogmaster', { blog: 'allow:*' })

// Create an administrators group and assign it master rights.
const adminGroup = IAM.createGroup('administrators')
adminGroup.assign('blogmaster')

// 註冊新使用者
app.post('/register', (req, res) => {
  const { username, password, groups } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }
  if (users[username]) {
    return res.status(409).json({ error: 'User already exists' })
  }

  users[username] = {
    password,
    groups: Array.isArray(groups) ? groups : []
  }

  res.status(201).json({ message: 'User registered' })
})

// Create an HTTP authorization method.
// Authenticate username/password from in-memory store
// Authorize with IAM according to groups
let requireAuthorization = (resource, right) => {
  return api.basicauth((username, password, grant, deny) => {
    const userRecord = users[username]
    if (!userRecord || userRecord.password !== password) {
      return deny()
    }

    const user = new User()
    // 加入群組讓 IAM 可以授權
    userRecord.groups.forEach(groupName => user.join(groupName))

    if (user.authorized(resource, right)) {
      grant()
    } else {
      deny()
    }
  })
}

api.applyCommonConfiguration(app) // Creates /ping, /version, and /info endpoints.

// Restricted Endpoints
app.get('/blogs', requireAuthorization('blog', 'list'), api.reply({ blogs: [{title: 'Title A', article: '...'}, {title: 'Title B', article: '...'}]}))
app.get('/blog/:id', requireAuthorization('blog', 'read'), api.reply({ title: 'Title', article: '...'}))
app.post('/blog/:id', requireAuthorization('blog', 'create'), api.CREATED)
app.put('/blog/:id', requireAuthorization('blog', 'update'), api.OK)
app.delete('/blog/:id', requireAuthorization('blog', 'delete'), api.OK)

// Fallback endpoint
app.get('/', api.OK)

// Launch the server
let server = http.createServer(app).listen(8100, () => console.log(`Server available at http://localhost:${server.address().port}`))
