const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TrackPoint = sequelize.define("TrackPoint", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // vehicle_id este adăugat automat de Sequelize prin asociere
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    speed_kmh: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
    },
    fuel_level_percent: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    distance_since_last_point_km: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
    },
    engine_rpm: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    coolant_temp_celsius: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    oil_pressure_bar: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    battery_voltage: {
      type: DataTypes.FLOAT,
      allowNull: true,
    }
  }, {
    tableName: "track_points",
    timestamps: false, // De obicei, track points nu au nevoie de updatedAt; timestamp-ul e cel specific evenimentului
  });

  TrackPoint.prototype.toDict = async function () {
    const data = {
      id: this.id,
      timestamp: this.timestamp ? this.timestamp.toISOString() : null,
      latitude: this.latitude,
      longitude: this.longitude,
      speed_kmh: this.speed_kmh,
      fuel_level_percent: this.fuel_level_percent,
      distance_since_last_point_km: this.distance_since_last_point_km,
      engine_rpm: this.engine_rpm,
      coolant_temp_celsius: this.coolant_temp_celsius,
      oil_pressure_bar: this.oil_pressure_bar,
      battery_voltage: this.battery_voltage,
      vehicle_id: this.vehicle_id // Adăugat pentru referință, deși nu era în cel Python
    };
    // În modelul Python, vehicle_uid era adăugat condiționat.
    // Putem face la fel aici dacă este necesar, încărcând asocierea.
    if (this.vehicle_tp_ref) { // Presupunând că 'vehicle_tp_ref' este aliasul definit în index.js
      data.vehicle_uid = this.vehicle_tp_ref.vehicle_uid;
    } else {
      // Opțional: Încărcăm manual dacă nu a fost eager-loaded
      const vehicle = await this.getVehicle_tp_ref(); // Metoda generată de Sequelize
      if (vehicle) {
        data.vehicle_uid = vehicle.vehicle_uid;
      }
    }
    return data;
  };

  return TrackPoint;
};
