from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
import os
from datetime import datetime, timezone, timedelta, date
from calendar import monthrange
import math # Pentru calculul distanței

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# Importăm db și modelele DUPĂ ce sys.path este configurat
from models.database_models import db, Vehicle, TrackPoint, MaintenanceRecommendation, VehicleMaintenanceSchedule, MaintenanceLog

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'vehicle_monitor.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = False

db.init_app(app)

# --- Funcție Helper pentru Distanță ---
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Raza Pământului în km
    if None in [lat1, lon1, lat2, lon2]: return 0.0

    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlon, dlat = lon2_rad - lon1_rad, lat2_rad - lat1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# --- Populare Recomandări Mentenanță ---
def populate_maintenance_recommendations():
    """Adaugă recomandări de mentenanță standard în DB dacă nu există."""
    recommendations_data = [
        {"task_name": "Schimb ulei motor și filtru ulei", "default_interval_km": 15000, "default_interval_days": 365, "applies_to_vehicle_type": "Toate"},
        {"task_name": "Verificare și înlocuire filtru aer", "default_interval_km": 30000, "default_interval_days": 730, "applies_to_vehicle_type": "Toate"},
        {"task_name": "Verificare și înlocuire filtru combustibil", "default_interval_km": 60000, "default_interval_days": 730, "applies_to_vehicle_type": "Toate"},
        {"task_name": "Verificare plăcuțe de frână", "default_interval_km": 20000, "default_interval_days": 365, "applies_to_vehicle_type": "Toate"},
        {"task_name": "Înlocuire lichid de frână", "default_interval_days": 730, "applies_to_vehicle_type": "Toate"},
        {"task_name": "ITP (Inspecție Tehnică Periodică)", "default_interval_days": 365, "applies_to_vehicle_type": "Toate"},
    ]
    existing_tasks = [r.task_name for r in MaintenanceRecommendation.query.all()]
    added_count = 0
    for rec_data in recommendations_data:
        if rec_data["task_name"] not in existing_tasks:
            rec = MaintenanceRecommendation(**rec_data)
            db.session.add(rec)
            added_count +=1
    if added_count > 0:
        try:
            db.session.commit()
            print(f"Adăugat {added_count} recomandări de mentenanță noi.")
        except Exception as e:
            db.session.rollback()
            print(f"Eroare la adăugarea recomandărilor de mentenanță: {e}")

active_vehicle_simulators = []

