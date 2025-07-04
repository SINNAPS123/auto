// src/pages/FuelConsumptionPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE_URL = "/api"; // Actualizat

const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const FuelConsumptionPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000));

  const [startDate, setStartDate] = useState(formatDateForInput(oneHourAgo));
  const [endDate, setEndDate] = useState(formatDateForInput(now));

  const [fuelData, setFuelData] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingFuelData, setLoadingFuelData] = useState(false);
  const [error, setError] = useState(null);

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

  const handleFetchFuelHistory = useCallback(async () => {
    if (!selectedVehicleUid) {
      setError("Vă rugăm selectați un vehicul.");
      return;
    }
    setLoadingFuelData(true);
    setError(null);
    setFuelData([]);

    try {
      const startUTC = new Date(startDate).toISOString();
      const endUTC = new Date(endDate).toISOString();

      const url = `${API_BASE_URL}/vehicles/${selectedVehicleUid}/fuel_history?start_date=${startUTC}&end_date=${endUTC}&limit=500`;
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Eroare la preluarea istoricului de combustibil." }));
        throw new Error(errData.error || `Eroare HTTP: ${response.status}`);
      }
      const data = await response.json();

      if (data && data.length > 0) {
        const formattedData = data.map(p => ({
            ...p,
            time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }));
        setFuelData(formattedData);
      } else {
        setFuelData([]);
        // Nu seta eroare aici, poate fi un interval valid fără date
        // setError("Niciun istoric de combustibil găsit pentru criteriile selectate.");
      }
    } catch (err) {
      setError(err.message);
      setFuelData([]);
    } finally {
      setLoadingFuelData(false);
    }
  }, [selectedVehicleUid, startDate, endDate]);

  // Fetch initial la schimbarea vehiculului
  useEffect(() => {
    if (selectedVehicleUid && startDate && endDate) { // Adăugat startDate și endDate pentru a asigura că sunt definite
      handleFetchFuelHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleUid]); // Nu adăugăm handleFetchFuelHistory aici pentru a evita bucle infinite dacă el depinde de startDate/endDate


  return (
    <div>
      <h2>Istoric Nivel Combustibil</h2>
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', paddingBottom: '15px', borderBottom: '1px solid #dee2e6' }}>
        <div>
          <label htmlFor="fuel-vehicle-select">Vehicul:</label>
          <select
            id="fuel-vehicle-select"
            value={selectedVehicleUid}
            onChange={e => setSelectedVehicleUid(e.target.value) } // Apelul fetch se face în useEffect
            disabled={loadingVehicles || loadingFuelData}
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
          <label htmlFor="fuel-start-date">De la:</label>
          <input
            type="datetime-local" id="fuel-start-date" value={startDate}
            onChange={e => setStartDate(e.target.value)} disabled={loadingFuelData}
            max={endDate}
          />
        </div>
        <div>
          <label htmlFor="fuel-end-date">Până la:</label>
          <input
            type="datetime-local" id="fuel-end-date" value={endDate}
            onChange={e => setEndDate(e.target.value)} disabled={loadingFuelData}
            min={startDate}
            max={formatDateForInput(new Date())}
          />
        </div>
        <button
            onClick={handleFetchFuelHistory} // Butonul reapelează explicit fetch-ul
            disabled={loadingFuelData || loadingVehicles || !selectedVehicleUid}
            className="info"
        >
          {loadingFuelData ? 'Se încarcă...' : 'Afișează Grafic'}
        </button>
      </div>

      {loadingVehicles && <LoadingSpinner message="Se încarcă lista de vehicule..." />}
      {loadingFuelData && <LoadingSpinner message="Se încarcă istoricul de combustibil..." />}
      {error && <p className="error-message">{error}</p>}

      {!loadingFuelData && fuelData.length > 0 ? (
        <div className="data-card" style={{ marginTop: '20px', height: '450px', padding: "20px" }}>
          <h4 style={{textAlign: 'center', marginBottom: '20px', color: '#333'}}>Evoluție Nivel Combustibil (%) pentru {vehicles.find(v=>v.vehicle_uid === selectedVehicleUid)?.license_plate || selectedVehicleUid}</h4>
          <ResponsiveContainer width="100%" height="calc(100% - 50px)">
            <LineChart
              data={fuelData}
              margin={{ top: 5, right: 20, left: 0, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
              <XAxis
                dataKey="time"
                angle={-30} textAnchor="end" height={60}
                label={{ value: 'Timp', position: 'insideBottom', offset: -20 }}
                tick={{fontSize: 11}}
              />
              <YAxis
                domain={[0, 100]}
                label={{ value: 'Nivel Combustibil (%)', angle: -90, position: 'insideLeft', offset:10, style:{textAnchor: 'middle'} }}
                tickFormatter={(value) => `${value}%`}
                tick={{fontSize: 11}}
              />
              <RechartsTooltip
                formatter={(value, name, props) => [`${value !== null && value !== undefined ? value.toFixed(2) : 'N/A'}%`, `Nivel`]}
                labelFormatter={(label) => {
                    const point = fuelData.find(p => p.time === label);
                    return point ? `Ora: ${new Date(point.timestamp).toLocaleString()}` : `Ora: ${label}`;
                }}
                contentStyle={{backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '5px', border: '1px solid #ccc'}}
                itemStyle={{color: '#8884d8'}}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line
                type="monotone"
                dataKey="fuel_level_percent"
                name="Combustibil"
                stroke="#8884d8"
                strokeWidth={2.5}
                activeDot={{ r: 7, strokeWidth: 2, fill: '#fff', stroke: '#8884d8' }}
                dot={{r:3, strokeWidth:1}}
                connectNulls={false} // Nu conectăm punctele dacă datele de combustibil lipsesc
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        !loadingFuelData && !error && selectedVehicleUid && <p style={{marginTop: '20px', textAlign:'center', color: '#777'}}>Nu există date de combustibil pentru a afișa graficul în intervalul selectat sau selectați criteriile și apăsați "Afișează Grafic".</p>
      )}
      {!loadingFuelData && !error && !selectedVehicleUid && vehicles.length > 0 && <p style={{marginTop: '20px', textAlign:'center', color: '#777'}}>Vă rugăm să selectați un vehicul.</p>}
    </div>
  );
};

export default FuelConsumptionPage;
