import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corectarea problemei cu iconițele default din Leaflet în React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// O funcție pentru a crea iconițe personalizate (opțional, dar util pentru vizualizare)
const createVehicleIcon = (vehicleType) => {
  // Aici am putea avea logică pentru diferite iconițe bazate pe tipul vehiculului
  // Momentan, folosim iconița default, dar putem adăuga culori sau forme diferite.
  // Exemplu: return L.icon({ iconUrl: 'path/to/icon.png', ... });

  // Pentru a diferenția puțin, putem crea o iconiță simplă cu o culoare de fundal
  // Acest exemplu necesită un pic mai mult setup pentru iconițe dinamice (ex. SVG sau divIcon)
  // Momentan, vom returna iconița default.
  return L.Icon.Default();
};

const MapDisplay = () => {
  const position = [45.9432, 24.9668]; // Centrul României
  const zoomLevel = 7;
  const [vehicles, setVehicles] = useState([]);
  const API_URL = "http://localhost:5001/api/vehicles/positions"; // URL-ul backend-ului Flask

  const mapRef = useRef(null); // Referință la instanța hărții

  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setVehicles(data);
      } catch (error) {
        console.error("Failed to fetch vehicle data:", error);
        // Poate afișa un mesaj de eroare utilizatorului
        // Într-o aplicație reală, am seta o stare de eroare aici.
      }
    };

    fetchVehicleData(); // Apel inițial

    const intervalId = setInterval(fetchVehicleData, 5000); // Actualizează la fiecare 5 secunde

    return () => clearInterval(intervalId); // Curăță intervalul la demontarea componentei
  }, []); // Array gol de dependențe pentru a rula o singură dată la montare + curățare

  return (
    <MapContainer
        center={position}
        zoom={zoomLevel}
        style={{ height: '100%', width: '100%' }}
        whenCreated={instance => { mapRef.current = instance; }} // Salvează instanța hărții
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {vehicles.map(vehicle => (
        <Marker
          key={vehicle.id}
          position={[vehicle.latitude, vehicle.longitude]}
          icon={createVehicleIcon(vehicle.type)} // Folosim o funcție pentru iconiță
        >
          <Popup>
            <b>ID Vehicul:</b> {vehicle.id} <br />
            <b>Tip:</b> {vehicle.type} <br />
            <b>Nr. Înmatriculare:</b> {vehicle.license_plate} <br />
            <b>Viteză:</b> {vehicle.speed_kmh} km/h <br />
            <b>Combustibil:</b> {vehicle.fuel_level_percent}% <br />
            <b>Status:</b> {vehicle.status} <br />
            <b>Actualizat:</b> {new Date(vehicle.last_updated).toLocaleString()}
          </Popup>
          <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={false}>
            {vehicle.id} ({vehicle.license_plate}) - {vehicle.speed_kmh} km/h
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapDisplay;
