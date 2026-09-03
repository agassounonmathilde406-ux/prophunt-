require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const players = {};

io.on('connection', (socket) => {
  players[socket.id] = {
    id: socket.id,
    x: (Math.random() - 0.5) * 6,
    y: 0,
    z: (Math.random() - 0.5) * 6,
    rotY: 0,
    color: Math.floor(Math.random() * 0xffffff),
  };

  socket.emit('init', { id: socket.id, players });
  socket.broadcast.emit('player_joined', players[socket.id]);

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotY = data.rotY;
    socket.broadcast.emit('player_moved', p);
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('player_left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Prop Hunt server sur le port ${PORT}`));
