// src/pages/OnBoardComputerDataPage.js
import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner'; // Importat

const API_BASE_URL = "http://localhost:5001/api";

// Componenta DataCard acum folosește clase CSS globale definite în App.css
const DataCard = ({ title, value, unit }) => (
  <div className="data-card">
    <h4 className="data-card-title">{title}</h4>
    <p className="data-card-value">
      {value !== undefined && value !== null ? value : 'N/A'}
      {value !== undefined && value !== null && unit ? ` ${unit}` : ''}
    </p>
  </div>
);

const OnBoardComputerDataPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchVehiclesData = async () => {
      if (!isMounted) return;
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/vehicles/positions`);
        if (!isMounted) return;
        if (!response.ok) throw new Error('Nu s-au putut încărca datele vehiculelor');
        const data = await response.json();
        if (!isMounted) return;

        setVehicles(data); // Stochează întreaga listă de vehicule cu datele lor curente
        if (data.length > 0 && !selectedVehicleUid) {
          setSelectedVehicleUid(data[0].id); // API-ul /positions returnează vehicle_uid ca 'id'
          setVehicleData(data[0]); // Setează datele pentru primul vehicul by default
        } else if (data.length > 0 && selectedVehicleUid) {
          const currentSelectedVehicleData = data.find(v => v.id === selectedVehicleUid);
          setVehicleData(currentSelectedVehicleData || null);
        } else if (data.length === 0) {
          setSelectedVehicleUid('');
          setVehicleData(null);
        }
         setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVehiclesData();
    const intervalId = setInterval(fetchVehiclesData, 7000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []); // Scoatem selectedVehicleUid din dependențe, se gestionează intern

  // Acest useEffect este pentru a actualiza vehicleData DOAR când selectedVehicleUid se schimbă MANUAL de către utilizator
  // SAU când lista `vehicles` se actualizează de la API și UID-ul selectat încă există.
  useEffect(() => {
    if (selectedVehicleUid && vehicles.length > 0) {
      const currentVehicle = vehicles.find(v => v.id === selectedVehicleUid);
      setVehicleData(currentVehicle || null);
    } else if (!selectedVehicleUid) {
        setVehicleData(null);
    }
  }, [selectedVehicleUid, vehicles]);

  return (
    <div>
      <h2>Date Calculator Bord</h2>

      <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}>
        <label htmlFor="obd-vehicle-select">Selectează Vehicul:</label>
        <select
          id="obd-vehicle-select"
          value={selectedVehicleUid}
          onChange={e => setSelectedVehicleUid(e.target.value)}
          disabled={loading && vehicles.length === 0}
        >
          <option value="">-- Alege un vehicul --</option>
          {vehicles.map(v => ( // vehicles conține acum toate datele, inclusiv cele de la bord
            <option key={v.id} value={v.id}>
              {v.license_plate} ({v.type})
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingSpinner message="Se încarcă datele..." />}
      {error && <p className="error-message-global">Eroare: {error}</p>}

      {!loading && vehicleData ? (
        <div style={gridStyle}>
          <DataCard title="Turație Motor" value={vehicleData.engine_rpm} unit="RPM" />
          <DataCard title="Temperatură Lichid Răcire" value={vehicleData.coolant_temp_celsius} unit="°C" />
          <DataCard title="Presiune Ulei" value={vehicleData.oil_pressure_bar} unit="bar" />
          <DataCard title="Voltaj Baterie" value={vehicleData.battery_voltage} unit="V" />
          <DataCard title="Viteză Curentă" value={vehicleData.speed_kmh !== null ? vehicleData.speed_kmh.toFixed(1) : 'N/A'} unit="km/h" />
          <DataCard title="Nivel Combustibil" value={vehicleData.fuel_level_percent !== null ? vehicleData.fuel_level_percent.toFixed(1) : 'N/A'} unit="%" />
          <DataCard title="Kilometraj Total" value={vehicleData.current_odometer_km ? vehicleData.current_odometer_km.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 'N/A'} unit="km" />
          <DataCard title="Status Vehicul" value={vehicleData.status} />
          <DataCard title="Ultima Actualizare" value={vehicleData.last_updated ? new Date(vehicleData.last_updated).toLocaleString() : 'N/A'} />
        </div>
      ) : (
        !loading && selectedVehicleUid && <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555'}}>Datele pentru vehiculul selectat ({selectedVehicleUid}) nu sunt disponibile momentan.</p>
      )}
      {!loading && !selectedVehicleUid && vehicles.length > 0 && <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555'}}>Vă rugăm să selectați un vehicul.</p>}
      {!loading && vehicles.length === 0 && !error && <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555'}}>Nu sunt vehicule disponibile pentru monitorizare.</p>}
    </div>
  );
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
  gap: '20px',
};

export default OnBoardComputerDataPage;