def initialize_db_vehicles(num_vehicles_to_ensure=10):
    global active_vehicle_simulators
    import random

    current_vehicle_count_in_db = Vehicle.query.count()
    needed = num_vehicles_to_ensure - current_vehicle_count_in_db

    if needed > 0:
        print(f"Se adaugă {needed} vehicule noi în DB.")
        for i in range(needed):
            vehicle_uid_candidate = f"RO_DB_{current_vehicle_count_in_db + i + 1:03}"
            while Vehicle.query.filter_by(vehicle_uid=vehicle_uid_candidate).first():
                 vehicle_uid_candidate = f"RO_DB_{current_vehicle_count_in_db + i + 1 + random.randint(100,200):03}"

            plate_prefix = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=random.choice([1,2])))
            plate_digits = "".join(random.choices("0123456789", k=random.choice([2,3])))
            plate_suffix = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=3))
            plate_candidate = f"{plate_prefix}{plate_digits}{plate_suffix}"
            while Vehicle.query.filter_by(license_plate=plate_candidate).first(): # Asigură unicitatea plăcuței
                plate_digits = "".join(random.choices("0123456789", k=random.choice([2,3])))
                plate_candidate = f"{plate_prefix}{plate_digits}{plate_suffix}"

            vehicle = Vehicle(
                vehicle_uid=vehicle_uid_candidate,
                license_plate=plate_candidate,
                type=random.choice(["Camion frigorific", "Autoutilitară", "Autoturism", "Autobuz"]),
                current_odometer_km=round(random.uniform(5000, 150000),1)
            )
            db.session.add(vehicle)
        try:
            db.session.commit()
            print(f"{needed} vehicule noi adăugate în DB.")
        except Exception as e:
            db.session.rollback()
            print(f"Eroare la adăugarea vehiculelor noi: {e}")
            return

    all_db_vehicles = Vehicle.query.all()
    all_recommendations = MaintenanceRecommendation.query.all()

    for v_db in all_db_vehicles:
        for rec in all_recommendations:
            if rec.applies_to_vehicle_type == "Toate" or rec.applies_to_vehicle_type == v_db.type:
                exists = VehicleMaintenanceSchedule.query.filter_by(vehicle_id=v_db.id, recommendation_id=rec.id).first()
                if not exists:
                    schedule_entry = VehicleMaintenanceSchedule(vehicle_id=v_db.id, recommendation_id=rec.id)
                    # Inițial, next_due_date și next_due_km pot fi calculate pe baza datei curente și a kilometrajului vehiculului
                    # dacă nu există un istoric de service. Sau lăsate null și calculate la prima vizualizare/logare.
                    # Pentru simplitate, le lăsăm null și le vom calcula la cerere sau la logarea unui service.
                    db.session.add(schedule_entry)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Eroare la crearea programelor de mentenanță: {e}")

    active_vehicle_simulators = [] # Resetăm simulatorul înainte de a-l repopula
    for v_db_sim in all_db_vehicles: # Folosim lista actualizată din DB
        last_tp = TrackPoint.query.filter_by(vehicle_id=v_db_sim.id).order_by(TrackPoint.timestamp.desc()).first()
        sim = {
            "db_id": v_db_sim.id, "vehicle_uid": v_db_sim.vehicle_uid,
            "license_plate": v_db_sim.license_plate, "type": v_db_sim.type,
            "latitude": last_tp.latitude if last_tp else random.uniform(43.6, 48.2),
            "longitude": last_tp.longitude if last_tp else random.uniform(20.2, 29.7),
            "speed_kmh": last_tp.speed_kmh if last_tp else random.uniform(0, 90),
            "fuel_level_percent": last_tp.fuel_level_percent if last_tp and last_tp.fuel_level_percent is not None else random.uniform(30, 100),
            "status": "Idle", "last_updated": datetime.now(timezone.utc),
            "current_odometer_km": v_db_sim.current_odometer_km
        }
        sim["status"] = "Moving" if sim["speed_kmh"] > 5 else "Idle"
        active_vehicle_simulators.append(sim)

    if active_vehicle_simulators:
        print(f"Simulator inițializat/actualizat cu {len(active_vehicle_simulators)} vehicule.")
    else:
        print("Atenție: Simulatorul este gol după inițializare.")


