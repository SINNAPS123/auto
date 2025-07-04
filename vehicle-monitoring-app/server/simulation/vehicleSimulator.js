const db = require('../models');
const { Vehicle, TrackPoint } = db;
const { Op } = require('sequelize');

const ROMANIA_BOUNDS = {
    min_lat: 43.6, max_lat: 48.2,
    min_lon: 20.2, max_lon: 29.7
};

let activeVehicleSimulators = [];
let simulationIntervalId = null;
let ioInstance = null; // Pentru a stoca instanța Socket.IO

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    if ([lat1, lon1, lat2, lon2].some(coord => coord === null || coord === undefined)) return 0.0;
    const toRad = (num) => num * Math.PI / 180;
    const lat1Rad = toRad(parseFloat(lat1));
    const lon1Rad = toRad(parseFloat(lon1));
    const lat2Rad = toRad(parseFloat(lat2));
    const lon2Rad = toRad(parseFloat(lon2));
    const dlon = lon2Rad - lon1Rad;
    const dlat = lat2Rad - lat1Rad;
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dlon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function initializeSimulatorsInternal() { // Redenumită pentru a evita confuzia cu cea exportată
    console.log("Inițializare internă simulatoare vehicule...");
    try {
        const vehiclesFromDb = await Vehicle.findAll();
        if (vehiclesFromDb.length === 0) {
            console.warn("Niciun vehicul în baza de date. Simulatorul nu poate porni fără vehicule.");
            activeVehicleSimulators = [];
            return;
        }

        activeVehicleSimulators = [];
        for (const v_db of vehiclesFromDb) {
            const lastTp = await TrackPoint.findOne({
                where: { vehicle_id: v_db.id },
                order: [['timestamp', 'DESC']]
            });

            const sim = {
                db_id: v_db.id, vehicle_uid: v_db.vehicle_uid, license_plate: v_db.license_plate, type: v_db.type,
                latitude: lastTp ? parseFloat(lastTp.latitude) : (Math.random() * (ROMANIA_BOUNDS.max_lat - ROMANIA_BOUNDS.min_lat) + ROMANIA_BOUNDS.min_lat),
                longitude: lastTp ? parseFloat(lastTp.longitude) : (Math.random() * (ROMANIA_BOUNDS.max_lon - ROMANIA_BOUNDS.min_lon) + ROMANIA_BOUNDS.min_lon),
                speed_kmh: lastTp ? parseFloat(lastTp.speed_kmh) : Math.random() * 90,
                fuel_level_percent: (lastTp && lastTp.fuel_level_percent !== null) ? parseFloat(lastTp.fuel_level_percent) : (Math.random() * 70 + 30),
                status: "Idle", last_updated: new Date(), current_odometer_km: parseFloat(v_db.current_odometer_km),
                engine_rpm: lastTp?.engine_rpm || 0, coolant_temp_celsius: lastTp?.coolant_temp_celsius || 20,
                oil_pressure_bar: lastTp?.oil_pressure_bar || 0, battery_voltage: lastTp?.battery_voltage || 12.5,
            };
            sim.status = sim.speed_kmh > 5 ? "Moving" : "Idle";
            activeVehicleSimulators.push(sim);
        }
        console.log(`Simulator inițializat/actualizat cu ${activeVehicleSimulators.length} vehicule.`);
    } catch (error) {
        console.error("Eroare la inițializarea simulatoarelor:", error);
        activeVehicleSimulators = [];
    }
}

