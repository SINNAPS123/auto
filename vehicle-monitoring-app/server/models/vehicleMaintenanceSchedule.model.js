const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleMaintenanceSchedule = sequelize.define("VehicleMaintenanceSchedule", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // vehicle_id și recommendation_id sunt adăugate de Sequelize prin asocieri
    last_service_date: {
      type: DataTypes.DATEONLY, // Doar data, fără oră
      allowNull: true,
    },
    last_service_km: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    next_due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    next_due_km: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    }
  }, {
    tableName: "vehicle_maintenance_schedules",
    timestamps: true, // Poate fi util să știm când a fost creat/modificat un schedule
    updatedAt: 'updated_at',
    createdAt: 'created_at',
    indexes: [ // Adăugăm indexul unic similar cu __table_args__
      {
        unique: true,
        fields: ['vehicle_id', 'recommendation_id'],
        name: 'uq_vehicle_recommendation'
      }
    ]
  });

  VehicleMaintenanceSchedule.prototype.toDict = async function () {
    const data = {
      id: this.id,
      vehicle_id: this.vehicle_id,
      recommendation_id: this.recommendation_id,
      last_service_date: this.last_service_date, // Sequelize returnează direct string YYYY-MM-DD
      last_service_km: this.last_service_km,
      next_due_date: this.next_due_date,
      next_due_km: this.next_due_km,
      notes: this.notes,
      is_active: this.is_active,
    };

    // Adăugăm date din modelele asociate, similar cu modelul Python
    if (this.vehicle_schedule_ref) {
      data.vehicle_license_plate = this.vehicle_schedule_ref.license_plate;
      data.vehicle_current_odometer_km = parseFloat(this.vehicle_schedule_ref.current_odometer_km.toFixed(1));
    } else {
      const vehicle = await this.getVehicle_schedule_ref();
      if (vehicle) {
        data.vehicle_license_plate = vehicle.license_plate;
        data.vehicle_current_odometer_km = parseFloat(vehicle.current_odometer_km.toFixed(1));
      }
    }

    if (this.recommendation_schedule_ref) {
      data.task_name = this.recommendation_schedule_ref.task_name;
      data.default_interval_km = this.recommendation_schedule_ref.default_interval_km;
      data.default_interval_days = this.recommendation_schedule_ref.default_interval_days;
    } else {
      const recommendation = await this.getRecommendation_schedule_ref();
      if (recommendation) {
        data.task_name = recommendation.task_name;
        data.default_interval_km = recommendation.default_interval_km;
        data.default_interval_days = recommendation.default_interval_days;
      }
    }
    return data;
  };

  return VehicleMaintenanceSchedule;
};
