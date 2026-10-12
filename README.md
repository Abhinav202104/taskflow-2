# TaskFlow – MERN Project Management Tool

Trello/Asana-style collaboration app: auth, projects, Kanban boards, task assignment, comments, real-time updates + notifications (Socket.IO).

## Run
1. `cp server/.env.example server/.env` (set MONGO_URI and JWT_SECRET)
2. `npm install && npm run install:all`
3. `npm run dev` → client http://localhost:5173, API http://localhost:5000

Open two browsers with two accounts, add the second user to a project by email, assign a task – the notification appears instantly.

## Architecture (interview notes)
- **Auth**: bcrypt-hashed passwords, JWT (7d) sent as Bearer token; same JWT authenticates the socket handshake.
- **Models**: User, Project (members[], columns[]), Task, Comment, Notification.
- **Authorization**: every project/task/comment route checks the user is a project member.
- **Real-time**: socket rooms `user:<id>` (personal notifications) and `project:<id>` (live board sync).
- **UI**: native HTML5 drag-and-drop between columns, task modal with comments, notification bell + toasts.
