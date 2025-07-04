// src/pages/RouteHistoryPage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LoadingSpinner from '../components/LoadingSpinner';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const API_BASE_URL = "/api"; // Actualizat pentru proxy

const RouteHistoryPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [startDate, setStartDate] = useState(formatDateForInput(oneDayAgo));
  const [endDate, setEndDate] = useState(formatDateForInput(now));

  const [routePoints, setRoutePoints] = useState([]);
  const [trackData, setTrackData] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null); // Schimbat din mapInstance pentru consistență cu MapDisplay

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoadingVehicles(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/vehicles`);
        if (!response.ok) throw new Error('Nu s-au putut încărca vehiculele');
        const data = await response.json();
        setVehicles(data);
        if (data.length > 0 && !selectedVehicleUid) {
          setSelectedVehicleUid(data[0].vehicle_uid);
        }
      } catch (err) {
        setError(err.message);
        setVehicles([]);
      } finally {
        setLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, []);

  const handleFetchRouteHistory = useCallback(async () => {
    if (!selectedVehicleUid) {
      setError("Vă rugăm selectați un vehicul.");
      return;
    }
    setLoadingHistory(true);
    setError(null);
    setRoutePoints([]);
    setTrackData([]);

    try {
      const startUTC = new Date(startDate).toISOString();
      const endUTC = new Date(endDate).toISOString();
      const url = `${API_BASE_URL}/vehicles/${selectedVehicleUid}/history?start_date=${startUTC}&end_date=${endUTC}&limit=1500`;
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({error: "Eroare necunoscută la preluarea istoricului."}));
        throw new Error(errData.error || `Eroare HTTP: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.length > 0) {
        const points = data.map(p => [p.latitude, p.longitude]);
        setRoutePoints(points);
        setTrackData(data); // Stocăm toate datele punctelor
        if (mapRef.current && points.length > 0) {
            const bounds = L.latLngBounds(points);
            mapRef.current.fitBounds(bounds, {padding: [50,50]});
        }
      } else {
        setRoutePoints([]);
        setTrackData([]);
        // Nu resetăm centrul hărții aici, poate utilizatorul vrea să vadă zona chiar dacă nu sunt puncte
      }
    } catch (err) {
      setError(err.message);
      setRoutePoints([]);
      setTrackData([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedVehicleUid, startDate, endDate]); // mapRef.current nu e necesar ca dependență aici

  const polylineOptions = { color: '#007bff', weight: 5, opacity: 0.7 };
  const startIcon = L.icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/micons/green-dot.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -28] });
  const endIcon = L.icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/micons/red-dot.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -28] });

  // Iconiță mică, transparentă pentru punctele intermediare, pentru a afișa Tooltip
  const intermediateIcon = L.divIcon({
    className: 'intermediate-route-marker',
    html: '<div style="background-color:rgba(0,123,255,0.7); width:8px; height:8px; border-radius:50%; border: 1px solid white;"></div>',
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  });


  return (
    <div>
      <h2>Istoric Trasee Vehicule</h2>
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', paddingBottom: '15px', borderBottom: '1px solid #dee2e6' }}>
        <div>
          <label htmlFor="vehicle-select">Vehicul:</label>
          <select
            id="vehicle-select"
            value={selectedVehicleUid}
            onChange={e => setSelectedVehicleUid(e.target.value)}
            disabled={loadingVehicles || loadingHistory}
          >
            <option value="">-- Alege un vehicul --</option>
            {vehicles.map(v => (
              <option key={v.vehicle_uid} value={v.vehicle_uid}>
                {v.license_plate} ({v.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="start-date">De la:</label>
          <input
            type="datetime-local" id="start-date" value={startDate}
            onChange={e => setStartDate(e.target.value)} disabled={loadingHistory}
          />
        </div>
        <div>
          <label htmlFor="end-date">Până la:</label>
          <input
            type="datetime-local" id="end-date" value={endDate}
            onChange={e => setEndDate(e.target.value)} disabled={loadingHistory}
          />
        </div>
        <button onClick={handleFetchRouteHistory} disabled={loadingHistory || loadingVehicles || !selectedVehicleUid} className="primary">
          {loadingHistory ? 'Se încarcă...' : 'Afișează Istoric'}
        </button>
      </div>

      {loadingVehicles && <LoadingSpinner message="Se încarcă lista de vehicule..." />}
      {loadingHistory && <LoadingSpinner message="Se încarcă istoricul traseului..." />}
      {error && <p className="error-message">{error}</p>}

      {!loadingHistory && !error && routePoints.length === 0 && selectedVehicleUid && !loadingVehicles && (
        <p style={{textAlign: 'center', marginTop: '20px', fontSize: '1.1em', color: '#555'}}>
            Niciun traseu găsit pentru {vehicles.find(v=>v.vehicle_uid === selectedVehicleUid)?.license_plate || selectedVehicleUid} în intervalul selectat.
        </p>
      )}

      <div style={{ height: 'calc(100vh - 320px)', minHeight: '450px', width: '100%', border: '1px solid #ced4da', marginTop: '10px', borderRadius:'5px', overflow:'hidden' }}>
        <MapContainer
            key={selectedVehicleUid + startDate + endDate} // Cheie pentru a forța re-randarea la schimbarea parametrilor
            center={routePoints.length > 0 ? routePoints[Math.floor(routePoints.length / 2)] : [45.9432, 24.9668]} // Centrează pe mijlocul rutei sau default
            zoom={routePoints.length > 0 ? 10 : 7} // Zoom mai apropiat dacă există rută
            style={{ height: '100%', width: '100%' }}
            whenCreated={instance => { mapRef.current = instance; }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {routePoints.length > 0 && (
            <>
              <Polyline pathOptions={polylineOptions} positions={routePoints} />
              <Marker position={routePoints[0]} icon={startIcon}>
                <Popup><b>Start Traseu</b><br/>{new Date(trackData[0].timestamp).toLocaleString()}</Popup>
              </Marker>
              <Marker position={routePoints[routePoints.length - 1]} icon={endIcon}>
                <Popup><b>Sfârșit Traseu</b><br/>{new Date(trackData[trackData.length - 1].timestamp).toLocaleString()}</Popup>
              </Marker>
              {/* Afișează puncte intermediare cu tooltip */}
              {trackData.map((point, idx) => {
                // Afișăm doar un subset de puncte intermediare pentru a nu aglomera harta, ex. din 10 în 10
                if (idx > 0 && idx < trackData.length - 1 && idx % 10 === 0) {
                  return (
                    <Marker key={`track-${point.id || idx}`} position={[point.latitude, point.longitude]} icon={intermediateIcon}>
                        <Tooltip permanent={false} direction="top" offset={[0, -5]}>
                            Viteză: {point.speed_kmh} km/h <br/>
                            {point.fuel_level_percent !== null ? `Combustibil: ${point.fuel_level_percent.toFixed(1)}% <br/>` : ''}
                            RPM: {point.engine_rpm !== null ? point.engine_rpm : 'N/A'} <br/>
                            Timp: {new Date(point.timestamp).toLocaleTimeString()}
                        </Tooltip>
                    </Marker>
                  );
                }
                return null;
              })}
            </>
          )}
        </MapContainer>
      </div>
       {trackData.length > 0 && !loadingHistory && (
        <div className="data-card" style={{marginTop: "20px"}}>
            <h4>Sumar Traseu</h4>
            <p><strong>Vehicul:</strong> {selectedVehicleUid} ({vehicles.find(v=>v.vehicle_uid === selectedVehicleUid)?.license_plate})</p>
            <p><strong>Număr puncte înregistrate:</strong> {trackData.length}</p>
            <p><strong>Perioadă:</strong> {new Date(trackData[0].timestamp).toLocaleString()} - {new Date(trackData[trackData.length - 1].timestamp).toLocaleString()}</p>
            {/* Aici se pot adăuga și alte statistici, ex. distanța totală, viteza medie etc. dacă sunt calculate */}
        </div>
       )}
    </div>
  );
};

export default RouteHistoryPage;
