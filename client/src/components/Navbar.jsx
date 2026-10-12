import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function Navbar() {
  const { user, socket, logout, toast } = useApp();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => { api('/notifications').then(setItems).catch(() => {}); }, []);

  useEffect(() => {
    if (!socket) return;
    const onNote = (n) => { setItems((i) => [n, ...i]); toast(n.text); };
    socket.on('notification', onNote);
    return () => socket.off('notification', onNote);
  }, [socket, toast]);

  const toggle = async () => {
    setOpen(!open);
    if (!open && unread) {
      await api('/notifications/read', { method: 'POST' }).catch(() => {});
      setTimeout(() => setItems((i) => i.map((n) => ({ ...n, read: true }))), 1500);
    }
  };

  return (
    <nav className="nav">
      <Link to="/" className="brand">TaskFlow</Link>
      <div className="nav-right">
        <div className="bell-wrap">
          <button className="bell" onClick={toggle} aria-label={`Notifications, ${unread} unread`}>
            🔔{unread > 0 && <span className="badge">{unread}</span>}
          </button>
          {open && (
            <div className="dropdown">
              {items.length === 0 && <p className="muted pad">Nothing yet. Assignments and comments show up here.</p>}
              {items.map((n) => (
                <button key={n._id} className={`note ${n.read ? '' : 'unread'}`} onClick={() => { setOpen(false); n.project && nav(`/projects/${n.project}`); }}>
                  {n.text}<small>{new Date(n.createdAt).toLocaleString()}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="avatar" title={user.email}>{user.name[0]}</span>
        <button className="link" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}
