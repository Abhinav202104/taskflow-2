import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, getToken, connectSocket, disconnectSocket } from './api.js';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Board from './pages/Board.jsx';
import Navbar from './components/Navbar.jsx';

const Ctx = createContext();
export const useApp = () => useContext(Ctx);

export default function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [ready, setReady] = useState(false);

  const toast = useCallback((text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const login = ({ token, user }) => {
    localStorage.setItem('token', token);
    setUser(user);
    setSocket(connectSocket());
  };
  const logout = () => {
    localStorage.removeItem('token');
    disconnectSocket();
    setUser(null);
    setSocket(null);
  };

  useEffect(() => {
    if (!getToken()) return setReady(true);
    api('/auth/me')
      .then(({ user }) => { setUser(user); setSocket(connectSocket()); })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Ctx.Provider value={{ user, socket, toast, logout, login }}>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Auth />} />
        <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/projects/:id" element={user ? <Board /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}
