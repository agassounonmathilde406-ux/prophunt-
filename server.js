require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Sert les fichiers statiques depuis le répertoire courant
app.use(express.static(__dirname));

const players = {};

io.on('connection', (socket) => {
  // Définition initiale du joueur
  players[socket.id] = {
    id: socket.id,
    x: (Math.random() - 0.5) * 6,
    y: 0,
    z: (Math.random() - 0.5) * 6,
    rotY: 0,
    color: Math.floor(Math.random() * 0xffffff),
    propData: null // null = personnage normal, sinon { size, color }
  };

  // Envoi de l'état initial au nouveau joueur
  socket.emit('init', { id: socket.id, players });
  
  // Notification aux autres joueurs
  socket.broadcast.emit('player_joined', players[socket.id]);

  // Réception du déplacement du client
  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotY = data.rotY;
  });

  // Réception de la transformation en Prop
  socket.on('transform', (propData) => {
    const p = players[socket.id];
    if (!p) return;
    p.propData = propData;
    io.emit('player_transformed', { id: socket.id, propData });
  });

  // Déconnexion
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('player_left', socket.id);
  });
});

// Diffuse l'état global du jeu 20 fois par seconde (50ms)
setInterval(() => {
  io.emit('state_update', players);
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur Prop Hunt lancé sur le port ${PORT}`));
