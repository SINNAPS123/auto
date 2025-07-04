const express = require('express');
const router = express.Router();
const db = require('../models');
const { Vehicle, MaintenanceRecommendation, VehicleMaintenanceSchedule, MaintenanceLog } = db;
const { Op } = require('sequelize');
const { parseISO, addDays, subDays } = require('date-fns'); // Pentru next_due_date

// Funcție helper pentru actualizarea datelor de scadență ale unui program de mentenanță
// Similară cu update_maintenance_schedule_due_dates din Python
async function updateScheduleDueDates(scheduleId, transaction) {
    const schedule = await VehicleMaintenanceSchedule.findByPk(scheduleId, {
        include: [
            { model: Vehicle, as: 'vehicle_schedule_ref' },
            { model: MaintenanceRecommendation, as: 'recommendation_schedule_ref' }
        ],
        transaction
    });

    if (!schedule || !schedule.vehicle_schedule_ref || !schedule.recommendation_schedule_ref) {
        console.error(`Schedule ${scheduleId} sau datele asociate (vehicul/recomandare) nu au fost găsite.`);
        return false;
    }

    const vehicle = schedule.vehicle_schedule_ref;
    const recommendation = schedule.recommendation_schedule_ref;

    const lastLogForSchedule = await MaintenanceLog.findOne({
        where: { schedule_id: schedule.id },
        order: [['service_date', 'DESC'], ['serviced_at_km', 'DESC']],
        transaction
    });

    let lastServiceDateToUse = null;
    let lastServiceKmToUse = null;

    if (lastLogForSchedule) {
        schedule.last_service_date = lastLogForSchedule.service_date; // YYYY-MM-DD
        schedule.last_service_km = lastLogForSchedule.serviced_at_km;
        lastServiceDateToUse = parseISO(lastLogForSchedule.service_date); // Convertește în obiect Date
        lastServiceKmToUse = lastLogForSchedule.serviced_at_km;
    } else {
        if (schedule.last_service_date && schedule.last_service_km !== null) {
            lastServiceDateToUse = parseISO(schedule.last_service_date);
            lastServiceKmToUse = schedule.last_service_km;
        } else {
            // Folosim data creării vehiculului (sau o dată default dacă nu e setată) și km 0
            lastServiceDateToUse = vehicle.created_at ? new Date(vehicle.created_at) : new Date(0); // Data Epoch dacă created_at lipsește
            lastServiceKmToUse = 0;
        }
    }

    if (recommendation.default_interval_km && lastServiceKmToUse !== null) {
        schedule.next_due_km = lastServiceKmToUse + recommendation.default_interval_km;
    } else {
        schedule.next_due_km = null;
    }

    if (recommendation.default_interval_days && lastServiceDateToUse) {
        schedule.next_due_date = addDays(lastServiceDateToUse, recommendation.default_interval_days).toISOString().slice(0,10);
    } else {
        schedule.next_due_date = null;
    }

    await schedule.save({ transaction });
    return true;
}


// GET /api/maintenance/recommendations
router.get('/recommendations', async (req, res) => {
    try {
        const recommendations = await MaintenanceRecommendation.findAll({
            order: [['task_name', 'ASC']]
        });
        res.json(recommendations.map(rec => rec.toDict()));
    } catch (error) {
        console.error("Eroare la obținerea recomandărilor de mentenanță:", error);
        res.status(500).json({ error: "Eroare server la obținerea recomandărilor." });
    }
});

// GET /api/vehicles/:vehicle_uid/maintenance_status
router.get('/vehicles/:vehicle_uid/maintenance_status', async (req, res) => {
    const { vehicle_uid } = req.params;
    const transaction = await db.sequelize.transaction();
    try {
        const vehicle = await Vehicle.findOne({ where: { vehicle_uid }, transaction });
        if (!vehicle) {
            await transaction.rollback();
            return res.status(404).json({ error: "Vehicul negăsit" });
        }

        const schedules = await VehicleMaintenanceSchedule.findAll({
            where: { vehicle_id: vehicle.id, is_active: true },
            include: [ // Eager load pentru a evita query-uri N+1 în toDict și updateScheduleDueDates
                { model: Vehicle, as: 'vehicle_schedule_ref' },
                { model: MaintenanceRecommendation, as: 'recommendation_schedule_ref' }
            ],
            transaction
        });

        const updatedSchedulesData = [];
        for (const sched of schedules) {
            await updateScheduleDueDates(sched.id, transaction);
            // Re-interogăm schedule-ul pentru a obține datele actualizate de toDict, deoarece save() nu returnează instanța cu eager loading
            const updatedSched = await VehicleMaintenanceSchedule.findByPk(sched.id, {
                 include: [
                    { model: Vehicle, as: 'vehicle_schedule_ref' },
                    { model: MaintenanceRecommendation, as: 'recommendation_schedule_ref' }
                ],
                transaction
            });
            if (updatedSched) {
                 updatedSchedulesData.push(await updatedSched.toDict());
            }
        }

        await transaction.commit();
        updatedSchedulesData.sort((a, b) => (a.task_name || '').localeCompare(b.task_name || ''));
        res.json(updatedSchedulesData);

    } catch (error) {
        await transaction.rollback();
        console.error(`Eroare la obținerea statusului de mentenanță pentru ${vehicle_uid}:`, error);
        res.status(500).json({ error: "Eroare server la obținerea statusului de mentenanță." });
    }
});


