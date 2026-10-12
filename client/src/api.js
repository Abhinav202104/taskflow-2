import { io } from 'socket.io-client';

export const getToken = () => localStorage.getItem('token');

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

let socket;
export function connectSocket() {
  socket?.disconnect();
  socket = io({ auth: { token: getToken() } });
  return socket;
}
export const getSocket = () => socket;
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };
