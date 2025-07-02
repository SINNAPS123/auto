import random
import time
from models.vehicle import Vehicle # Asigură-te că models este în PYTHONPATH sau calea relativă e corectă

# Limite geografice aproximative pentru România
ROMANIA_BOUNDS = {
    "min_lat": 43.6,
    "max_lat": 48.2,
    "min_lon": 20.2,
    "max_lon": 29.7
}

# O listă globală pentru a ține evidența vehiculelor simulate
active_vehicles = []

def initialize_vehicles(num_vehicles=5):
    """Creează un număr specificat de vehicule."""
    global active_vehicles
    active_vehicles = [] # Resetăm lista la fiecare inițializare
    for i in range(num_vehicles):
        # Atribuim ID-uri mai simple pentru testare
        v = Vehicle(vehicle_id=f"RO_CAR_{i+1:03}")
        # Asigurăm că poziția inițială este în limitele României
        v.latitude = random.uniform(ROMANIA_BOUNDS["min_lat"], ROMANIA_BOUNDS["max_lat"])
        v.longitude = random.uniform(ROMANIA_BOUNDS["min_lon"], ROMANIA_BOUNDS["max_lon"])
        active_vehicles.append(v)
    print(f"{num_vehicles} vehicule inițializate.")

def simulate_vehicle_movement():
    """Simulează mișcarea vehiculelor active."""
    global active_vehicles
    if not active_vehicles:
        # print("Niciun vehicul activ de simulat. Rulează initialize_vehicles() întâi.")
        return

    for vehicle in active_vehicles:
        # Simulare simplă de mișcare: schimbare mică a coordonatelor
        # Direcția mișcării poate fi aleatorie sau menținută pentru câteva iterații

        # Schimbare mică în latitudine și longitudine
        # Factorul de deplasare (cât de mult se mișcă per pas)
        # 0.001 grade latitudine ~ 111 metri
        # 0.001 grade longitudine ~ 70-80 metri la latitudinea României
        lat_change = random.uniform(-0.005, 0.005)
        lon_change = random.uniform(-0.005, 0.005)

        new_lat = vehicle.latitude + lat_change
        new_lon = vehicle.longitude + lon_change

        # Verificăm dacă rămâne în limitele aproximative ale României
        new_lat = max(ROMANIA_BOUNDS["min_lat"], min(new_lat, ROMANIA_BOUNDS["max_lat"]))
        new_lon = max(ROMANIA_BOUNDS["min_lon"], min(new_lon, ROMANIA_BOUNDS["max_lon"]))

        new_speed = vehicle.speed_kmh
        # Schimbare aleatorie a vitezei
        if random.random() < 0.3: # 30% șansă de a schimba viteza
            speed_change = random.randint(-20, 20)
            new_speed = max(0, min(120, vehicle.speed_kmh + speed_change)) # Limite 0-120 km/h

        vehicle.update_position(new_lat, new_lon, new_speed)
        # print(f"Vehicul {vehicle.id} actualizat: Lat={new_lat:.4f}, Lon={new_lon:.4f}, Viteză={new_speed} km/h")

def get_all_vehicles_data():
    """Returnează datele tuturor vehiculelor active."""
    if not active_vehicles: #Daca nu sunt vehicule initializate, le initializam
        initialize_vehicles()
    return [v.to_dict() for v in active_vehicles]

# Inițializăm vehiculele la importul modulului pentru prima dată
# initialize_vehicles(num_vehicles=10) # Inițializăm cu 10 vehicule default -> se va face la primul apel get_all_vehicles_data

if __name__ == '__main__':
    # Cod de test pentru generator
    print("Inițializare vehicule...")
    initialize_vehicles(3)
    for v_data in get_all_vehicles_data():
        print(v_data)

    print("\nSimulare mișcare pentru 5 pași...")
    for i in range(5):
        simulate_vehicle_movement()
        time.sleep(0.1) # Așteaptă puțin între pași
        print(f"\nPasul {i+1}:")
        for v_data in get_all_vehicles_data():
            print(f"  ID: {v_data['id']}, Lat: {v_data['latitude']:.4f}, Lon: {v_data['longitude']:.4f}, Viteză: {v_data['speed_kmh']}, Combustibil: {v_data['fuel_level_percent']}%")