def run_simulation_step_and_save():
    global active_vehicle_simulators
    import random
    ROMANIA_BOUNDS = {"min_lat": 43.6, "max_lat": 48.2, "min_lon": 20.2, "max_lon": 29.7}
    if not active_vehicle_simulators: return

    new_trackpoints_batch = []
    vehicles_to_update_in_db = {}

    for sim_vehicle in active_vehicle_simulators:
        prev_lat, prev_lon = sim_vehicle["latitude"], sim_vehicle["longitude"]

        if sim_vehicle["speed_kmh"] > 0 or random.random() < 0.1:
            lat_change = random.uniform(-0.001, 0.001) * (sim_vehicle["speed_kmh"] / 50 + 0.1)
            lon_change = random.uniform(-0.001, 0.001) * (sim_vehicle["speed_kmh"] / 50 + 0.1)
            sim_vehicle["latitude"] = max(ROMANIA_BOUNDS["min_lat"], min(sim_vehicle["latitude"] + lat_change, ROMANIA_BOUNDS["max_lat"]))
            sim_vehicle["longitude"] = max(ROMANIA_BOUNDS["min_lon"], min(sim_vehicle["longitude"] + lon_change, ROMANIA_BOUNDS["max_lon"]))

        if random.random() < 0.3:
            current_accel = random.randint(-10, 10)
            sim_vehicle["speed_kmh"] = max(0, min(130, sim_vehicle["speed_kmh"] + current_accel))

        sim_vehicle["status"] = "Moving" if sim_vehicle["speed_kmh"] > 1 else "Idle"
        current_timestamp = datetime.now(timezone.utc) # Timestamp consistent pentru acest pas
        sim_vehicle["last_updated"] = current_timestamp


        if sim_vehicle["speed_kmh"] > 0:
            fuel_consumed = (sim_vehicle["speed_kmh"] / 100) * random.uniform(0.05, 0.15)
            sim_vehicle["fuel_level_percent"] -= fuel_consumed
            if sim_vehicle["fuel_level_percent"] < 0: sim_vehicle["fuel_level_percent"] = 0

        distance_this_step = 0.0
        if sim_vehicle["speed_kmh"] > 1: # Calculăm distanța doar dacă se mișcă
             distance_this_step = haversine_distance(prev_lat, prev_lon, sim_vehicle["latitude"], sim_vehicle["longitude"])

        sim_vehicle["current_odometer_km"] += distance_this_step
        vehicles_to_update_in_db[sim_vehicle["db_id"]] = sim_vehicle["current_odometer_km"]

        # Simulare date calculator bord
        sim_engine_rpm = 0
        sim_coolant_temp = sim_vehicle.get("coolant_temp_celsius", 20) # Păstrăm temp dacă există, altfel default rece
        sim_oil_pressure = 0.0
        sim_battery_voltage = sim_vehicle.get("battery_voltage", 12.5 + random.uniform(-0.2, 0.2))

        if sim_vehicle["status"] == "Moving" or sim_vehicle["speed_kmh"] > 1: # Motor pornit
            sim_engine_rpm = int(750 + sim_vehicle["speed_kmh"] * 22 + random.uniform(-150, 150))
            if sim_engine_rpm < 700: sim_engine_rpm = 700
            if sim_engine_rpm > 5000: sim_engine_rpm = 5000

            sim_coolant_temp_increase = sim_vehicle["speed_kmh"] * 0.15 + random.uniform(0,0.5)
            sim_coolant_temp = min(98, sim_coolant_temp + sim_coolant_temp_increase) # Crește treptat
            if sim_coolant_temp < 60 : sim_coolant_temp = 60 # Temp minimă de funcționare

            sim_oil_pressure = round(1.2 + (sim_engine_rpm / 1000) * 0.6 + random.uniform(-0.2, 0.2), 1)
            if sim_oil_pressure < 0.8: sim_oil_pressure = 0.8
            if sim_oil_pressure > 5.0: sim_oil_pressure = 5.0

            sim_battery_voltage = 13.7 + random.uniform(-0.2, 0.2)
        else: # Motor oprit
            sim_engine_rpm = 0
            sim_coolant_temp = max(20, sim_coolant_temp - random.uniform(0.1, 0.5)) # Se răcește lent
            sim_oil_pressure = 0.0
            # sim_battery_voltage scade foarte lent, omitem pentru simplitate acum

        sim_vehicle["engine_rpm"] = sim_engine_rpm
        sim_vehicle["coolant_temp_celsius"] = int(sim_coolant_temp)
        sim_vehicle["oil_pressure_bar"] = sim_oil_pressure
        sim_vehicle["battery_voltage"] = round(sim_battery_voltage, 1)


        tp = TrackPoint(
            vehicle_id=sim_vehicle["db_id"], timestamp=current_timestamp, # Folosim timestamp-ul consistent
            latitude=round(sim_vehicle["latitude"], 6), longitude=round(sim_vehicle["longitude"], 6),
            speed_kmh=round(sim_vehicle["speed_kmh"], 2),
            fuel_level_percent=round(sim_vehicle["fuel_level_percent"], 2) if sim_vehicle["fuel_level_percent"] is not None else None,
            distance_since_last_point_km=round(distance_this_step, 3),
            # Date noi calculator bord
            engine_rpm=sim_vehicle.get("engine_rpm"),
            coolant_temp_celsius=sim_vehicle.get("coolant_temp_celsius"),
            oil_pressure_bar=sim_vehicle.get("oil_pressure_bar"),
            battery_voltage=sim_vehicle.get("battery_voltage")
        )
        new_trackpoints_batch.append(tp)

    # Simulare date calculator bord - se adaugă în sim_vehicle înainte de crearea TrackPoint
    # Această secțiune este adăugată mai sus, în bucla principală for sim_vehicle...

    if new_trackpoints_batch:
        try:
            db.session.add_all(new_trackpoints_batch)
            for vehicle_id_to_update, new_odometer in vehicles_to_update_in_db.items():
                # Folosim db.session.get care este optimizat pentru PK lookup
                vehicle_in_db = db.session.get(Vehicle, vehicle_id_to_update)
                if vehicle_in_db:
                    vehicle_in_db.current_odometer_km = new_odometer
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Eroare la salvarea batch TrackPoints sau actualizare kilometraj: {e}")