async function runSimulationStepAndSave() {
    if (activeVehicleSimulators.length === 0) return;

    const newTrackpointsBatch = [];
    const vehicleUpdates = [];

    for (const simVehicle of activeVehicleSimulators) {
        const prevLat = simVehicle.latitude;
        const prevLon = simVehicle.longitude;

        if (simVehicle.speed_kmh > 0 || Math.random() < 0.1) {
            const latChange = (Math.random() - 0.5) * 0.002 * (simVehicle.speed_kmh / 50 + 0.1);
            const lonChange = (Math.random() - 0.5) * 0.002 * (simVehicle.speed_kmh / 50 + 0.1);
            simVehicle.latitude = Math.max(ROMANIA_BOUNDS.min_lat, Math.min(simVehicle.latitude + latChange, ROMANIA_BOUNDS.max_lat));
            simVehicle.longitude = Math.max(ROMANIA_BOUNDS.min_lon, Math.min(simVehicle.longitude + lonChange, ROMANIA_BOUNDS.max_lon));
        }

        if (Math.random() < 0.3) {
            const accel = (Math.random() - 0.5) * 20;
            simVehicle.speed_kmh = Math.max(0, Math.min(130, simVehicle.speed_kmh + accel));
        }
        simVehicle.status = simVehicle.speed_kmh > 1 ? "Moving" : "Idle";

        if (simVehicle.speed_kmh > 0) {
            const fuelConsumed = (simVehicle.speed_kmh / 100) * (Math.random() * 0.10 + 0.05);
            simVehicle.fuel_level_percent -= fuelConsumed;
            if (simVehicle.fuel_level_percent < 0) simVehicle.fuel_level_percent = 0;
            if (simVehicle.fuel_level_percent < 10 && Math.random() < 0.1) {
                simVehicle.fuel_level_percent = Math.random() * 50 + 50;
            }
        }

        const distanceThisStep = haversineDistance(prevLat, prevLon, simVehicle.latitude, simVehicle.longitude);
        simVehicle.current_odometer_km += distanceThisStep;

        vehicleUpdates.push({ id: simVehicle.db_id, current_odometer_km: simVehicle.current_odometer_km });

        if (simVehicle.status === "Moving" || simVehicle.speed_kmh > 1) {
            simVehicle.engine_rpm = Math.max(700, Math.min(5000, 750 + simVehicle.speed_kmh * 22 + (Math.random() - 0.5) * 300));
            simVehicle.coolant_temp_celsius = Math.min(98, simVehicle.coolant_temp_celsius + simVehicle.speed_kmh * 0.15 + Math.random() * 0.5);
            if (simVehicle.coolant_temp_celsius < 60) simVehicle.coolant_temp_celsius = 60;
            simVehicle.oil_pressure_bar = Math.max(0.8, Math.min(5.0, 1.2 + (simVehicle.engine_rpm / 1000) * 0.6 + (Math.random() - 0.5) * 0.4));
            simVehicle.battery_voltage = 13.7 + (Math.random() - 0.5) * 0.4;
        } else {
            simVehicle.engine_rpm = 0;
            simVehicle.coolant_temp_celsius = Math.max(20, simVehicle.coolant_temp_celsius - Math.random() * 0.5);
            simVehicle.oil_pressure_bar = 0;
        }
        simVehicle.last_updated = new Date();

        newTrackpointsBatch.push({
            vehicle_id: simVehicle.db_id, timestamp: simVehicle.last_updated,
            latitude: parseFloat(simVehicle.latitude.toFixed(6)), longitude: parseFloat(simVehicle.longitude.toFixed(6)),
            speed_kmh: parseFloat(simVehicle.speed_kmh.toFixed(2)),
            fuel_level_percent: simVehicle.fuel_level_percent !== null ? parseFloat(simVehicle.fuel_level_percent.toFixed(2)) : null,
            distance_since_last_point_km: parseFloat(distanceThisStep.toFixed(3)),
            engine_rpm: simVehicle.engine_rpm, coolant_temp_celsius: parseInt(simVehicle.coolant_temp_celsius, 10),
            oil_pressure_bar: parseFloat(simVehicle.oil_pressure_bar.toFixed(1)), battery_voltage: parseFloat(simVehicle.battery_voltage.toFixed(1)),
        });
    }

    if (newTrackpointsBatch.length > 0) {
        const transaction = await db.sequelize.transaction();
        try {
            await TrackPoint.bulkCreate(newTrackpointsBatch, { transaction });
            for (const update of vehicleUpdates) {
                await Vehicle.update({ current_odometer_km: update.current_odometer_km }, { where: { id: update.id }, transaction });
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error("Eroare la salvarea batch TrackPoints sau actualizare kilometraj:", error);
        }
    }

    // Emite actualizările prin Socket.IO dacă instanța io este disponibilă
    if (ioInstance) {
        ioInstance.emit('vehiclePositionsUpdate', getCurrentSimulatedPositions());
    }
}

function getCurrentSimulatedPositions() {
    return activeVehicleSimulators.map(sim_v => ({
        id: sim_v.vehicle_uid, vehicle_uid: sim_v.vehicle_uid, license_plate: sim_v.license_plate, type: sim_v.type,
        latitude: parseFloat(sim_v.latitude.toFixed(6)), longitude: parseFloat(sim_v.longitude.toFixed(6)),
        speed_kmh: parseFloat(sim_v.speed_kmh.toFixed(2)),
        fuel_level_percent: sim_v.fuel_level_percent !== null ? parseFloat(sim_v.fuel_level_percent.toFixed(2)) : null,
        status: sim_v.status, last_updated: sim_v.last_updated.toISOString(),
        current_odometer_km: parseFloat(sim_v.current_odometer_km.toFixed(1)),
        engine_rpm: sim_v.engine_rpm, coolant_temp_celsius: parseInt(sim_v.coolant_temp_celsius, 10),
        oil_pressure_bar: parseFloat(sim_v.oil_pressure_bar.toFixed(1)), battery_voltage: parseFloat(sim_v.battery_voltage.toFixed(1)),
    }));
}

function startSimulation(intervalMs = 5000) {
    if (simulationIntervalId) {
        console.log("Simularea este deja pornită.");
        return;
    }
    console.log(`Pornire simulare vehicule cu interval de ${intervalMs}ms.`);

    // Asigură-te că initializeSimulatorsInternal a rulat cel puțin o dată înainte de a porni intervalul
    // Acest lucru este gestionat de reinitializeSimulators acum.
    if (activeVehicleSimulators.length > 0) {
        runSimulationStepAndSave(); // Rulează o dată imediat
        simulationIntervalId = setInterval(runSimulationStepAndSave, intervalMs);
    } else {
        console.warn("Simularea nu pornește pasul inițial deoarece nu există vehicule active. Se va încerca la următorul apel reinitializeSimulators.");
        // Permitem ca reinitializeSimulators să gestioneze pornirea intervalului după ce încarcă datele.
    }
}

function stopSimulation() {
    if (simulationIntervalId) {
        clearInterval(simulationIntervalId);
        simulationIntervalId = null;
        console.log("Simulare vehicule oprită.");
    }
}

async function reinitializeSimulators(io = null) { // Acceptă instanța io
    if (io) {
        ioInstance = io; // Stochează instanța io pentru utilizare ulterioară
    }
    console.log("Re-inițializare simulatoare...");
    stopSimulation();
    await initializeSimulatorsInternal();

    if (activeVehicleSimulators.length > 0) {
        startSimulation(); // Repornește simularea doar dacă avem vehicule
        // Emite o actualizare inițială dacă ioInstance este setat
        if (ioInstance) {
            ioInstance.emit('vehiclePositionsUpdate', getCurrentSimulatedPositions());
        }
    } else {
        console.warn("Re-inițializarea nu a găsit vehicule. Simularea nu a fost repornită automat.");
    }
}

module.exports = {
    // startSimulation și stopSimulation sunt mai mult interne acum, controlate prin reinitializeSimulators
    getCurrentSimulatedPositions,
    reinitializeSimulators // Funcția principală pentru a controla și (re)porni simularea
};
