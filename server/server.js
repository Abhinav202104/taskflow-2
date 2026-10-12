import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import routes, { getProject } from './routes.js';

const origin = process.env.CLIENT_URL || 'http://localhost:5173';
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin } });

app.use(cors({ origin }));
app.use(express.json());
app.set('io', io);
app.use('/api', routes);

// Socket auth: reuse the same JWT
io.use((socket, next) => {
  try {
    socket.data.userId = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET).id;
    next();
  } catch { next(new Error('unauthorized')); }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);               // personal notifications
  socket.on('project:join', async (pid) => {               // live board updates (members only)
    if (await getProject(pid, socket.data.userId)) socket.join(`project:${pid}`);
  });
  socket.on('project:leave', (pid) => socket.leave(`project:${pid}`));
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`API + sockets on :${port}`));
}).catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