# ... (restul endpoint-urilor definite anterior: get_current_simulated_positions, create_db_command_wrapper, home_route, etc.)
# Asigură-te că toate endpoint-urile și funcțiile helper sunt aici.

@app.cli.command("create-db")
def create_db_command_wrapper():
    with app.app_context():
        db.create_all()
        print("Baza de date și tabelele au fost create (sau verificate).")
        populate_maintenance_recommendations() # Adăugat aici
        initialize_db_vehicles(10)
        print("Recomandări și vehicule de test inițializate/verificate.")

@app.route('/')
def home_route():
    return f"Server Backend v2.3 (Mentenanță). DB: {app.config['SQLALCHEMY_DATABASE_URI']}. Vehicule simulate: {len(active_vehicle_simulators)}"

@app.route('/api/vehicles/positions', methods=['GET'])
def get_vehicle_positions_api():
    if not active_vehicle_simulators:
        with app.app_context():
             initialize_db_vehicles(10)
    run_simulation_step_and_save()
    return jsonify(get_current_simulated_positions())

@app.route('/api/vehicles', methods=['GET'])
def get_vehicles_list_api():
    vehicles_from_db = Vehicle.query.order_by(Vehicle.vehicle_uid).all()
    return jsonify([v.to_dict() for v in vehicles_from_db])

@app.route('/api/vehicles/<string:vehicle_uid>/history', methods=['GET'])
def get_vehicle_history_api(vehicle_uid):
    vehicle = Vehicle.query.filter_by(vehicle_uid=vehicle_uid).first()
    if not vehicle: return jsonify({"error": "Vehicul negăsit"}), 404

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    query = TrackPoint.query.filter_by(vehicle_id=vehicle.id)

    try:
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '')).replace(tzinfo=timezone.utc)
        else: # Default la ultimele 24 de ore
            start_date = datetime.now(timezone.utc) - timedelta(days=1)
        query = query.filter(TrackPoint.timestamp >= start_date)

        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '')).replace(tzinfo=timezone.utc)
        else: # Default la acum
             end_date = datetime.now(timezone.utc)
        query = query.filter(TrackPoint.timestamp <= end_date)
    except ValueError as e:
        return jsonify({"error": f"Format dată invalid: {e}. Folosiți ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)"}), 400

    query = query.order_by(TrackPoint.timestamp.asc())
    limit = request.args.get('limit', default=300, type=int)
    track_points = query.limit(limit).all()
    return jsonify([tp.to_dict() for tp in track_points])

