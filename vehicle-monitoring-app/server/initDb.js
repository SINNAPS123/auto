const db = require('./models');
const { Vehicle, MaintenanceRecommendation, VehicleMaintenanceSchedule, TrackPoint } = db;
const { v4: uuidv4 } = require('uuid');

const maintenanceRecommendationsData = [
  { task_name: "Schimb ulei motor și filtru ulei", default_interval_km: 15000, default_interval_days: 365, applies_to_vehicle_type: "Toate" },
  { task_name: "Verificare și înlocuire filtru aer", default_interval_km: 30000, default_interval_days: 730, applies_to_vehicle_type: "Toate" },
  { task_name: "Verificare și înlocuire filtru combustibil", default_interval_km: 60000, default_interval_days: 730, applies_to_vehicle_type: "Toate" },
  { task_name: "Verificare plăcuțe de frână", default_interval_km: 20000, default_interval_days: 365, applies_to_vehicle_type: "Toate" },
  { task_name: "Înlocuire lichid de frână", default_interval_days: 730, applies_to_vehicle_type: "Toate" },
  { task_name: "ITP (Inspecție Tehnică Periodică)", default_interval_days: 365, applies_to_vehicle_type: "Toate" },
];

async function populateMaintenanceRecommendations() {
  console.log("Popularea recomandărilor de mentenanță...");
  let addedCount = 0;
  for (const recData of maintenanceRecommendationsData) {
    const [rec, created] = await MaintenanceRecommendation.findOrCreate({
      where: { task_name: recData.task_name },
      defaults: recData,
    });
    if (created) {
      addedCount++;
    }
  }
  if (addedCount > 0) {
    console.log(`Adăugat ${addedCount} recomandări de mentenanță noi.`);
  } else {
    console.log("Nicio recomandare de mentenanță nouă adăugată (probabil există deja).");
  }
}

function generateRandomLicensePlate() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let plate = "";

  const prefixLetters = Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < prefixLetters; i++) {
    plate += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  const numDigits = Math.random() < 0.5 ? 2 : 3;
  for (let i = 0; i < numDigits; i++) {
    plate += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  for (let i = 0; i < 3; i++) {
    plate += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return plate;
}

async function initializeDbVehicles(numVehiclesToEnsure = 10) {
  console.log(`Inițializarea vehiculelor în DB (asigurând ${numVehiclesToEnsure})...`);
  const currentVehicleCount = await Vehicle.count();
  let needed = numVehiclesToEnsure - currentVehicleCount;

  if (needed > 0) {
    console.log(`Se adaugă ${needed} vehicule noi în DB.`);
    const vehicleTypes = ["Camion frigorific", "Autoutilitară", "Autoturism", "Autobuz"];
    for (let i = 0; i < needed; i++) {
      let plateCandidate = generateRandomLicensePlate();
      while (await Vehicle.findOne({ where: { license_plate: plateCandidate } })) {
        plateCandidate = generateRandomLicensePlate();
      }

      // vehicle_uid este generat automat de modelul Sequelize
      await Vehicle.create({
        license_plate: plateCandidate,
        type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)],
        current_odometer_km: parseFloat((Math.random() * (150000 - 5000) + 5000).toFixed(1)),
      });
    }
    console.log(`${needed} vehicule noi adăugate în DB.`);
  } else {
    console.log("Numărul necesar de vehicule există deja în DB.");
  }

  // Crearea programelor de mentenanță pentru toate vehiculele și recomandările
  const allDbVehicles = await Vehicle.findAll();
  const allRecommendations = await MaintenanceRecommendation.findAll();

  for (const vehicle of allDbVehicles) {
    for (const rec of allRecommendations) {
      if (rec.applies_to_vehicle_type === "Toate" || rec.applies_to_vehicle_type === vehicle.type) {
        await VehicleMaintenanceSchedule.findOrCreate({
          where: {
            vehicle_id: vehicle.id,
            recommendation_id: rec.id,
          },
          defaults: {
            vehicle_id: vehicle.id,
            recommendation_id: rec.id,
            // next_due_date și next_due_km vor fi calculate la cerere/logare service
          }
        });
      }
    }
  }
  console.log("Programele de mentenanță verificate/create pentru vehicule.");
}


async function initializeDatabase() {
  try {
    // Sincronizează toate modelele. { force: true } va șterge tabelele dacă există deja.
    // Folosește cu grijă în producție! Pentru dezvoltare, e ok pentru a reseta.
    await db.sequelize.sync({ force: true });
    console.log("Baza de date și tabelele au fost create/sincronizate (cu force:true).");

    await populateMaintenanceRecommendations();
    await initializeDbVehicles(10); // Asigură cel puțin 10 vehicule

    console.log("Inițializarea bazei de date completă.");

  } catch (error) {
    console.error("Eroare la inițializarea bazei de date:", error);
  } finally {
    // Închide conexiunea la DB dacă scriptul rulează independent și apoi se oprește.
    // Dacă este apelat dintr-un server activ, s-ar putea să nu fie necesar.
    // await db.sequelize.close();
  }
}

// Permite rularea directă a scriptului: node initDb.js
if (require.main === module) {
  initializeDatabase().then(() => {
    console.log("Scriptul initDb.js a rulat cu succes.");
    // Este posibil să trebuiască să ieșim explicit dacă sequelize.close() nu este apelat
    // sau dacă există alte operațiuni asincrone care mențin procesul activ.
    // process.exit(0);
  }).catch(error => {
    console.error("Eroare la rularea scriptului initDb.js:", error);
    process.exit(1);
  });
}

module.exports = {
  initializeDatabase,
  populateMaintenanceRecommendations,
  initializeDbVehicles
};
