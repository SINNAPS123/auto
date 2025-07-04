const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Vehicle = sequelize.define("Vehicle", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehicle_uid: {
      type: DataTypes.STRING(80),
      unique: true,
      allowNull: false,
      defaultValue: () => uuidv4(),
    },
    license_plate: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Nedefinit",
    },
    current_odometer_km: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    created_at: { // Sequelize gestionează automat createdAt și updatedAt
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    }
  }, {
    tableName: "vehicles",
    timestamps: true, // Activează createdAt și updatedAt
    updatedAt: 'updated_at', // redenumește updatedAt pentru consistență dacă dorim
    createdAt: 'created_at'
  });

  // Adăugarea metodei toDict similar cu cea din Python
  Vehicle.prototype.toDict = function () {
    return {
      id: this.id,
      vehicle_uid: this.vehicle_uid,
      license_plate: this.license_plate,
      type: this.type,
      current_odometer_km: this.current_odometer_km !== null ? parseFloat(this.current_odometer_km.toFixed(1)) : 0.0,
      created_at: this.created_at ? this.created_at.toISOString() : null,
      // updated_at: this.updated_at ? this.updated_at.toISOString() : null // dacă e relevant
    };
  };

  return Vehicle;
};