@app.route('/api/vehicles/<string:vehicle_uid>/fuel_history', methods=['GET'])
def get_vehicle_fuel_history(vehicle_uid):
    vehicle = Vehicle.query.filter_by(vehicle_uid=vehicle_uid).first()
    if not vehicle: return jsonify({"error": "Vehicul negăsit"}), 404

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    query = TrackPoint.query.filter_by(vehicle_id=vehicle.id)

    try:
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '')).replace(tzinfo=timezone.utc)
        else:
            start_date = datetime.now(timezone.utc) - timedelta(days=1)
        query = query.filter(TrackPoint.timestamp >= start_date)

        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '')).replace(tzinfo=timezone.utc)
        else:
            end_date = datetime.now(timezone.utc)
        query = query.filter(TrackPoint.timestamp <= end_date)
    except ValueError as e:
        return jsonify({"error": f"Format dată invalid: {e}. Folosiți ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)"}), 400

    query = query.with_entities(TrackPoint.timestamp, TrackPoint.fuel_level_percent).order_by(TrackPoint.timestamp.asc())
    limit = request.args.get('limit', default=300, type=int)
    fuel_data_points = query.limit(limit).all()
    result = [{"timestamp": tp.timestamp.isoformat(), "fuel_level_percent": tp.fuel_level_percent} for tp in fuel_data_points if tp.fuel_level_percent is not None]
    return jsonify(result)

def calculate_operating_seconds(track_points_list): # Renamed to avoid conflict
    if not track_points_list or len(track_points_list) < 2: return 0
    total_operating_seconds = 0
    for i in range(len(track_points_list) - 1):
        current_point, next_point = track_points_list[i], track_points_list[i+1]
        if current_point.speed_kmh > 1.0:
            current_ts = current_point.timestamp.replace(tzinfo=timezone.utc) if current_point.timestamp.tzinfo is None else current_point.timestamp
            next_ts = next_point.timestamp.replace(tzinfo=timezone.utc) if next_point.timestamp.tzinfo is None else next_point.timestamp
            duration_interval_seconds = (next_ts - current_ts).total_seconds()
            if duration_interval_seconds > 0: total_operating_seconds += duration_interval_seconds
    return total_operating_seconds

@app.route('/api/vehicles/<string:vehicle_uid>/operating_summary', methods=['GET'])
def get_vehicle_operating_summary(vehicle_uid):
    vehicle = Vehicle.query.filter_by(vehicle_uid=vehicle_uid).first()
    if not vehicle: return jsonify({"error": "Vehicul negăsit"}), 404

    period = request.args.get('period', 'day')
    date_str = request.args.get('date')
    if not date_str: return jsonify({"error": "Parametrul 'date' (YYYY-MM-DD) este obligatoriu."}), 400

    try:
        ref_date = datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
    except ValueError:
        return jsonify({"error": "Format dată invalid pentru 'date'. Folosiți YYYY-MM-DD."}), 400

    if period == 'day':
        start_datetime_utc = ref_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_datetime_utc = ref_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period == 'week':
        start_of_week = ref_date - timedelta(days=ref_date.weekday())
        start_datetime_utc = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end_datetime_utc = (start_of_week + timedelta(days=6)).replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period == 'month':
        start_datetime_utc = ref_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        num_days_in_month = monthrange(ref_date.year, ref_date.month)[1]
        end_datetime_utc = ref_date.replace(day=num_days_in_month, hour=23, minute=59, second=59, microsecond=999999)
    else:
        return jsonify({"error": "Valoare invalidă pentru 'period'. Folosiți 'day', 'week', sau 'month'."}), 400

    track_points_for_period = TrackPoint.query.filter(
        TrackPoint.vehicle_id == vehicle.id,
        TrackPoint.timestamp >= start_datetime_utc,
        TrackPoint.timestamp <= end_datetime_utc
    ).order_by(TrackPoint.timestamp.asc()).all()

    operating_seconds = calculate_operating_seconds(track_points_for_period)
    msg = f"{len(track_points_for_period)} puncte analizate."
    if not track_points_for_period or len(track_points_for_period) < 2 :
        msg = "Nu sunt suficiente date de traseu pentru a calcula orele de funcționare." if track_points_for_period else "Niciun punct de traseu găsit."

    return jsonify({
        "vehicle_uid": vehicle_uid, "period_type": period, "reference_date_for_period": date_str,
        "calculated_period_start_utc": start_datetime_utc.isoformat(),
        "calculated_period_end_utc": end_datetime_utc.isoformat(),
        "total_operating_seconds": operating_seconds,
        "total_operating_hours": round(operating_seconds / 3600, 2),
        "details": msg
    })

