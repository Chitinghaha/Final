import { IAM, Group } from '../../src/index.js'

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

export const app = express();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const setupDemo = () => {
    IAM.createResource({
        home: ['view'],
        blog: ['view', 'edit'],
        permissions:['view'],
        admin_settings:['view']
    })

    IAM.everyone({
        home: '*',
        blog: ['view', 'deny:edit'],
        permissions:'*',
        admin_settings:['deny:view']
    })

    IAM.createRole('administrator_role', {
        blog: ['allow:edit'],
        permissions:['allow:view'],
        admin_settings:['allow:view']
    })

    IAM.createRole('blog_role', {
        blog: '*',
    })

    IAM.createRole('admin_settings_role', {
        admin_settings: '*',
    })

    // Create a basic user
    const basicUser = IAM.createUser()
    basicUser.name = 'John Doe'

    const basicUser2 = IAM.createUser()
    basicUser2.name = 'Jim Lin'

    // Create an admin user
    // Assign the admin user to the administrator role.
    // i.e. `adminUser.assign('administrator_role')`
    const adminUser = IAM.createUser('administrator_role')
    adminUser.name = 'Almighty Blogmaster'

    // Groups
    const adminGroup = IAM.createGroup('administrator')
    const groups = IAM.createGroup('writer', 'reader')

    IAM.group('writer').add('reader', 'administrator')

    adminGroup.assign('administrator_role')
    adminUser.join('administrator')


    const userGroup = IAM.createGroup('User')
    userGroup.assign('blog_role')
    basicUser2.join('User')
}

const dumpObject = (obj) => ({
    // enumerable properties
    ...Object.fromEntries(Object.entries(obj)),

    // getters
    ...Object.fromEntries(
        Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(obj)))
            .filter(([_, desc]) => typeof desc.get === 'function')
            .map(([key]) => {
                try {
                    return [key, obj[key]];
                } catch (_) {
                    return null;
                }
            })
            .filter(Boolean)
    )
});

setupDemo();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));

// Routes
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

app.post('/api/user/authorized', (req, res) => {
    const { userName, resource, permission } = req.body;
    const user = IAM.user(userName);
    res.json({ data: user.authorized(resource, permission) });
});

app.post('/api/user/trace', (req, res) => {
    const { userName, resource, permission } = req.body;
    const user = IAM.user(userName);
    res.json({ data: dumpObject(user.trace(resource, permission)) });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`500 - Server Error: ${err.message}`);
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

app.get('/api/iam-data', (req, res) => {
  try {
    const data = {
      users: IAM.users.map(user => ({
        name: user.name,
        roles: user.roles.map(r => r.name),
        groups: user.groups.map(g => g.name)
      })),
      roles: IAM.roles.map(role => ({
        name: role.name,
        description: role.description ?? '',
        rights: Object.fromEntries(
          Object.entries(role.data.rights).map(([resource, rights]) => [
            resource,
            rights.map(priv => ({ right: priv.right, granted: priv.granted }))
          ])
        )
      })),
      groups: IAM.groups.map(group => ({
        name: group.name,
        description: group.description ?? '',
        roles: group.roleList,
        members: group.members.map(m => ({ name: m.name }))
      })),
      resources: IAM.resources.map(resource => ({
        name: resource.name,
        description: resource.description ?? '',
        rights: resource.data.rights.map(priv => ({
          right: priv.right,
          granted: priv.granted
        }))
      }))
    };

    res.json(data);
  } catch (error) {
    console.error('取得 IAM 資料錯誤:', error);
    res.status(500).json({ error: '取得 IAM 資料失敗' });
  }
});


app.post('/api/user/set-right', (req, res) => {
  try {
    const { userName, resource, right, value } = req.body;
    const user = IAM.user(userName);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ex: user.setRight('portal', 'allow:view')
    user.setRight(resource, `${value}:${right}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting single right:', error);
    res.status(500).json({ error: 'Failed to set right' });
  }
});

app.post('/api/group/assign-role', (req, res) => {
  try {
    const { group, role } = req.body; // 建議用與前端一致的 key
    const targetGroup = IAM.group(group);

    if (!targetGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }

    targetGroup.assign(role); // 角色名稱為字串即可

    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning role to group:', error);
    res.status(500).json({ error: 'Failed to assign role to group' });
  }
});

app.post('/api/group/revoke-role', (req, res) => {
  try {
    const { group, role } = req.body;
    const targetGroup = IAM.group(group);

    if (!targetGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }

    targetGroup.revoke(role);

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking role from group:', error);
    res.status(500).json({ error: 'Failed to revoke role from group' });
  }
});