// POST /api/maintenance_logs
router.post('/logs', async (req, res) => {
    const data = req.body;
    const requiredFields = ['vehicle_uid', 'task_performed', 'service_date', 'serviced_at_km'];
    for (const field of requiredFields) {
        if (!data[field] || String(data[field]).trim() === "") {
            return res.status(400).json({ error: `Câmpul '${field}' este obligatoriu și nu poate fi gol.` });
        }
    }

    const transaction = await db.sequelize.transaction();
    try {
        const vehicle = await Vehicle.findOne({ where: { vehicle_uid: data.vehicle_uid }, transaction });
        if (!vehicle) {
            await transaction.rollback();
            return res.status(404).json({ error: `Vehiculul cu UID ${data.vehicle_uid} nu a fost găsit.` });
        }

        let serviceDateObj;
        try {
            serviceDateObj = parseISO(data.service_date).toISOString().slice(0,10); // Asigură format YYYY-MM-DD
        } catch (e) {
            await transaction.rollback();
            return res.status(400).json({ error: "Format invalid pentru 'service_date' (YYYY-MM-DD)." });
        }

        const servicedAtKmFloat = parseFloat(data.serviced_at_km);
        if (isNaN(servicedAtKmFloat) || servicedAtKmFloat < 0) {
            await transaction.rollback();
            return res.status(400).json({ error: "Kilometrajul la service trebuie să fie un număr valid și nu poate fi negativ." });
        }

        const newLogData = {
            vehicle_id: vehicle.id,
            task_performed: data.task_performed,
            service_date: serviceDateObj,
            serviced_at_km: servicedAtKmFloat,
            schedule_id: data.schedule_id || null,
            recommendation_id: data.recommendation_id || null,
            parts_cost: data.parts_cost !== undefined ? parseFloat(data.parts_cost) : null,
            labor_cost: data.labor_cost !== undefined ? parseFloat(data.labor_cost) : null,
            total_cost: data.total_cost !== undefined ? parseFloat(data.total_cost) : null,
            service_provider: data.service_provider || null,
            notes: data.notes || null,
        };

        const newLog = await MaintenanceLog.create(newLogData, { transaction });

        if (servicedAtKmFloat > vehicle.current_odometer_km) {
            vehicle.current_odometer_km = servicedAtKmFloat;
            await vehicle.save({ transaction });
        }

        let scheduleToUpdateId = newLog.schedule_id;
        if (!scheduleToUpdateId && newLog.recommendation_id) {
            const scheduleFound = await VehicleMaintenanceSchedule.findOne({
                where: { vehicle_id: vehicle.id, recommendation_id: newLog.recommendation_id },
                transaction
            });
            if (scheduleFound) {
                scheduleToUpdateId = scheduleFound.id;
                // Opcional: leagă log-ul de schedule dacă nu era legat explicit
                if(!newLog.schedule_id) {
                    newLog.schedule_id = scheduleFound.id;
                    await newLog.save({transaction});
                }
            }
        }

        if (scheduleToUpdateId) {
            const updateSuccessful = await updateScheduleDueDates(scheduleToUpdateId, transaction);
            if (!updateSuccessful) {
                // Decidem dacă ar trebui să facem rollback sau doar să avertizăm
                console.warn(`Log-ul ${newLog.id} salvat, dar actualizarea schedule-ului ${scheduleToUpdateId} a eșuat logic (posibil date lipsă).`);
            }
        }

        await transaction.commit();

        // Re-interogăm pentru a popula corect referințele pentru toDict
        const finalLog = await MaintenanceLog.findByPk(newLog.id, {
             include: [
                { model: Vehicle, as: 'vehicle_log_ref' },
                {
                    model: VehicleMaintenanceSchedule,
                    as: 'schedule_log_ref',
                    include: [{model: MaintenanceRecommendation, as: 'recommendation_schedule_ref'}]
                },
                { model: MaintenanceRecommendation, as: 'recommendation_direct_log_ref'}
            ]
        });
        res.status(201).json(await finalLog.toDict());

    } catch (error) {
        await transaction.rollback();
        console.error("Eroare la crearea log-ului de mentenanță:", error);
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: "Date invalide furnizate.", details: error.errors.map(e => e.message) });
        }
        res.status(500).json({ error: `Eroare internă la salvarea log-ului: ${error.message}` });
    }
});


module.exports = router;