def get_current_simulated_positions(): # Definiția acestei funcții lipsea, o preiau de la o versiune anterioară
    positions = []
    for sim_v in active_vehicle_simulators:
        data_to_send = {
            "id": sim_v["vehicle_uid"],
            "vehicle_uid": sim_v["vehicle_uid"], "license_plate": sim_v["license_plate"],
            "type": sim_v["type"], "latitude": round(sim_v["latitude"],6), "longitude": round(sim_v["longitude"],6),
            "speed_kmh": round(sim_v["speed_kmh"],2),
            "fuel_level_percent": round(sim_v["fuel_level_percent"],2) if sim_v["fuel_level_percent"] is not None else None,
            "status": sim_v["status"], "last_updated": sim_v["last_updated"].isoformat(),
            "current_odometer_km": round(sim_v["current_odometer_km"], 1),
            # Date noi calculator bord
            "engine_rpm": sim_v.get("engine_rpm"),
            "coolant_temp_celsius": sim_v.get("coolant_temp_celsius"),
            "oil_pressure_bar": sim_v.get("oil_pressure_bar"),
            "battery_voltage": sim_v.get("battery_voltage")
        }
        positions.append(data_to_send)
    return positions

def main_app_setup():
    print("Verificare și creare DB la pornire (dacă e necesar)...")
    db_path = os.path.join(BASE_DIR, 'vehicle_monitor.db')
    # Verificăm dacă calea către fișierul DB este validă și dacă avem permisiuni
    try:
        # Forțăm crearea directoarelor părinte dacă nu există, deși BASE_DIR ar trebui să existe
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        if not os.path.exists(db_path):
            print(f"Fișierul DB nu există la {db_path}. Se creează DB și tabelele...")
            db.create_all()
            populate_maintenance_recommendations()
            initialize_db_vehicles(10)
            print("DB creat, recomandări și vehicule inițializate.")
        else:
            print(f"Fișierul DB există la {db_path}. Se verifică recomandările și se populează simulatorul...")
            # Chiar dacă DB există, e bine să ne asigurăm că recomandările sunt populate
            # și simulatorul este inițializat corect.
            populate_maintenance_recommendations()
            initialize_db_vehicles(10)
        print(f"Setup complet. {len(active_vehicle_simulators)} vehicule în simulator.")
    except Exception as e:
        print(f"EROARE majoră la setup-ul bazei de date: {e}")
        print("Verificați permisiunile de scriere și calea către baza de date.")


with app.app_context():
    main_app_setup()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=True)


# --- API-uri și Logică pentru Mentenanță ---

