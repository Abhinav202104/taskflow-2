import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function Auth() {
  const { login } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { login(await api(`/auth/${mode}`, { method: 'POST', body: form })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="auth-intro">
        <h1>TaskFlow</h1>
        <p>Plan the work, hand it off, and watch it move across the board while your team is still talking about it.</p>
        <div className="mini-board" aria-hidden="true">
          <div><i /><i className="w" /></div><div><i /></div><div><i /><i /><i className="w" /></div>
        </div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
        {mode === 'register' && <input placeholder="Full name" value={form.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input type="password" placeholder="Password (6+ characters)" value={form.password} onChange={set('password')} required minLength={6} />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
