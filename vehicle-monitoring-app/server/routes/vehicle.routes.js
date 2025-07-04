const express = require('express');
const router = express.Router();
const db = require('../models');
const vehicleSimulator = require('../simulation/vehicleSimulator');
const { Vehicle, TrackPoint } = db;
const { Op } = require('sequelize');
const { parseISO, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');


// GET /api/vehicles/positions
router.get('/positions', (req, res) => {
  try {
    const positions = vehicleSimulator.getCurrentSimulatedPositions();
    if (!positions || positions.length === 0) {
      // Acest lucru se poate întâmpla dacă simulatorul nu s-a inițializat corect (de ex. DB gol la pornire)
      // console.warn("/api/vehicles/positions a returnat un array gol. Verifică starea simulatorului.");
      // Am putea încerca o reinițializare rapidă aici, dar ar putea fi costisitor.
      // Mai bine ne asigurăm că server.js inițializează corect.
    }
    res.json(positions);
  } catch (error) {
    console.error("Eroare la obținerea pozițiilor vehiculelor:", error);
    res.status(500).json({ error: "Eroare server la obținerea pozițiilor." });
  }
});

// GET /api/vehicles
router.get('/', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ order: [['vehicle_uid', 'ASC']] });
    res.json(await Promise.all(vehicles.map(v => v.toDict())));
  } catch (error) {
    console.error("Eroare la obținerea listei de vehicule:", error);
    res.status(500).json({ error: "Eroare server la obținerea listei de vehicule." });
  }
});

// GET /api/vehicles/:vehicle_uid/history
router.get('/:vehicle_uid/history', async (req, res) => {
  const { vehicle_uid } = req.params;
  const { start_date: startDateStr, end_date: endDateStr, limit = 300 } = req.query;

  try {
    const vehicle = await Vehicle.findOne({ where: { vehicle_uid } });
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicul negăsit" });
    }

    let startDate, endDate;
    // Similar cu Python, default la ultimele 24h dacă startDate nu e specificat
    if (startDateStr) {
        try {
            startDate = parseISO(startDateStr);
        } catch (e) {
            return res.status(400).json({ error: `Format dată start invalid: ${e.message}. Folosiți ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)` });
        }
    } else {
        startDate = subDays(new Date(), 1);
    }

    if (endDateStr) {
        try {
            endDate = parseISO(endDateStr);
        } catch (e) {
            return res.status(400).json({ error: `Format dată end invalid: ${e.message}. Folosiți ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)` });
        }
    } else {
        endDate = new Date();
    }

    const queryOptions = {
      where: {
        vehicle_id: vehicle.id,
        timestamp: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      },
      order: [['timestamp', 'ASC']],
      limit: parseInt(limit, 10),
    };

    const trackPoints = await TrackPoint.findAll(queryOptions);
    res.json(await Promise.all(trackPoints.map(tp => tp.toDict())));
  } catch (error) {
    console.error(`Eroare la obținerea istoricului pentru vehiculul ${vehicle_uid}:`, error);
    res.status(500).json({ error: "Eroare server la obținerea istoricului." });
  }
});


// GET /api/vehicles/:vehicle_uid/fuel_history
router.get('/:vehicle_uid/fuel_history', async (req, res) => {
    const { vehicle_uid } = req.params;
    const { start_date: startDateStr, end_date: endDateStr, limit = 300 } = req.query;

    try {
        const vehicle = await Vehicle.findOne({ where: { vehicle_uid } });
        if (!vehicle) {
            return res.status(404).json({ error: "Vehicul negăsit" });
        }

        let startDate, endDate;
        if (startDateStr) {
            try { startDate = parseISO(startDateStr); } catch (e) { return res.status(400).json({ error: "Format dată start invalid."}); }
        } else {
            startDate = subDays(new Date(), 1);
        }
        if (endDateStr) {
            try { endDate = parseISO(endDateStr); } catch (e) { return res.status(400).json({ error: "Format dată end invalid."}); }
        } else {
            endDate = new Date();
        }

        const fuelDataPoints = await TrackPoint.findAll({
            where: {
                vehicle_id: vehicle.id,
                timestamp: { [Op.gte]: startDate, [Op.lte]: endDate },
                fuel_level_percent: { [Op.ne]: null } // Doar punctele cu date despre combustibil
            },
            attributes: ['timestamp', 'fuel_level_percent'],
            order: [['timestamp', 'ASC']],
            limit: parseInt(limit, 10)
        });

        res.json(fuelDataPoints.map(tp => ({
            timestamp: tp.timestamp.toISOString(),
            fuel_level_percent: tp.fuel_level_percent
        })));

    } catch (error) {
        console.error(`Eroare la obținerea istoricului de combustibil pentru ${vehicle_uid}:`, error);
        res.status(500).json({ error: "Eroare server la obținerea istoricului de combustibil." });
    }
});


