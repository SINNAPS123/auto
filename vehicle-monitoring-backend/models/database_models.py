from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
import uuid

db = SQLAlchemy()

class Vehicle(db.Model):
    __tablename__ = "vehicles"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vehicle_uid = db.Column(db.String(80), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    license_plate = db.Column(db.String(20), unique=True, nullable=False)
    type = db.Column(db.String(50), nullable=False, default="Nedefinit")
    current_odometer_km = db.Column(db.Float, default=0.0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    track_points = db.relationship('TrackPoint', backref='vehicle_tp_ref', lazy=True, cascade="all, delete-orphan")
    maintenance_schedules = db.relationship('VehicleMaintenanceSchedule', backref='vehicle_schedule_ref', lazy='dynamic', cascade="all, delete-orphan")
    maintenance_logs = db.relationship('MaintenanceLog', backref='vehicle_log_ref', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "vehicle_uid": self.vehicle_uid,
            "license_plate": self.license_plate,
            "type": self.type,
            "current_odometer_km": round(self.current_odometer_km, 1) if self.current_odometer_km is not None else 0.0,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }

class TrackPoint(db.Model):
    __tablename__ = "track_points"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    speed_kmh = db.Column(db.Float, default=0.0)
    fuel_level_percent = db.Column(db.Float, nullable=True)
    distance_since_last_point_km = db.Column(db.Float, nullable=True, default=0.0)

    # Date calculator bord
    engine_rpm = db.Column(db.Integer, nullable=True)
    coolant_temp_celsius = db.Column(db.Integer, nullable=True)
    oil_pressure_bar = db.Column(db.Float, nullable=True)
    battery_voltage = db.Column(db.Float, nullable=True)

    def to_dict(self):
        data = {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "speed_kmh": self.speed_kmh,
            "fuel_level_percent": self.fuel_level_percent,
            "distance_since_last_point_km": self.distance_since_last_point_km,
            "engine_rpm": self.engine_rpm,
            "coolant_temp_celsius": self.coolant_temp_celsius,
            "oil_pressure_bar": self.oil_pressure_bar,
            "battery_voltage": self.battery_voltage
        }
        if hasattr(self, 'vehicle_tp_ref') and self.vehicle_tp_ref:
             data["vehicle_uid"] = self.vehicle_tp_ref.vehicle_uid
        return data

# --- Modele pentru Mentenanță ---
class MaintenanceRecommendation(db.Model):
    __tablename__ = "maintenance_recommendations"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    task_name = db.Column(db.String(150), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    default_interval_km = db.Column(db.Integer, nullable=True)
    default_interval_days = db.Column(db.Integer, nullable=True)
    applies_to_vehicle_type = db.Column(db.String(50), default="Toate")

    schedules = db.relationship('VehicleMaintenanceSchedule', backref='recommendation_schedule_ref', lazy='dynamic')
    direct_logs = db.relationship('MaintenanceLog',
                                  primaryjoin="and_(MaintenanceLog.recommendation_id==MaintenanceRecommendation.id, MaintenanceLog.schedule_id==None)",
                                  backref='recommendation_direct_log_ref',
                                  lazy='dynamic')

    def to_dict(self):
        return {
            "id": self.id, "task_name": self.task_name, "description": self.description,
            "default_interval_km": self.default_interval_km,
            "default_interval_days": self.default_interval_days,
            "applies_to_vehicle_type": self.applies_to_vehicle_type
        }

class VehicleMaintenanceSchedule(db.Model):
    __tablename__ = "vehicle_maintenance_schedules"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    recommendation_id = db.Column(db.Integer, db.ForeignKey('maintenance_recommendations.id'), nullable=False)

    last_service_date = db.Column(db.Date, nullable=True)
    last_service_km = db.Column(db.Float, nullable=True)

    next_due_date = db.Column(db.Date, nullable=True)
    next_due_km = db.Column(db.Float, nullable=True)

    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    __table_args__ = (db.UniqueConstraint('vehicle_id', 'recommendation_id', name='uq_vehicle_recommendation'),)
    logs = db.relationship('MaintenanceLog', backref='schedule_log_ref', lazy='dynamic')

    def to_dict(self):
        data = {
            "id": self.id, "vehicle_id": self.vehicle_id, "recommendation_id": self.recommendation_id,
            "last_service_date": self.last_service_date.isoformat() if self.last_service_date else None,
            "last_service_km": self.last_service_km,
            "next_due_date": self.next_due_date.isoformat() if self.next_due_date else None,
            "next_due_km": self.next_due_km,
            "notes": self.notes, "is_active": self.is_active
        }
        if hasattr(self, 'vehicle_schedule_ref') and self.vehicle_schedule_ref:
            data['vehicle_license_plate'] = self.vehicle_schedule_ref.license_plate
            data['vehicle_current_odometer_km'] = round(self.vehicle_schedule_ref.current_odometer_km,1)
        if hasattr(self, 'recommendation_schedule_ref') and self.recommendation_schedule_ref:
            data['task_name'] = self.recommendation_schedule_ref.task_name
            data['default_interval_km'] = self.recommendation_schedule_ref.default_interval_km
            data['default_interval_days'] = self.recommendation_schedule_ref.default_interval_days
        return data

class MaintenanceLog(db.Model):
    __tablename__ = "maintenance_logs"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    schedule_id = db.Column(db.Integer, db.ForeignKey('vehicle_maintenance_schedules.id'), nullable=True)
    recommendation_id = db.Column(db.Integer, db.ForeignKey('maintenance_recommendations.id'), nullable=True)

    task_performed = db.Column(db.String(200), nullable=False)
    service_date = db.Column(db.Date, nullable=False, default=lambda: date.today())
    serviced_at_km = db.Column(db.Float, nullable=False)

    parts_cost = db.Column(db.Float, nullable=True)
    labor_cost = db.Column(db.Float, nullable=True)
    total_cost = db.Column(db.Float, nullable=True)

    service_provider = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        data= {
            "id": self.id, "vehicle_id": self.vehicle_id, "schedule_id": self.schedule_id,
            "recommendation_id": self.recommendation_id, "task_performed": self.task_performed,
            "service_date": self.service_date.isoformat() if self.service_date else None,
            "serviced_at_km": self.serviced_at_km, "parts_cost": self.parts_cost,
            "labor_cost": self.labor_cost, "total_cost": self.total_cost,
            "service_provider": self.service_provider, "notes": self.notes,
            "created_at": self.created_at.isoformat() + "Z"
        }
        if hasattr(self, 'vehicle_log_ref') and self.vehicle_log_ref:
            data['vehicle_license_plate'] = self.vehicle_log_ref.license_plate

        task_name_from_recommendation = None
        if self.recommendation_id:
            recommendation = MaintenanceRecommendation.query.get(self.recommendation_id)
            if recommendation: task_name_from_recommendation = recommendation.task_name
        elif self.schedule_id and hasattr(self, 'schedule_log_ref') and self.schedule_log_ref:
             if hasattr(self.schedule_log_ref, 'recommendation_schedule_ref') and self.schedule_log_ref.recommendation_schedule_ref:
                task_name_from_recommendation = self.schedule_log_ref.recommendation_schedule_ref.task_name

        if task_name_from_recommendation:
            data['recommendation_task_name'] = task_name_from_recommendation

        return data
