import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function Dashboard() {
  const { user, toast } = useApp();
  const [projects, setProjects] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [open, setOpen] = useState(false);

  useEffect(() => { api('/projects').then(setProjects).catch((e) => toast(e.message)); }, [toast]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const p = await api('/projects', { method: 'POST', body: form });
      setProjects([p, ...projects]);
      setForm({ name: '', description: '' }); setOpen(false);
    } catch (err) { toast(err.message); }
  };

  return (
    <main className="page">
      <header className="page-head">
        <div><h2>Hi {user.name.split(' ')[0]}, your projects</h2></div>
        <button className="btn primary" onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'New project'}</button>
      </header>

      {open && (
        <form className="panel new-project" onSubmit={create}>
          <input autoFocus placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="What is this project about? (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn primary">Create project</button>
        </form>
      )}

      {projects === null ? <p className="muted">Loading projects…</p> : projects.length === 0 ? (
        <p className="empty">No projects yet. Create one to get your first board.</p>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link key={p._id} to={`/projects/${p._id}`} className="project-card">
              <h3>{p.name}</h3>
              <p>{p.description || 'No description'}</p>
              <div className="avatars">
                {p.members.slice(0, 5).map((m) => <span key={m._id} className="avatar" title={m.name}>{m.name[0]}</span>)}
                <small>{p.members.length} member{p.members.length > 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
