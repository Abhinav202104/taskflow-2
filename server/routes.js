import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Project, Task, Comment, Notification } from './models.js';

const r = Router();
const same = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);
const h = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ message: e.message }));
const userOut = (u) => ({ id: u._id, name: u.name, email: u.email });
const token = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

export const auth = async (req, res, next) => {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const { id } = jwt.verify(t, process.env.JWT_SECRET);
    req.user = await User.findById(id);
    if (!req.user) throw new Error();
    next();
  } catch { res.status(401).json({ message: 'Please log in again' }); }
};

// Returns the project only if the user is a member
export const getProject = async (id, uid) => {
  const p = await Project.findById(id).populate('members', 'name email');
  return p && p.members.some((m) => same(m, uid)) ? p : null;
};

const notify = async (req, userId, text, project) => {
  if (!userId || same(userId, req.user)) return;
  const n = await Notification.create({ user: userId, text, project });
  req.app.get('io').to(`user:${userId}`).emit('notification', n);
};
const emitProject = (req, pid, event, data) => req.app.get('io').to(`project:${pid}`).emit(event, data);
const populateTask = (q) => q.populate('assignee', 'name email');

/* ---------- Auth ---------- */
r.post('/auth/register', h(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ message: 'Name, email and a 6+ character password are required' });
  if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: token(user), user: userOut(user) });
}));

r.post('/auth/login', h(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    return res.status(401).json({ message: 'Incorrect email or password' });
  res.json({ token: token(user), user: userOut(user) });
}));

r.get('/auth/me', auth, (req, res) => res.json({ user: userOut(req.user) }));

/* ---------- Projects ---------- */
r.get('/projects', auth, h(async (req, res) => {
  res.json(await Project.find({ members: req.user._id }).populate('members', 'name email').sort('-updatedAt'));
}));

r.post('/projects', auth, h(async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Project name is required' });
  const p = await Project.create({
    name: req.body.name, description: req.body.description,
    owner: req.user._id, members: [req.user._id],
  });
  res.status(201).json(await p.populate('members', 'name email'));
}));

r.get('/projects/:id', auth, h(async (req, res) => {
  const p = await getProject(req.params.id, req.user._id);
  p ? res.json(p) : res.status(404).json({ message: 'Project not found' });
}));

r.delete('/projects/:id', auth, h(async (req, res) => {
  const p = await getProject(req.params.id, req.user._id);
  if (!p) return res.status(404).json({ message: 'Project not found' });
  if (!same(p.owner, req.user)) return res.status(403).json({ message: 'Only the owner can delete a project' });
  const tasks = await Task.find({ project: p._id }).select('_id');
  await Comment.deleteMany({ task: { $in: tasks.map((t) => t._id) } });
  await Task.deleteMany({ project: p._id });
  await p.deleteOne();
  res.json({ ok: true });
}));

r.post('/projects/:id/members', auth, h(async (req, res) => {
  const p = await getProject(req.params.id, req.user._id);
  if (!p) return res.status(404).json({ message: 'Project not found' });
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u) return res.status(404).json({ message: 'No user with that email – ask them to sign up first' });
  if (p.members.some((m) => same(m, u))) return res.status(409).json({ message: 'Already a member' });
  p.members.push(u._id);
  await p.save();
  await notify(req, u._id, `${req.user.name} added you to "${p.name}"`, p._id);
  const full = await p.populate('members', 'name email');
  emitProject(req, p._id, 'project:updated', full);
  res.json(full);
}));

/* ---------- Tasks ---------- */
r.get('/projects/:id/tasks', auth, h(async (req, res) => {
  if (!(await getProject(req.params.id, req.user._id))) return res.status(404).json({ message: 'Project not found' });
  res.json(await populateTask(Task.find({ project: req.params.id }).sort('createdAt')));
}));

r.post('/projects/:id/tasks', auth, h(async (req, res) => {
  const p = await getProject(req.params.id, req.user._id);
  if (!p) return res.status(404).json({ message: 'Project not found' });
  if (!req.body.title?.trim()) return res.status(400).json({ message: 'Task title is required' });
  const t = await Task.create({ ...req.body, project: p._id, createdBy: req.user._id, status: req.body.status || p.columns[0] });
  const full = await populateTask(Task.findById(t._id));
  emitProject(req, p._id, 'task:created', full);
  await notify(req, t.assignee, `${req.user.name} assigned you "${t.title}" in ${p.name}`, p._id);
  res.status(201).json(full);
}));

r.patch('/tasks/:id', auth, h(async (req, res) => {
  const t = await Task.findById(req.params.id);
  const p = t && (await getProject(t.project, req.user._id));
  if (!p) return res.status(404).json({ message: 'Task not found' });
  const prevAssignee = t.assignee;
  for (const k of ['title', 'description', 'status', 'priority', 'assignee', 'dueDate'])
    if (k in req.body) t[k] = req.body[k] || (k === 'description' ? '' : null);
  await t.save();
  const full = await populateTask(Task.findById(t._id));
  emitProject(req, p._id, 'task:updated', full);
  if (t.assignee && !same(t.assignee, prevAssignee))
    await notify(req, t.assignee, `${req.user.name} assigned you "${t.title}" in ${p.name}`, p._id);
  res.json(full);
}));

r.delete('/tasks/:id', auth, h(async (req, res) => {
  const t = await Task.findById(req.params.id);
  const p = t && (await getProject(t.project, req.user._id));
  if (!p) return res.status(404).json({ message: 'Task not found' });
  await Comment.deleteMany({ task: t._id });
  await t.deleteOne();
  emitProject(req, p._id, 'task:deleted', { id: t._id });
  res.json({ ok: true });
}));

/* ---------- Comments ---------- */
r.get('/tasks/:id/comments', auth, h(async (req, res) => {
  const t = await Task.findById(req.params.id);
  if (!t || !(await getProject(t.project, req.user._id))) return res.status(404).json({ message: 'Task not found' });
  res.json(await Comment.find({ task: t._id }).populate('author', 'name').sort('createdAt'));
}));

r.post('/tasks/:id/comments', auth, h(async (req, res) => {
  const t = await Task.findById(req.params.id);
  const p = t && (await getProject(t.project, req.user._id));
  if (!p) return res.status(404).json({ message: 'Task not found' });
  if (!req.body.text?.trim()) return res.status(400).json({ message: 'Comment can\'t be empty' });
  const c = await (await Comment.create({ task: t._id, author: req.user._id, text: req.body.text })).populate('author', 'name');
  emitProject(req, p._id, 'comment:created', { taskId: t._id, comment: c });
  const msg = `${req.user.name} commented on "${t.title}"`;
  await notify(req, t.assignee, msg, p._id);
  if (!same(t.createdBy, t.assignee)) await notify(req, t.createdBy, msg, p._id);
  res.status(201).json(c);
}));

/* ---------- Notifications ---------- */
r.get('/notifications', auth, h(async (req, res) => {
  res.json(await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30));
}));
r.post('/notifications/read', auth, h(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
}));

export default r;
