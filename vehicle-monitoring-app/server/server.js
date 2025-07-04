const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); // Modulul http din Node.js
const { Server } = require("socket.io"); // Server din socket.io

const db = require('./models');
const vehicleSimulator = require('./simulation/vehicleSimulator');
const { initializeDatabase } = require('./initDb');

const app = express();
const server = http.createServer(app); // Creăm un server HTTP din aplicația Express
const io = new Server(server, { // Inițializăm Socket.IO pe serverul HTTP
  cors: {
    origin: "*", // Permite toate originile; ajustează pentru producție!
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5002;

app.use(cors()); // Aplicăm CORS și pentru rutele HTTP Express
app.use(express.json());

// --- Rute API ---
const vehicleRoutes = require('./routes/vehicle.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// --- Logică Socket.IO ---
io.on('connection', (socket) => {
  console.log('Un client s-a conectat prin WebSocket:', socket.id);

  // Trimite un mesaj de bun venit sau date inițiale dacă e necesar
  // socket.emit('welcome', 'Bine ai venit la serverul de monitorizare vehicule!');

  socket.on('disconnect', () => {
    console.log('Clientul s-a deconectat:', socket.id);
  });

  // Aici se pot adăuga listeneri pentru evenimente de la client, dacă e nevoie
});


// --- Servire Frontend React (Build Static) ---
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC) {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Serverul Node.js rulează în mod dezvoltare. Frontend-ul React rulează separat.');
  });
}

async function startServer() {
  try {
    await db.sequelize.sync();
    console.log("Baza de date a fost sincronizată.");

    const vehicleCount = await db.Vehicle.count();
    if (vehicleCount === 0 && process.env.NODE_ENV !== 'production') {
      console.log("DB gol, se inițializează...");
      await initializeDatabase();
      console.log("DB inițializat și populat.");
    } else if (vehicleCount === 0 && process.env.NODE_ENV === 'production') {
      console.warn("ATENȚIE: Baza de date este goală în modul producție.");
    }

    // Pasează instanța `io` la simulator pentru a putea emite evenimente
    await vehicleSimulator.reinitializeSimulators(io);
    // Modificăm reinitializeSimulators pentru a accepta și a stoca `io`

    // Pornim serverul HTTP (care include Express și Socket.IO)
    server.listen(PORT, () => {
      console.log(`Server pornit pe portul ${PORT}`);
      if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC) {
        console.log('Servind build-ul static React.');
      } else {
        console.log('Mod dezvoltare: Frontend React pe server separat.');
      }
    });

  } catch (err) {
    console.error('Nu s-a putut porni serverul:', err);
  }
}

startServer();
