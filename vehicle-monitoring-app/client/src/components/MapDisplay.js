import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import io from 'socket.io-client';

// Corectarea problemei cu iconițele default din Leaflet în React
delete L.Icon.Default.prototype._getIconUrl;
const defaultIcon = L.icon({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const alertIcon = L.divIcon({
    className: 'vehicle-alert-icon',
    html: `<span class="vehicle-icon-dot-alert"></span><img src="${require('leaflet/dist/images/marker-icon.png')}" />`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});


const createVehicleIcon = (vehicle) => {
  // Exemplu: Dacă un vehicul are o alertă de mentenanță (presupunând că această info vine de la backend)
  // Pentru demonstrație, vom simula o alertă dacă ID-ul vehiculului este par.
  // Într-o implementare reală, `vehicle.hasMaintenanceAlert` ar fi un boolean din backend.
  const hasMaintenanceAlert = parseInt(vehicle.vehicle_uid.slice(-1)) % 2 === 0; // Simulare alertă

  if (hasMaintenanceAlert) {
    return alertIcon;
  }
  return defaultIcon;
};

// URL-ul serverului Socket.IO. În dezvoltare, React rulează pe 3000, serverul pe 5002.
// Proxy-ul din package.json nu funcționează pentru WebSockets.
// Deci, trebuie să specificăm URL-ul complet al serverului backend.
const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_SERVER_URL || 'http://localhost:5002';


const MapDisplay = () => {
  const position = [45.9432, 24.9668];
  const zoomLevel = 7;
  const [vehicles, setVehicles] = useState([]);
  const mapRef = useRef(null);
  const socketRef = useRef(null); // Referință la socket

  useEffect(() => {
    // Inițializează conexiunea Socket.IO la montarea componentei
    socketRef.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'] // Forțează WebSocket pentru a evita probleme cu polling-ul XHR
    });

    console.log(`Încercare de conectare la serverul Socket.IO la ${SOCKET_SERVER_URL}`);

    socketRef.current.on('connect', () => {
      console.log('Conectat la serverul Socket.IO:', socketRef.current.id);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Eroare de conectare la Socket.IO:', err.message, err.description, err.data);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Deconectat de la serverul Socket.IO:', reason);
    });

    // Ascultă evenimentul 'vehiclePositionsUpdate' de la server
    socketRef.current.on('vehiclePositionsUpdate', (updatedVehicles) => {
      // console.log('Primit vehiclePositionsUpdate:', updatedVehicles);
      setVehicles(updatedVehicles);
    });

    // --- Eliminăm fetch-ul inițial și intervalul de polling ---
    // const fetchVehicleData = async () => { ... };
    // fetchVehicleData();
    // const intervalId = setInterval(fetchVehicleData, 5000);

    // Curăță conexiunea la demontarea componentei
    return () => {
      if (socketRef.current) {
        console.log('Deconectare de la Socket.IO la demontarea componentei MapDisplay.');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // clearInterval(intervalId); // Nu mai e necesar
    };
  }, []); // Array gol de dependențe pentru a rula o singură dată la montare

  return (
    <MapContainer
        center={position}
        zoom={zoomLevel}
        style={{ height: '100%', width: '100%' }}
        whenCreated={instance => { mapRef.current = instance; }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {vehicles.map(vehicle => (
        <Marker
          key={vehicle.vehicle_uid}
          position={[vehicle.latitude, vehicle.longitude]}
          icon={createVehicleIcon(vehicle.type)}
        >
          <Popup>
            <b>Vehicul UID:</b> {vehicle.vehicle_uid} <br />
            <b>Nr. Înmatriculare:</b> {vehicle.license_plate} <br />
            <b>Tip:</b> {vehicle.type} <br />
            <b>Viteză:</b> {vehicle.speed_kmh} km/h <br />
            <b>Combustibil:</b> {vehicle.fuel_level_percent !== null ? `${vehicle.fuel_level_percent}%` : 'N/A'} <br />
            <b>Status:</b> {vehicle.status} <br />
            <b>Odometer:</b> {vehicle.current_odometer_km} km <br />
            <b>RPM:</b> {vehicle.engine_rpm !== null ? vehicle.engine_rpm : 'N/A'} |
            <b>Temp. Lichid Răcire:</b> {vehicle.coolant_temp_celsius !== null ? `${vehicle.coolant_temp_celsius}°C` : 'N/A'} <br />
            <b>Pres. Ulei:</b> {vehicle.oil_pressure_bar !== null ? `${vehicle.oil_pressure_bar} bar` : 'N/A'} |
            <b>Voltaj Baterie:</b> {vehicle.battery_voltage !== null ? `${vehicle.battery_voltage}V` : 'N/A'} <br />
            <b>Actualizat:</b> {new Date(vehicle.last_updated).toLocaleString()}
          </Popup>
          <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={false}>
            {vehicle.license_plate} ({vehicle.speed_kmh} km/h)
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapDisplay;
