import uuid
import random
from datetime import datetime

class Vehicle:
    def __init__(self, vehicle_id=None, vehicle_type="Camion", license_plate=None):
        self.id = vehicle_id if vehicle_id else str(uuid.uuid4())
        self.type = vehicle_type
        self.license_plate = license_plate if license_plate else self._generate_license_plate()

        # Date de stare inițiale simulate
        self.latitude = random.uniform(43.5, 48.3) # Limite aproximative pentru România
        self.longitude = random.uniform(20.0, 30.0) # Limite aproximative pentru România
        self.speed_kmh = random.randint(0, 90)
        self.fuel_level_percent = random.uniform(20.0, 100.0)
        self.last_updated = datetime.utcnow()
        self.status = "Idle" if self.speed_kmh == 0 else "Moving"

    def _generate_license_plate(self):
        # Format simplist: 2 litere, 2 cifre, 3 litere (specific României)
        letters1 = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=2))
        numbers = "".join(random.choices("0123456789", k=2))
        letters2 = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=3))
        return f"{letters1}{numbers}{letters2}"

    def update_position(self, new_lat, new_lon, new_speed):
        self.latitude = new_lat
        self.longitude = new_lon
        self.speed_kmh = new_speed
        self.status = "Idle" if self.speed_kmh == 0 else "Moving"
        self.last_updated = datetime.utcnow()
        # Simulăm consumul de combustibil
        if self.speed_kmh > 0:
            self.fuel_level_percent -= random.uniform(0.1, 0.5) # Consum mic per actualizare
            if self.fuel_level_percent < 0:
                self.fuel_level_percent = 0

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "license_plate": self.license_plate,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "speed_kmh": self.speed_kmh,
            "fuel_level_percent": round(self.fuel_level_percent, 2),
            "status": self.status,
            "last_updated": self.last_updated.isoformat() + "Z" # Format ISO 8601
        }

    def __str__(self):
        return f"Vehicul {self.id} ({self.license_plate}) la [{self.latitude}, {self.longitude}]"
