import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import TaskModal from '../components/TaskModal.jsx';

const PRIORITY = { high: 'High', medium: 'Medium', low: 'Low' };

export default function Board() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, socket, toast } = useApp();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);   // task id open in modal
  const [dragOver, setDragOver] = useState(null);
  const [adding, setAdding] = useState(null);        // column name with open "add" form
  const [title, setTitle] = useState('');
  const [invite, setInvite] = useState('');
  const [filter, setFilter] = useState('all');

  // Initial load
  useEffect(() => {
    Promise.all([api(`/projects/${id}`), api(`/projects/${id}/tasks`)])
      .then(([p, t]) => { setProject(p); setTasks(t); })
      .catch((e) => { toast(e.message); nav('/'); });
  }, [id, nav, toast]);

  // Real-time board sync
  useEffect(() => {
    if (!socket) return;
    socket.emit('project:join', id);
    const upsert = (t) => setTasks((ts) => (ts.some((x) => x._id === t._id) ? ts.map((x) => (x._id === t._id ? t : x)) : [...ts, t]));
    socket.on('task:created', upsert);
    socket.on('task:updated', upsert);
    socket.on('task:deleted', ({ id: tid }) => setTasks((ts) => ts.filter((x) => x._id !== tid)));
    socket.on('project:updated', setProject);
    return () => {
      socket.emit('project:leave', id);
      ['task:created', 'task:updated', 'task:deleted', 'project:updated'].forEach((e) => socket.off(e));
    };
  }, [socket, id]);

  const addTask = async (e, status) => {
    e.preventDefault();
    if (!title.trim()) return;
    try { await api(`/projects/${id}/tasks`, { method: 'POST', body: { title, status } }); setTitle(''); setAdding(null); }
    catch (err) { toast(err.message); }
  };

  const move = async (taskId, status) => {
    const t = tasks.find((x) => x._id === taskId);
    if (!t || t.status === status) return;
    setTasks((ts) => ts.map((x) => (x._id === taskId ? { ...x, status } : x)));   // optimistic
    try { await api(`/tasks/${taskId}`, { method: 'PATCH', body: { status } }); }
    catch (err) { toast(err.message); setTasks((ts) => ts.map((x) => (x._id === taskId ? t : x))); }
  };

  const addMember = async (e) => {
    e.preventDefault();
    try { setProject(await api(`/projects/${id}/members`, { method: 'POST', body: { email: invite } })); setInvite(''); toast('Member added'); }
    catch (err) { toast(err.message); }
  };

  const removeProject = async () => {
    if (!confirm('Delete this project and all its tasks?')) return;
    try { await api(`/projects/${id}`, { method: 'DELETE' }); nav('/'); } catch (err) { toast(err.message); }
  };

  if (!project) return <p className="muted page">Loading board…</p>;
  const visible = tasks.filter((t) => filter === 'all' || (filter === 'mine' ? t.assignee?._id === user.id : true));
  const selectedTask = tasks.find((t) => t._id === selected);

  return (
    <main className="board-page">
      <header className="board-head">
        <div>
          <h2>{project.name}</h2>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
        <div className="board-tools">
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All tasks</button>
            <button className={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>Assigned to me</button>
          </div>
          <div className="avatars">{project.members.map((m) => <span key={m._id} className="avatar" title={`${m.name} (${m.email})`}>{m.name[0]}</span>)}</div>
          <form className="invite" onSubmit={addMember}>
            <input type="email" placeholder="Invite by email" value={invite} onChange={(e) => setInvite(e.target.value)} required />
            <button className="btn">Add</button>
          </form>
          {project.owner === user.id && <button className="btn danger" onClick={removeProject}>Delete project</button>}
        </div>
      </header>

      <div className="columns">
        {project.columns.map((col) => {
          const list = visible.filter((t) => t.status === col);
          return (
            <section
              key={col}
              className={`column ${dragOver === col ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); move(e.dataTransfer.getData('text/plain'), col); }}
            >
              <h3>{col} <span className="count">{list.length}</span></h3>
              <div className="cards">
                {list.map((t) => (
                  <article
                    key={t._id} className={`card p-${t.priority}`} draggable tabIndex={0}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t._id)}
                    onClick={() => setSelected(t._id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(t._id)}
                  >
                    <p>{t.title}</p>
                    <div className="card-meta">
                      <span className={`chip ${t.priority}`}>{PRIORITY[t.priority]}</span>
                      {t.dueDate && <span className="due">{new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                      {t.assignee && <span className="avatar sm" title={t.assignee.name}>{t.assignee.name[0]}</span>}
                    </div>
                  </article>
                ))}
                {list.length === 0 && <p className="drop-hint">Drop a task here</p>}
              </div>
              {adding === col ? (
                <form onSubmit={(e) => addTask(e, col)} className="add-form">
                  <input autoFocus placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setAdding(null)} />
                  <div><button className="btn primary sm">Add task</button> <button type="button" className="link" onClick={() => setAdding(null)}>Cancel</button></div>
                </form>
              ) : (
                <button className="add-btn" onClick={() => { setAdding(col); setTitle(''); }}>+ Add task</button>
              )}
            </section>
          );
        })}
      </div>

      {selectedTask && (
        <TaskModal task={selectedTask} members={project.members} columns={project.columns} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