// Funcție helper pentru calculul orelor de funcționare
// Similară cu cea din Python, dar adaptată pentru obiectele Sequelize
function calculateOperatingSeconds(trackPointsList) {
    if (!trackPointsList || trackPointsList.length < 2) return 0;
    let totalOperatingSeconds = 0;
    for (let i = 0; i < trackPointsList.length - 1; i++) {
        const currentPoint = trackPointsList[i];
        const nextPoint = trackPointsList[i + 1];

        // Considerăm motorul pornit dacă RPM > 0 sau viteză > 1 km/h
        // În Python era doar speed_kmh > 1.0. Putem adăuga și engine_rpm dacă e relevant.
        if (currentPoint.speed_kmh > 1.0 || (currentPoint.engine_rpm && currentPoint.engine_rpm > 500) ) {
            const currentTs = new Date(currentPoint.timestamp);
            const nextTs = new Date(nextPoint.timestamp);
            const durationIntervalSeconds = (nextTs - currentTs) / 1000;

            if (durationIntervalSeconds > 0 && durationIntervalSeconds < 3600) { // Ignorăm intervalele prea mari (posibil date lipsă)
                totalOperatingSeconds += durationIntervalSeconds;
            }
        }
    }
    return totalOperatingSeconds;
}

// GET /api/vehicles/:vehicle_uid/operating_summary
router.get('/:vehicle_uid/operating_summary', async (req, res) => {
    const { vehicle_uid } = req.params;
    const { period = 'day', date: dateStr } = req.query;

    if (!dateStr) {
        return res.status(400).json({ error: "Parametrul 'date' (YYYY-MM-DD) este obligatoriu." });
    }

    let refDate;
    try {
        refDate = parseISO(dateStr); // parseISO gestionează YYYY-MM-DD
    } catch (e) {
        return res.status(400).json({ error: "Format dată invalid pentru 'date'. Folosiți YYYY-MM-DD." });
    }

    const vehicle = await Vehicle.findOne({ where: { vehicle_uid } });
    if (!vehicle) {
        return res.status(404).json({ error: "Vehicul negăsit" });
    }

    let startDatetimeUtc, endDatetimeUtc;
    if (period === 'day') {
        startDatetimeUtc = startOfDay(refDate);
        endDatetimeUtc = endOfDay(refDate);
    } else if (period === 'week') {
        startDatetimeUtc = startOfWeek(refDate, { weekStartsOn: 1 }); // Luni ca început de săptămână
        endDatetimeUtc = endOfWeek(refDate, { weekStartsOn: 1 });
    } else if (period === 'month') {
        startDatetimeUtc = startOfMonth(refDate);
        endDatetimeUtc = endOfMonth(refDate);
    } else {
        return res.status(400).json({ error: "Valoare invalidă pentru 'period'. Folosiți 'day', 'week', sau 'month'." });
    }

    try {
        const trackPointsForPeriod = await TrackPoint.findAll({
            where: {
                vehicle_id: vehicle.id,
                timestamp: {
                    [Op.gte]: startDatetimeUtc,
                    [Op.lte]: endDatetimeUtc,
                }
            },
            order: [['timestamp', 'ASC']]
        });

        const operatingSeconds = calculateOperatingSeconds(trackPointsForPeriod);
        let msg = `${trackPointsForPeriod.length} puncte analizate.`;
        if (!trackPointsForPeriod || trackPointsForPeriod.length < 2) {
            msg = trackPointsForPeriod.length > 0 ? "Nu sunt suficiente date de traseu pentru a calcula orele de funcționare." : "Niciun punct de traseu găsit.";
        }

        res.json({
            vehicle_uid: vehicle_uid,
            period_type: period,
            reference_date_for_period: dateStr,
            calculated_period_start_utc: startDatetimeUtc.toISOString(),
            calculated_period_end_utc: endDatetimeUtc.toISOString(),
            total_operating_seconds: operatingSeconds,
            total_operating_hours: parseFloat((operatingSeconds / 3600).toFixed(2)),
            details: msg
        });

    } catch (error) {
        console.error(`Eroare la calculul orelor de funcționare pentru ${vehicle_uid}:`, error);
        res.status(500).json({ error: "Eroare server la calculul orelor de funcționare." });
    }
});


module.exports = router;
