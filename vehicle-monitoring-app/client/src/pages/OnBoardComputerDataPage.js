// src/pages/OnBoardComputerDataPage.js
import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE_URL = "/api"; // Actualizat

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
  const [vehicles, setVehicles] = useState([]); // Stochează toate vehiculele cu datele lor de la /positions
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');
  const [vehicleData, setVehicleData] = useState(null); // Datele vehiculului selectat
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchVehiclesData = async () => {
      if (!isMounted) return;
      setLoading(true);
      // Nu resetăm eroarea aici pentru a nu șterge o eroare de la o selecție anterioară
      // setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/vehicles/positions`);
        if (!isMounted) return;
        if (!response.ok) throw new Error('Nu s-au putut încărca datele vehiculelor de la /positions');
        const data = await response.json();
        if (!isMounted) return;

        setVehicles(data);
        if (data.length > 0 && !selectedVehicleUid) {
          // La prima încărcare, dacă nu e nimic selectat, selectăm primul vehicul
          const firstVehicleId = data[0].vehicle_uid; // API-ul /positions returnează vehicle_uid
          setSelectedVehicleUid(firstVehicleId);
          setVehicleData(data[0]);
        } else if (data.length > 0 && selectedVehicleUid) {
          // Dacă avem deja un UID selectat, actualizăm datele pentru el
          const currentSelectedVehicleData = data.find(v => v.vehicle_uid === selectedVehicleUid);
          setVehicleData(currentSelectedVehicleData || null);
        } else if (data.length === 0) {
          // Dacă API-ul returnează un array gol (de ex. simulator oprit)
          setSelectedVehicleUid('');
          setVehicleData(null);
        }
         setError(null); // Ștergem eroarea doar la succes
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
        // Nu resetăm vehicles aici, poate utilizatorul vrea să selecteze altceva dacă API-ul e temporar picat
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVehiclesData(); // Apel inițial
    const intervalId = setInterval(fetchVehiclesData, 7000); // Actualizare periodică

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []); // Rulăm o singură dată la montare pentru a porni intervalul

  // Acest useEffect actualizează `vehicleData` specific când `selectedVehicleUid` se schimbă
  // sau când lista `vehicles` (de la API) se actualizează.
  useEffect(() => {
    if (selectedVehicleUid && vehicles.length > 0) {
      const currentVehicle = vehicles.find(v => v.vehicle_uid === selectedVehicleUid);
      setVehicleData(currentVehicle || null);
    } else if (!selectedVehicleUid) {
        setVehicleData(null); // Curăță datele dacă niciun vehicul nu e selectat
    }
  }, [selectedVehicleUid, vehicles]);

  return (
    <div>
      <h2>Date Calculator Bord (Live din Simulator)</h2>

      <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}>
        <label htmlFor="obd-vehicle-select">Selectează Vehicul:</label>
        <select
          id="obd-vehicle-select"
          value={selectedVehicleUid}
          onChange={e => setSelectedVehicleUid(e.target.value)}
          disabled={loading && vehicles.length === 0} // Dezactivat doar la încărcarea inițială dacă nu sunt vehicule
        >
          <option value="">-- Alege un vehicul --</option>
          {/* Folosim lista `vehicles` care este actualizată periodic de la /positions */}
          {vehicles.map(v => (
            <option key={v.vehicle_uid} value={v.vehicle_uid}>
              {v.license_plate} ({v.type})
            </option>
          ))}
        </select>
        {loading && <LoadingSpinner size="25px" message="" />}
      </div>

      {/* Nu mai afișăm spinner global aici, ci doar unul mic lângă selector dacă e cazul */}
      {/* {loading && vehicles.length === 0 && <LoadingSpinner message="Se încarcă datele..." />} */}
      {error && <p className="error-message">{error}</p>}

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
          <DataCard title="Ultima Actualizare API" value={vehicleData.last_updated ? new Date(vehicleData.last_updated).toLocaleString() : 'N/A'} />
        </div>
      ) : (
        !loading && selectedVehicleUid && <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555'}}>Datele pentru vehiculul selectat ({selectedVehicleUid}) nu sunt disponibile momentan sau se actualizează.</p>
      )}
      {!loading && !selectedVehicleUid && vehicles.length > 0 && <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555'}}>Vă rugăm să selectați un vehicul.</p>}
      {!loading && vehicles.length === 0 && !error && <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555'}}>Nu sunt vehicule disponibile pentru monitorizare în timp real (simulatorul ar putea fi oprit sau nu are date).</p>}
    </div>
  );
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
  gap: '20px',
};

export default OnBoardComputerDataPage;
