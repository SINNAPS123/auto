// src/pages/MaintenancePage.js
import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner'; // Importat

const API_BASE_URL = "http://localhost:5001/api";

const formatDateToYYYYMMDD = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MaintenancePage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const [maintenanceStatus, setMaintenanceStatus] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState('');

  const initialLogFormData = {
    recommendation_id: '', task_performed: '',
    service_date: formatDateToYYYYMMDD(new Date()),
    serviced_at_km: '', notes: '', parts_cost: '', labor_cost: '', total_cost: ''
  };
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState(initialLogFormData);

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

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoadingRecs(true);
      try {
        const response = await fetch(`${API_BASE_URL}/maintenance/recommendations`);
        if (!response.ok) throw new Error('Nu s-au putut încărca recomandările');
        const data = await response.json();
        setRecommendations(data);
      } catch (err) {
        setError(prevError => prevError ? `${prevError}, ${err.message}` : err.message);
      } finally {
        setLoadingRecs(false);
      }
    };
    fetchRecommendations();
  }, []);

  const fetchMaintenanceStatus = useCallback(async (vehicleUid) => {
    if (!vehicleUid) {
      setMaintenanceStatus([]);
      return;
    }
    setLoadingStatus(true);
    // setError(null); // Nu reseta eroarea globală, poate e de la alt fetch
    try {
      const response = await fetch(`${API_BASE_URL}/vehicles/${vehicleUid}/maintenance_status`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Eroare la preluarea statusului de mentenanță." }));
        throw new Error(errData.error || `Eroare HTTP: ${response.status}`);
      }
      const data = await response.json();
      setMaintenanceStatus(data);
      setError(null); // Resetează eroarea doar la succesul acestui fetch
    } catch (err) {
      setError(err.message);
      setMaintenanceStatus([]);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    const currentVehicle = vehicles.find(v => v.vehicle_uid === selectedVehicleUid);
    setSelectedVehicle(currentVehicle || null);
    if (selectedVehicleUid) {
      fetchMaintenanceStatus(selectedVehicleUid);
    } else {
      setMaintenanceStatus([]);
    }
  }, [selectedVehicleUid, vehicles, fetchMaintenanceStatus]);


  const handleLogFormChange = (e) => {
    const { name, value } = e.target;
    setLogFormData(prev => ({ ...prev, [name]: value }));
    if (name === "recommendation_id" && value) {
        const selectedRec = recommendations.find(r => r.id === parseInt(value));
        if (selectedRec) {
            setLogFormData(prev => ({ ...prev, task_performed: selectedRec.task_name }));
        } else {
            setLogFormData(prev => ({ ...prev, task_performed: '' }));
        }
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicleUid) { setError("Selectați un vehicul întâi."); return; }
    if (!logFormData.task_performed.trim()) { setError("Numele sarcinii efectuate este obligatoriu."); return; }
    if (!logFormData.serviced_at_km || isNaN(parseFloat(logFormData.serviced_at_km)) || parseFloat(logFormData.serviced_at_km) < 0) {
        setError("Kilometrajul la service este obligatoriu și trebuie să fie un număr valid, pozitiv."); return;
    }
    setLoadingSubmit(true); setError(null); setSubmitSuccess('');
    const payload = {
        vehicle_uid: selectedVehicleUid,
        task_performed: logFormData.task_performed,
        service_date: logFormData.service_date,
        serviced_at_km: parseFloat(logFormData.serviced_at_km),
        recommendation_id: logFormData.recommendation_id ? parseInt(logFormData.recommendation_id) : null,
        schedule_id: null,
        notes: logFormData.notes,
        parts_cost: logFormData.parts_cost && !isNaN(parseFloat(logFormData.parts_cost)) ? parseFloat(logFormData.parts_cost) : null,
        labor_cost: logFormData.labor_cost && !isNaN(parseFloat(logFormData.labor_cost)) ? parseFloat(logFormData.labor_cost) : null,
        total_cost: logFormData.total_cost && !isNaN(parseFloat(logFormData.total_cost)) ? parseFloat(logFormData.total_cost) : null,
    };
    if (payload.recommendation_id && maintenanceStatus.length > 0) {
        const schedule = maintenanceStatus.find(s => s.recommendation_id === payload.recommendation_id);
        if (schedule) payload.schedule_id = schedule.id;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/maintenance_logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: "Eroare la salvarea log-ului de mentenanță." }));
            throw new Error(errData.error || `Eroare HTTP: ${response.status}`);
        }
        const newLog = await response.json();
        setSubmitSuccess(`Service logat cu succes! ID Log: ${newLog.id}. Statusul se va actualiza.`);
        setShowLogForm(false);
        setLogFormData(initialLogFormData);
        fetchMaintenanceStatus(selectedVehicleUid);
        const updatedVehicles = vehicles.map(v =>
            v.vehicle_uid === selectedVehicleUid
            ? { ...v, current_odometer_km: Math.max(v.current_odometer_km || 0, payload.serviced_at_km) }
            : v
        );
        setVehicles(updatedVehicles);

    } catch (err) {
        setError(err.message);
    } finally {
        setLoadingSubmit(false);
    }
  };

  const getStatusInfo = (item, currentKm) => {
    const today = new Date(formatDateToYYYYMMDD(new Date()) + 'T00:00:00Z');
    let statusText = 'OK';
    let color = 'green'; // Default la verde
    let details = [];
    currentKm = currentKm || 0; // Asigură că currentKm nu e null/undefined

    if (item.next_due_date) {
        const dueDateObj = new Date(item.next_due_date + 'T00:00:00Z');
        const daysRemaining = Math.round((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) { statusText = 'Depășit (Timp)'; color = 'red'; details.push(`${Math.abs(daysRemaining)} zile depășit`);
        } else if (daysRemaining <= 30) { statusText = 'Scadent Curând (Timp)'; color = 'orange'; details.push(`${daysRemaining} zile rămase`);
        } else { details.push(`${daysRemaining} zile rămase`); }
    }

    if (item.next_due_km) {
        const kmRemaining = item.next_due_km - currentKm;
        if (kmRemaining < 0) {
            statusText = color === 'red' ? 'Depășit (Timp & Km)' : 'Depășit (Km)'; // Combină dacă e cazul
            color = 'red';
            details.push(`${Math.round(Math.abs(kmRemaining)).toLocaleString()} km depășit`);
        } else if (kmRemaining <= (item.default_interval_km * 0.1 || 1000) && color !== 'red') {
            statusText = color === 'orange' ? 'Scadent Curând (Timp & Km)' : 'Scadent Curând (Km)';
            color = 'orange';
            details.push(`${Math.round(kmRemaining).toLocaleString()} km rămași`);
        } else if (color !== 'red' && color !== 'orange') {
            details.push(`${Math.round(kmRemaining).toLocaleString()} km rămași`);
        }
    }

    if (!item.next_due_date && !item.next_due_km) { statusText = 'Nespecificat'; color = '#6c757d'; // Gri pentru nespecificat
    } else if (statusText === 'OK' && (item.next_due_date || item.next_due_km )) {
        if (details.length > 0) statusText = `OK (${details.sort().join(', ')})`; // Sortează detaliile
        else statusText = 'OK'; // Cazul în care doar unul e setat și e OK
    } else if (details.length > 0){
        statusText = `${statusText.split(' (')[0]} (${details.sort().join(', ')})`; // Scoate paranteza veche dacă există
    }
    return { text: statusText, color: color };
  };

  const tableHeaderStyle = {backgroundColor: '#e9ecef', fontWeight: '600', padding: '12px 15px', textAlign: 'left', borderBottom: '2px solid #dee2e6'};

  return (
    <div>
      <h2>Mentenanță Vehicule</h2>

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <label htmlFor="maint-vehicle-select">Vehicul:</label>
        <select
          id="maint-vehicle-select"
          value={selectedVehicleUid}
          onChange={e => setSelectedVehicleUid(e.target.value)}
          disabled={loadingVehicles || loadingStatus || loadingSubmit}
        >
          <option value="">-- Alege un vehicul --</option>
          {vehicles.map(v => (
            <option key={v.vehicle_uid} value={v.vehicle_uid}>
              {v.license_plate} ({v.type} - {v.current_odometer_km ? v.current_odometer_km.toLocaleString(undefined, {maximumFractionDigits: 0}) : '0'} km)
            </option>
          ))}
        </select>
      </div>

      {loadingVehicles && <LoadingSpinner message="Se încarcă lista de vehicule..." />}
      {error && <p className="error-message-global">Eroare: {error}</p>}
      {submitSuccess && <p className="success-message-global">{submitSuccess}</p>}

      {selectedVehicle && !loadingVehicles && (
        <>
          <button
            onClick={() => {setShowLogForm(!showLogForm); setLogFormData(initialLogFormData); setError(null); setSubmitSuccess('');}}
            className={showLogForm ? 'secondary' : 'primary'}
            style={{ marginBottom: '20px', fontSize: '15px' }}
            disabled={loadingStatus || loadingSubmit}
          >
            {showLogForm ? 'Anulează Logare Service' : '+ Loghează Service Nou'}
          </button>

          {showLogForm && (
            <form onSubmit={handleLogSubmit} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
              <h3 style={{marginTop:0}}>Formular Logare Service pentru {selectedVehicle.license_plate}</h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem'}}>
                <div className="form-group">
                  <label htmlFor="recommendation_id">Recomandare Service (Opțional):</label>
                  <select name="recommendation_id" value={logFormData.recommendation_id} onChange={handleLogFormChange} disabled={loadingRecs || loadingSubmit}>
                    <option value="">-- Selectează (sau introdu task manual) --</option>
                    {loadingRecs ? <option>Se încarcă...</option> : recommendations.map(rec => <option key={rec.id} value={rec.id}>{rec.task_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="task_performed">Task Efectuat (*):</label>
                  <input type="text" name="task_performed" value={logFormData.task_performed} onChange={handleLogFormChange} required disabled={loadingSubmit} />
                </div>
                <div className="form-group">
                  <label htmlFor="service_date">Data Service (*):</label>
                  <input type="date" name="service_date" value={logFormData.service_date} onChange={handleLogFormChange} required disabled={loadingSubmit} />
                </div>
                <div className="form-group">
                  <label htmlFor="serviced_at_km">Kilometraj la Service (*):</label>
                  <input type="number" step="0.1" name="serviced_at_km" value={logFormData.serviced_at_km} onChange={handleLogFormChange} required placeholder="ex: 123450.5" disabled={loadingSubmit}/>
                </div>
                 <div className="form-group"><label htmlFor="parts_cost">Cost Piese (€):</label><input type="number" step="0.01" name="parts_cost" value={logFormData.parts_cost} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
                 <div className="form-group"><label htmlFor="labor_cost">Cost Manoperă (€):</label><input type="number" step="0.01" name="labor_cost" value={logFormData.labor_cost} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
                 <div className="form-group"><label htmlFor="total_cost">Cost Total (€):</label><input type="number" step="0.01" name="total_cost" value={logFormData.total_cost} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
              </div>
              <div style={{marginTop: '1rem'}} className="form-group">
                <label htmlFor="notes">Note Suplimentare:</label>
                <textarea name="notes" value={logFormData.notes} onChange={handleLogFormChange} rows="3" disabled={loadingSubmit}></textarea>
              </div>
              <button type="submit" disabled={loadingSubmit} className="success" style={{marginTop: '1rem'}}>
                {loadingSubmit ? <LoadingSpinner size="20px" message="Se salvează..." /> : 'Salvează Log Service'}
              </button>
            </form>
          )}

          <h4 style={{color: '#333'}}>Status Mentenanță pentru {selectedVehicle.license_plate} (Km actuali: {selectedVehicle.current_odometer_km ? selectedVehicle.current_odometer_km.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'})</h4>
          {loadingStatus && <LoadingSpinner message="Se încarcă statusul de mentenanță..." />}
          {!loadingStatus && maintenanceStatus.length === 0 && <p>Niciun program de mentenanță activ găsit sau datele nu sunt încărcate.</p>}
          {!loadingStatus && maintenanceStatus.length > 0 && (
            <div style={{overflowX: 'auto'}}>
            <table> {/* Clasa de tabel din App.css va fi aplicată */}
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Task Mentenanță</th>
                  <th style={tableHeaderStyle}>Ultimul Service (Data)</th>
                  <th style={tableHeaderStyle}>Ultimul Service (Km)</th>
                  <th style={tableHeaderStyle}>Scadent la Data</th>
                  <th style={tableHeaderStyle}>Scadent la Km</th>
                  <th style={tableHeaderStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceStatus.map(item => {
                  const status = getStatusInfo(item, selectedVehicle.current_odometer_km);
                  return (
                    <tr key={item.id} style={{backgroundColor: status.color === 'red' ? '#ffebee' : status.color === 'orange' ? '#fff3e0' : status.color === 'green' ? '#e8f5e9': 'white'}}>
                      <td style={tableCellStyle}>{item.task_name}</td>
                      <td style={tableCellStyle}>{item.last_service_date ? new Date(item.last_service_date+'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
                      <td style={tableCellStyle}>{item.last_service_km ? item.last_service_km.toLocaleString() : 'N/A'}</td>
                      <td style={tableCellStyle}>{item.next_due_date ? new Date(item.next_due_date+'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
                      <td style={tableCellStyle}>{item.next_due_km ? item.next_due_km.toLocaleString() : 'N/A'}</td>
                      <td style={{...tableCellStyle, color: status.color === 'grey' ? '#555' : status.color, fontWeight: 'bold'}}>
                        {status.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
      {!selectedVehicleUid && !loadingVehicles && <p>Vă rugăm să selectați un vehicul pentru a vedea statusul de mentenanță.</p>}
      {/* Stilurile specifice pentru .form-group sunt acum în App.css */}
    </div>
  );
};

const tableCellStyle = { // Păstrăm stilul specific pentru celulele tabelului aici
  padding: '10px 12px',
  textAlign: 'left',
  borderRight: '1px solid #eee',
  fontSize: '0.9em'
};


export default MaintenancePage;
```

Am actualizat `MaintenancePage.js` cu:
*   Stări de încărcare separate și utilizarea `LoadingSpinner`.
*   Utilizarea claselor globale pentru mesaje și butoane.
*   Logică îmbunătățită în `getStatusInfo` pentru a afișa detalii despre zile/km rămași/depășiți și pentru a gestiona mai bine cazurile.
*   Afișarea kilometrajului formatat.
*   Mici ajustări de stil și layout.

Acum, pagina `OnBoardComputerDataPage.js`.
