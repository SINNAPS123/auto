// src/pages/OperatingHoursPage.js
import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner'; // Import

const API_BASE_URL = "http://localhost:5001/api";

// Helper pentru a formata data ca YYYY-MM-DD pentru input type="date" și API
const formatDateToYYYYMMDD = (date) => {
  return date.toISOString().split('T')[0];
};

const OperatingHoursPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');

  const [periodType, setPeriodType] = useState('day');
  const [referenceDate, setReferenceDate] = useState(formatDateToYYYYMMDD(new Date()));

  const [operatingSummary, setOperatingSummary] = useState(null);
  const [loadingVehicles, setLoadingVehicles] = useState(false); // Pentru încărcare vehicule
  const [loadingSummary, setLoadingSummary] = useState(false); // Pentru încărcare sumar
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

  const handleFetchOperatingSummary = useCallback(async () => {
    if (!selectedVehicleUid) {
      setError("Vă rugăm selectați un vehicul.");
      return;
    }
    if (!referenceDate) {
        setError("Vă rugăm selectați o dată de referință.");
        return;
    }

    setLoadingSummary(true);
    setError(null);
    setOperatingSummary(null);

    try {
      const url = `${API_BASE_URL}/vehicles/${selectedVehicleUid}/operating_summary?period=${periodType}&date=${referenceDate}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Eroare la preluarea sumarului orelor de funcționare." }));
        throw new Error(errData.error || `Eroare HTTP: ${response.status}`);
      }
      const data = await response.json();
      setOperatingSummary(data);
    } catch (err) {
      setError(err.message);
      setOperatingSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedVehicleUid, periodType, referenceDate]);

  return (
    <div> {/* Stil controlat de .content-container */}
      <h2>Ore de Funcționare Vehicule</h2>
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', paddingBottom: '15px', borderBottom: '1px solid #dee2e6' }}>
        <div>
          <label htmlFor="op-vehicle-select">Vehicul:</label>
          <select
            id="op-vehicle-select"
            value={selectedVehicleUid}
            onChange={e => setSelectedVehicleUid(e.target.value)}
            disabled={loadingVehicles || loadingSummary}
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
            <label htmlFor="op-period-type">Perioadă:</label>
            <select
                id="op-period-type"
                value={periodType}
                onChange={e => setPeriodType(e.target.value)}
                disabled={loadingSummary}
            >
                <option value="day">Zi</option>
                <option value="week">Săptămână</option>
                <option value="month">Lună</option>
            </select>
        </div>

        <div>
          <label htmlFor="op-ref-date">Dată Referință:</label>
          <input
            type="date"
            id="op-ref-date"
            value={referenceDate}
            onChange={e => setReferenceDate(e.target.value)}
            disabled={loadingSummary}
          />
        </div>

        <button
            onClick={handleFetchOperatingSummary}
            disabled={loadingSummary || loadingVehicles || !selectedVehicleUid || !referenceDate}
            className="success" // Folosim clasa de stil
        >
          {loadingSummary ? 'Se calculează...' : 'Calculează Ore Funcționare'}
        </button>
      </div>

      {loadingVehicles && <LoadingSpinner message="Se încarcă lista de vehicule..." />}
      {loadingSummary && <LoadingSpinner message="Se calculează orele de funcționare..." />}
      {error && <p className="error-message-global">Eroare: {error}</p>}

      {operatingSummary && !loadingSummary && ( // Afișăm doar dacă nu se încarcă
        <div className="data-card" style={{marginTop: "20px", backgroundColor: "#e9f7fd"}}> {/* Folosim clasa .data-card */}
          <h3 style={{marginTop: 0}}>Rezultat pentru {vehicles.find(v=>v.vehicle_uid === selectedVehicleUid)?.license_plate || selectedVehicleUid}</h3>
          <p><strong>Perioada selectată:</strong> {operatingSummary.period_type === 'day' ? 'Zi' : operatingSummary.period_type === 'week' ? 'Săptămână' : 'Lună'}</p>
          <p><strong>Dată de referință (pentru perioada):</strong> {new Date(operatingSummary.reference_date_for_period + 'T00:00:00Z').toLocaleDateString()}</p>
          <p><strong>Interval calculat (UTC):</strong> {new Date(operatingSummary.calculated_period_start_utc).toLocaleString()} - {new Date(operatingSummary.calculated_period_end_utc).toLocaleString()}</p>
          <p><strong>Detalii:</strong> {operatingSummary.details}</p>
          <p style={{fontSize: '1.2em', fontWeight: 'bold'}}>
            Total Ore Funcționare: <span style={{color: '#007bff'}}>{operatingSummary.total_operating_hours} ore</span>
            &nbsp;({operatingSummary.total_operating_seconds} secunde)
          </p>
        </div>
      )}
    </div>
  );
};

export default OperatingHoursPage;