def update_maintenance_schedule_due_dates(schedule_id):
    """
    Actualizează next_due_date și next_due_km pentru un anumit schedule entry
    pe baza ultimului service logat pentru acel schedule sau, dacă nu există,
    pe baza datelor vehiculului și recomandării.
    """
    schedule = db.session.get(VehicleMaintenanceSchedule, schedule_id) # Folosim db.session.get pentru PK
    if not schedule:
        print(f"Schedule cu ID {schedule_id} negăsit pentru actualizare scadențe.")
        return False

    # vehicle = db.session.get(Vehicle, schedule.vehicle_id) # Nu mai e nevoie, avem vehicle_schedule_ref
    # recommendation = db.session.get(MaintenanceRecommendation, schedule.recommendation_id)
    if not schedule.vehicle_schedule_ref or not schedule.recommendation_schedule_ref:
        print(f"Date inconsistente pentru schedule {schedule_id}: vehicul sau recomandare lipsă.")
        return False

    vehicle = schedule.vehicle_schedule_ref
    recommendation = schedule.recommendation_schedule_ref

    # Căutăm ultimul log de mentenanță pentru acest schedule specific
    last_log_for_schedule = MaintenanceLog.query.filter_by(schedule_id=schedule.id)\
                                             .order_by(MaintenanceLog.service_date.desc(), MaintenanceLog.serviced_at_km.desc())\
                                             .first()

    last_service_date_to_use = None
    last_service_km_to_use = None

    if last_log_for_schedule:
        schedule.last_service_date = last_log_for_schedule.service_date
        schedule.last_service_km = last_log_for_schedule.serviced_at_km
        last_service_date_to_use = last_log_for_schedule.service_date
        last_service_km_to_use = last_log_for_schedule.serviced_at_km
    else:
        # Nu există service logat pentru acest schedule.
        # Folosim data creării vehiculului și km 0 ca bază pentru primul calcul.
        # Sau, dacă schedule-ul are deja un last_service_date/km (setat manual la creare), îl folosim.
        if schedule.last_service_date and schedule.last_service_km is not None:
            last_service_date_to_use = schedule.last_service_date
            last_service_km_to_use = schedule.last_service_km
        else:
            last_service_date_to_use = vehicle.created_at.date()
            last_service_km_to_use = 0 # Presupunem că începe de la 0 pentru această recomandare dacă nu e specificat altfel

    # Calculăm next_due_km
    if recommendation.default_interval_km and last_service_km_to_use is not None:
        schedule.next_due_km = last_service_km_to_use + recommendation.default_interval_km
    else:
        schedule.next_due_km = None

    # Calculăm next_due_date
    if recommendation.default_interval_days and last_service_date_to_use is not None:
        schedule.next_due_date = last_service_date_to_use + timedelta(days=recommendation.default_interval_days)
    else:
        schedule.next_due_date = None

    try:
        # Nu facem commit aici, apelantul va face commit după toate actualizările necesare.
        # db.session.add(schedule) # Entitatea este deja în sesiune și modificată.
        return True
    except Exception as e:
        # db.session.rollback() # Rollback-ul ar trebui făcut de apelant la nivel superior
        print(f"Eroare (logică) la actualizarea scadențelor pentru schedule {schedule_id}: {e}")
        return False


@app.route('/api/maintenance/recommendations', methods=['GET'])
def get_maintenance_recommendations_api(): # Nume diferit pentru a nu suprascrie variabila globală
    recommendations = MaintenanceRecommendation.query.order_by(MaintenanceRecommendation.task_name).all()
    return jsonify([rec.to_dict() for rec in recommendations])

@app.route('/api/vehicles/<string:vehicle_uid>/maintenance_status', methods=['GET'])
def get_vehicle_maintenance_status_api(vehicle_uid): # Nume diferit
    vehicle = Vehicle.query.filter_by(vehicle_uid=vehicle_uid).first()
    if not vehicle:
        return jsonify({"error": "Vehicul negăsit"}), 404

    schedules_for_vehicle = VehicleMaintenanceSchedule.query.filter_by(vehicle_id=vehicle.id, is_active=True).all()

    updated_schedules_data = []
    for sched in schedules_for_vehicle:
        update_maintenance_schedule_due_dates(sched.id) # Recalculăm la fiecare cerere
        # După update_maintenance_schedule_due_dates, schedule (sched) este modificat în sesiune.
        # Trebuie să facem commit pentru a persista schimbările DUPĂ buclă.
        updated_schedules_data.append(sched.to_dict()) # Colectăm datele actualizate

    try:
        db.session.commit() # Persistăm toate scadențele actualizate
    except Exception as e:
        db.session.rollback()
        print(f"Eroare la commit după actualizarea statusului de mentenanță pentru {vehicle_uid}: {e}")
        return jsonify({"error": "Eroare la actualizarea statusului de mentenanță."}), 500

    # Sortăm după task_name dacă e posibil (task_name e adăugat în to_dict)
    updated_schedules_data.sort(key=lambda x: x.get('task_name', ''))

    return jsonify(updated_schedules_data)


