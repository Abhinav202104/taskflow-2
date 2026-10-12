import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function TaskModal({ task, members, columns, onClose }) {
  const { socket, toast } = useApp();
  const [form, setForm] = useState({
    title: task.title, description: task.description || '',
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
  });
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => { api(`/tasks/${task._id}/comments`).then(setComments).catch((e) => toast(e.message)); }, [task._id, toast]);

  // live comments from teammates
  useEffect(() => {
    if (!socket) return;
    const onComment = ({ taskId, comment }) => {
      if (taskId === task._id) setComments((c) => (c.some((x) => x._id === comment._id) ? c : [...c, comment]));
    };
    socket.on('comment:created', onComment);
    return () => socket.off('comment:created', onComment);
  }, [socket, task._id]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const patch = (body) => api(`/tasks/${task._id}`, { method: 'PATCH', body }).catch((e) => toast(e.message));

  const postComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api(`/tasks/${task._id}/comments`, { method: 'POST', body: { text } }); setText(''); }
    catch (err) { toast(err.message); }
  };

  const remove = async () => {
    if (!confirm('Delete this task?')) return;
    try { await api(`/tasks/${task._id}`, { method: 'DELETE' }); onClose(); } catch (err) { toast(err.message); }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-main">
          <input className="title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            onBlur={() => form.title.trim() && form.title !== task.title && patch({ title: form.title })} />
          <label>Description
            <textarea rows={4} placeholder="Add more detail…" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => form.description !== (task.description || '') && patch({ description: form.description })} />
          </label>

          <h4>Comments</h4>
          <div className="comments">
            {comments.length === 0 && <p className="muted">No comments yet. Start the conversation.</p>}
            {comments.map((c) => (
              <div key={c._id} className="comment">
                <span className="avatar sm">{c.author?.name?.[0]}</span>
                <div><b>{c.author?.name}</b> <small>{new Date(c.createdAt).toLocaleString()}</small><p>{c.text}</p></div>
              </div>
            ))}
          </div>
          <form onSubmit={postComment} className="comment-form">
            <input placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn primary">Comment</button>
          </form>
        </div>

        <aside className="modal-side">
          <label>Status
            <select value={task.status} onChange={(e) => patch({ status: e.target.value })}>
              {columns.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Assignee
            <select value={task.assignee?._id || ''} onChange={(e) => patch({ assignee: e.target.value || null })}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </label>
          <label>Priority
            <select value={task.priority} onChange={(e) => patch({ priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </label>
          <label>Due date
            <input type="date" value={form.dueDate} onChange={(e) => { setForm({ ...form, dueDate: e.target.value }); patch({ dueDate: e.target.value || null }); }} />
          </label>
          <button className="btn danger" onClick={remove}>Delete task</button>
        </aside>
      </div>
    </div>
  );
}
