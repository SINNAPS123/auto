const { Sequelize } = require('sequelize');
const path = require('path');

// Configurarea bazei de date SQLite. Fișierul DB va fi în directorul 'server'.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../vehicle_monitor.db'), // Calea către fișierul DB
  logging: false, // Dezactivează logging-ul SQL în consolă (sau setează console.log pentru a-l vedea)
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Încărcarea modelelor
db.Vehicle = require('./vehicle.model.js')(sequelize, Sequelize);
db.TrackPoint = require('./trackPoint.model.js')(sequelize, Sequelize);
db.MaintenanceRecommendation = require('./maintenanceRecommendation.model.js')(sequelize, Sequelize);
db.VehicleMaintenanceSchedule = require('./vehicleMaintenanceSchedule.model.js')(sequelize, Sequelize);
db.MaintenanceLog = require('./maintenanceLog.model.js')(sequelize, Sequelize);

// Definirea relațiilor între modele (după ce toate modelele sunt încărcate)

// Vehicle <-> TrackPoint (One-to-Many)
db.Vehicle.hasMany(db.TrackPoint, { as: 'track_points', foreignKey: 'vehicle_id', onDelete: 'CASCADE' });
db.TrackPoint.belongsTo(db.Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle_tp_ref' });

// Vehicle <-> VehicleMaintenanceSchedule (One-to-Many)
db.Vehicle.hasMany(db.VehicleMaintenanceSchedule, { as: 'maintenance_schedules', foreignKey: 'vehicle_id', onDelete: 'CASCADE' });
db.VehicleMaintenanceSchedule.belongsTo(db.Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle_schedule_ref' });

// MaintenanceRecommendation <-> VehicleMaintenanceSchedule (One-to-Many)
db.MaintenanceRecommendation.hasMany(db.VehicleMaintenanceSchedule, { as: 'schedules', foreignKey: 'recommendation_id' });
db.VehicleMaintenanceSchedule.belongsTo(db.MaintenanceRecommendation, { foreignKey: 'recommendation_id', as: 'recommendation_schedule_ref' });

// Vehicle <-> MaintenanceLog (One-to-Many)
db.Vehicle.hasMany(db.MaintenanceLog, { as: 'maintenance_logs', foreignKey: 'vehicle_id', onDelete: 'CASCADE' });
db.MaintenanceLog.belongsTo(db.Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle_log_ref' });

// VehicleMaintenanceSchedule <-> MaintenanceLog (One-to-Many)
// Un log poate aparține unui schedule specific
db.VehicleMaintenanceSchedule.hasMany(db.MaintenanceLog, { as: 'logs', foreignKey: 'schedule_id' });
db.MaintenanceLog.belongsTo(db.VehicleMaintenanceSchedule, { foreignKey: 'schedule_id', as: 'schedule_log_ref' });

// MaintenanceRecommendation <-> MaintenanceLog (One-to-Many, pentru log-uri directe care nu sunt legate de un schedule)
// Această relație este mai complexă de modelat direct dacă un log poate avea *fie* schedule_id *fie* recommendation_id
// În modelul Python, era `primaryjoin="and_(MaintenanceLog.recommendation_id==MaintenanceRecommendation.id, MaintenanceLog.schedule_id==None)"`
// Pentru simplitate inițială, un log va avea un recommendation_id, și opțional un schedule_id.
// Sequelize nu suportă direct primaryjoin în definirea asocierii în acest mod.
// Vom gestiona logica acestei legături mai mult la nivel de aplicație sau prin query-uri specifice dacă este necesar.
// Momentan, doar legătura simplă:
db.MaintenanceRecommendation.hasMany(db.MaintenanceLog, {
  as: 'direct_logs',
  foreignKey: 'recommendation_id',
  scope: { // O încercare de a simula condiția, dar s-ar putea să nu funcționeze exact ca primaryjoin
    schedule_id: null
  }
});
db.MaintenanceLog.belongsTo(db.MaintenanceRecommendation, { foreignKey: 'recommendation_id', as: 'recommendation_direct_log_ref' });


// Funcție de serializare pentru a se potrivi cu `to_dict()` din Python
const addMethods = (modelInstance, methods) => {
  for (const method in methods) {
    modelInstance.prototype[method] = methods[method];
  }
};

module.exports = db;