@app.route('/api/maintenance_logs', methods=['POST'])
def create_maintenance_log_api(): # Nume diferit
    data = request.get_json()
    if not data:
        return jsonify({"error": "Lipsesc datele (request body invalid JSON)"}), 400

    required_fields = ['vehicle_uid', 'task_performed', 'service_date', 'serviced_at_km']
    for field in required_fields:
        if field not in data or data[field] is None or str(data[field]).strip() == "":
            return jsonify({"error": f"Câmpul '{field}' este obligatoriu și nu poate fi gol."}), 400

    vehicle = Vehicle.query.filter_by(vehicle_uid=data['vehicle_uid']).first()
    if not vehicle:
        return jsonify({"error": f"Vehiculul cu UID {data['vehicle_uid']} nu a fost găsit."}), 404

    try:
        service_date_obj = datetime.strptime(data['service_date'], '%Y-%m-%d').date()
        serviced_at_km_float = float(data['serviced_at_km'])
        if serviced_at_km_float < 0:
             return jsonify({"error": "Kilometrajul la service nu poate fi negativ."}), 400
    except ValueError:
        return jsonify({"error": "Format invalid pentru 'service_date' (YYYY-MM-DD) sau 'serviced_at_km' (număr)."}), 400

    new_log = MaintenanceLog(
        vehicle_id=vehicle.id,
        task_performed=data['task_performed'],
        service_date=service_date_obj,
        serviced_at_km=serviced_at_km_float,
        schedule_id=data.get('schedule_id'),
        recommendation_id=data.get('recommendation_id'),
        parts_cost=float(data['parts_cost']) if data.get('parts_cost') is not None else None,
        labor_cost=float(data['labor_cost']) if data.get('labor_cost') is not None else None,
        total_cost=float(data['total_cost']) if data.get('total_cost') is not None else None,
        service_provider=data.get('service_provider'),
        notes=data.get('notes')
    )

    if serviced_at_km_float > vehicle.current_odometer_km:
        vehicle.current_odometer_km = serviced_at_km_float

    try:
        db.session.add(new_log)
        # db.session.flush() # Pentru a obține ID-ul new_log.id dacă e necesar înainte de commit

        # Actualizăm schedule-ul asociat, dacă există
        schedule_to_update_id = None
        if new_log.schedule_id:
            schedule_to_update_id = new_log.schedule_id
        elif new_log.recommendation_id: # Dacă nu e legat de un schedule, dar e de o recomandare
             schedule_found = VehicleMaintenanceSchedule.query.filter_by(
                 vehicle_id=vehicle.id,
                 recommendation_id=new_log.recommendation_id
             ).first()
             if schedule_found:
                 schedule_to_update_id = schedule_found.id
                 # Opcional: leagă log-ul de schedule dacă nu era legat explicit
                 if not new_log.schedule_id: new_log.schedule_id = schedule_found.id


        if schedule_to_update_id:
            # Pentru a evita probleme de sesiune, facem flush să obținem ID-ul log-ului
            # și apoi actualizăm schedule-ul. Sau, mai simplu, facem commit și apoi actualizăm.
            # Voi alege să fac commit la log și apoi să actualizez schedule-ul.
            # Aceasta înseamnă că update_maintenance_schedule_due_dates va face propriul commit.
            # Sau, mai bine, funcția de update nu face commit, iar noi facem un singur commit aici.
            pass # Logica de actualizare schedule va fi apelată după commit-ul principal

        db.session.commit() # Commit principal pentru log și actualizarea kilometrajului vehiculului

        if schedule_to_update_id:
            update_successful = update_maintenance_schedule_due_dates(schedule_to_update_id)
            if update_successful:
                db.session.commit() # Commit pentru actualizarea schedule-ului
            else: # Rollback dacă actualizarea schedule-ului a eșuat logic, deși log-ul e salvat
                # Acest caz e complicat. Momentan lăsăm log-ul salvat.
                print(f"Atenție: Log-ul {new_log.id} salvat, dar actualizarea schedule-ului {schedule_to_update_id} a eșuat logic.")


        return jsonify(new_log.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Eroare la crearea log-ului de mentenanță: {e}")
        return jsonify({"error": f"Eroare internă la salvarea log-ului: {str(e)}"}), 500

# --- Sfârșit API-uri și Logică pentru Mentenanță ---
```
