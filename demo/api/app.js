import { IAM } from '../../src/index.js';
import { DEMO_SETUP, MONGO_URI } from './config.js';

import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

export const app = express();

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const wildcardOrArrStringValidator = (value) => (
  value === '*' ||
  (Array.isArray(value) && value.every(item => typeof item === 'string'))
);

const rightValidate = {
  validator: (value) => {
    for (const v of value.values()) {
      if (!wildcardOrArrStringValidator(v)) {
        return false;
      }
    }
    return true;
  },
  message: props => `Each rule value must be a string or an array of strings. Got: ${JSON.stringify(props.value)}`
}

const resourceSchema = new mongoose.Schema({
  name: String,
  rights: {
    type: mongoose.Schema.Types.Mixed,
    validate: wildcardOrArrStringValidator,
  }
}, { timestamps: true });
const ResourceModel = mongoose.model('Resource', resourceSchema);

const everyoneSchema = new mongoose.Schema({
  rules: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    validate: rightValidate,
  }
}, { timestamps: true });
const EveryoneModel = mongoose.model('Everyone', everyoneSchema);

const roleSchema = new mongoose.Schema({
  name: String,
  rights: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    validate: rightValidate,
  }
}, { timestamps: true });
const RoleModel = mongoose.model('Role', roleSchema);

const userSchema = new mongoose.Schema({
  name: String,
  roles: [String],
}, { timestamps: true });
const UserModel = mongoose.model('User', userSchema);

const userRoleSchema = new mongoose.Schema({
  user: String,
  role: String,
}, { timestamps: true });
const UserRoleModel = mongoose.model('UserRole', userRoleSchema);

const groupSchema = new mongoose.Schema({
  name: String,
}, { timestamps: true });
const GroupModel = mongoose.model('Group', groupSchema);

const groupRoleSchema = new mongoose.Schema({
  group: String,
  role: String,
}, { timestamps: true });
const GroupRoleModel = mongoose.model('GroupRole', groupRoleSchema);

const groupUserSchema = new mongoose.Schema({
  group: String,
  user: String,
}, { timestamps: true });
const GroupUserModel = mongoose.model('GroupUser', groupUserSchema);

const explicitUserRightSchema = new mongoose.Schema({
  user: String,
  resource: String,
  right: [String],
}, { timestamps: true });
const ExplicitUserRightModel = mongoose.model('ExplicitUserRight', explicitUserRightSchema);

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadFromDatabase = async () => {
  (await ResourceModel.find()).forEach(({ name, rights }) => IAM.createResource({ [name]: rights }));

  (await EveryoneModel.find()).forEach(({ rules: r }) => { r.entries().forEach(([name, rights]) => IAM.everyone({ [name]: rights })) });

  (await RoleModel.find())
    .filter(({ name }) => name !== 'everyone')
    .forEach(({ name, rights }) => IAM.createRole(name, Object.fromEntries(rights)));

  UserModel
  UserRoleModel
  GroupModel
  GroupRoleModel
  GroupUserModel
  ExplicitUserRightModel
}

export const writeToDatabase = async () => {
  await ResourceModel.deleteMany();
  await ResourceModel.insertMany(IAM.data.resources);

  await EveryoneModel.deleteMany();
  await EveryoneModel.insertMany({
    rules: IAM.configuration.roles.find(({ name }) => name === 'everyone').rights
  });

  // console.dir(IAM.data.roles, {depth: null});
  await RoleModel.deleteMany();
  await RoleModel.insertMany(IAM.data.roles);

  UserModel
  UserRoleModel
  GroupModel
  GroupRoleModel
  GroupUserModel
  ExplicitUserRightModel
}

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
    const adminUser = IAM.createUser()
    adminUser.name = 'Almighty Blogmaster'
    adminUser.assign('administrator_role')

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

(async () => {
  if (DEMO_SETUP) {
    setupDemo();
  } else {
    await loadFromDatabase();
  }
})();
