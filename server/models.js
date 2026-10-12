import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
}, { timestamps: true }));

export const Project = model('Project', new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  owner: ref('User'),
  members: [ref('User')],
  columns: { type: [String], default: ['To Do', 'In Progress', 'Done'] },
}, { timestamps: true }));

export const Task = model('Task', new Schema({
  project: { ...ref('Project'), index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: String,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assignee: { ...ref('User'), default: null },
  createdBy: ref('User'),
  dueDate: Date,
}, { timestamps: true }));

export const Comment = model('Comment', new Schema({
  task: { ...ref('Task'), index: true },
  author: ref('User'),
  text: { type: String, required: true },
}, { timestamps: true }));

export const Notification = model('Notification', new Schema({
  user: { ...ref('User'), index: true },
  project: ref('Project'),
  text: String,
  read: { type: Boolean, default: false },
}, { timestamps: true }));
