const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MaintenanceLog = sequelize.define("MaintenanceLog", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // vehicle_id, schedule_id, recommendation_id sunt adăugate de Sequelize
    task_performed: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    service_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: () => new Date().toISOString().slice(0,10), // YYYY-MM-DD
    },
    serviced_at_km: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    parts_cost: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    labor_cost: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    total_cost: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    service_provider: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: { // Sequelize gestionează createdAt și updatedAt
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    }
  }, {
    tableName: "maintenance_logs",
    timestamps: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at'
  });

  MaintenanceLog.prototype.toDict = async function () {
    const data = {
      id: this.id,
      vehicle_id: this.vehicle_id,
      schedule_id: this.schedule_id,
      recommendation_id: this.recommendation_id,
      task_performed: this.task_performed,
      service_date: this.service_date,
      serviced_at_km: this.serviced_at_km,
      parts_cost: this.parts_cost,
      labor_cost: this.labor_cost,
      total_cost: this.total_cost,
      service_provider: this.service_provider,
      notes: this.notes,
      created_at: this.created_at ? this.created_at.toISOString() : null,
    };

    if (this.vehicle_log_ref) {
      data.vehicle_license_plate = this.vehicle_log_ref.license_plate;
    } else {
      const vehicle = await this.getVehicle_log_ref();
      if (vehicle) {
        data.vehicle_license_plate = vehicle.license_plate;
      }
    }

    let taskNameFromRecommendation = null;
    if (this.recommendation_direct_log_ref) { // Folosind aliasul definit în index.js
        taskNameFromRecommendation = this.recommendation_direct_log_ref.task_name;
    } else if (this.recommendation_id) {
        const recommendation = await sequelize.models.MaintenanceRecommendation.findByPk(this.recommendation_id);
        if (recommendation) {
            taskNameFromRecommendation = recommendation.task_name;
        }
    }

    if (!taskNameFromRecommendation && this.schedule_log_ref && this.schedule_log_ref.recommendation_schedule_ref) {
        taskNameFromRecommendation = this.schedule_log_ref.recommendation_schedule_ref.task_name;
    } else if (!taskNameFromRecommendation && this.schedule_id) {
        const schedule = await sequelize.models.VehicleMaintenanceSchedule.findByPk(this.schedule_id, {
            include: [{ model: sequelize.models.MaintenanceRecommendation, as: 'recommendation_schedule_ref'}]
        });
        if (schedule && schedule.recommendation_schedule_ref) {
            taskNameFromRecommendation = schedule.recommendation_schedule_ref.task_name;
        }
    }

    if (taskNameFromRecommendation) {
      data.recommendation_task_name = taskNameFromRecommendation;
    }

    return data;
  };

  return MaintenanceLog;
};
