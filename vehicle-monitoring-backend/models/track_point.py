from datetime import datetime

class TrackPoint:
    def __init__(self, vehicle_id, latitude, longitude, timestamp=None, speed_kmh=0):
        self.vehicle_id = vehicle_id
        self.latitude = latitude
        self.longitude = longitude
        self.timestamp = timestamp if timestamp else datetime.utcnow()
        self.speed_kmh = speed_kmh

    def to_dict(self):
        return {
            "vehicle_id": self.vehicle_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": self.timestamp.isoformat() + "Z",
            "speed_kmh": self.speed_kmh
        }
