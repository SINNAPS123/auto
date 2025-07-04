const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MaintenanceRecommendation = sequelize.define("MaintenanceRecommendation", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    task_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    default_interval_km: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    default_interval_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    applies_to_vehicle_type: {
      type: DataTypes.STRING(50),
      defaultValue: "Toate",
    }
  }, {
    tableName: "maintenance_recommendations",
    timestamps: false, // Acestea sunt date de referință, nu necesită timestamps de creare/modificare
  });

  MaintenanceRecommendation.prototype.toDict = function () {
    return {
      id: this.id,
      task_name: this.task_name,
      description: this.description,
      default_interval_km: this.default_interval_km,
      default_interval_days: this.default_interval_days,
      applies_to_vehicle_type: this.applies_to_vehicle_type,
    };
  };

  return MaintenanceRecommendation;
};
