// src/pages/MaintenancePage.js
import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE_URL = "/api"; // Actualizat

const formatDateToYYYYMMDD = (date) => {
  if (!date) return '';
  const d = new Date(date);
  // Ajustăm pentru timezone local înainte de a extrage YYYY-MM-DD
  // pentru a evita problemele cu data de "ieri" dacă ora e aproape de miezul nopții UTC.
  // d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // Nu mai e necesar dacă API-ul acceptă ISO string complet
  return d.toISOString().split('T')[0];
};

const MaintenancePage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleUid, setSelectedVehicleUid] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null); // Stochează obiectul vehicul selectat

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
    service_date: formatDateToYYYYMMDD(new Date()), // Data curentă formatată
    serviced_at_km: '', notes: '', parts_cost: '', labor_cost: '', total_cost: '',
    service_provider: ''
  };
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState(initialLogFormData);

  // Fetch vehicule
  useEffect(() => {
    const fetchVehiclesList = async () => {
      setLoadingVehicles(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/vehicles`); // API-ul general pentru lista de vehicule
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
    fetchVehiclesList();
  }, []);

  // Fetch recomandări de mentenanță
  useEffect(() => {
    const fetchMaintenanceRecommendations = async () => {
      setLoadingRecs(true);
      try {
        const response = await fetch(`${API_BASE_URL}/maintenance/recommendations`);
        if (!response.ok) throw new Error('Nu s-au putut încărca recomandările de mentenanță');
        const data = await response.json();
        setRecommendations(data);
      } catch (err) {
        setError(prevError => prevError ? `${prevError}, ${err.message}` : err.message);
      } finally {
        setLoadingRecs(false);
      }
    };
    fetchMaintenanceRecommendations();
  }, []);

  // Fetch status mentenanță pentru vehiculul selectat
  const fetchVehicleMaintenanceStatus = useCallback(async (vehicleUid) => {
    if (!vehicleUid) {
      setMaintenanceStatus([]);
      return;
    }
    setLoadingStatus(true);
    // setError(null); // Nu resetăm eroarea globală aici
    try {
      const response = await fetch(`${API_BASE_URL}/maintenance/vehicles/${vehicleUid}/maintenance_status`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Eroare la preluarea statusului de mentenanță." }));
        throw new Error(errData.error || `Eroare HTTP: ${response.status}`);
      }
      const data = await response.json();
      setMaintenanceStatus(data);
      if (error && error.includes("mentenanță")) setError(null); // Șterge eroarea specifică de mentenanță la succes
    } catch (err) {
      setError(err.message);
      setMaintenanceStatus([]);
    } finally {
      setLoadingStatus(false);
    }
  }, [error]); // Adăugat error ca dependență pentru a putea reseta eroarea specifică

  useEffect(() => {
    const currentVehicleData = vehicles.find(v => v.vehicle_uid === selectedVehicleUid);
    setSelectedVehicle(currentVehicleData || null);
    if (selectedVehicleUid) {
      fetchVehicleMaintenanceStatus(selectedVehicleUid);
    } else {
      setMaintenanceStatus([]); // Curăță statusul dacă niciun vehicul nu e selectat
    }
  }, [selectedVehicleUid, vehicles, fetchVehicleMaintenanceStatus]);


  const handleLogFormChange = (e) => {
    const { name, value } = e.target;
    setLogFormData(prev => ({ ...prev, [name]: value }));

    // Autocomplete task_performed dacă se selectează o recomandare
    if (name === "recommendation_id" && value) {
        const selectedRec = recommendations.find(r => r.id === parseInt(value));
        if (selectedRec) {
            setLogFormData(prev => ({ ...prev, task_performed: selectedRec.task_name }));
        } else {
            setLogFormData(prev => ({ ...prev, task_performed: '' })); // Resetează dacă recomandarea nu e găsită
        }
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicleUid) { setError("Selectați un vehicul întâi."); return; }
    if (!logFormData.task_performed.trim()) { setError("Numele sarcinii efectuate este obligatoriu."); return; }

    const servicedKm = parseFloat(logFormData.serviced_at_km);
    if (isNaN(servicedKm) || servicedKm < 0) {
        setError("Kilometrajul la service este obligatoriu și trebuie să fie un număr valid, non-negativ."); return;
    }

    setLoadingSubmit(true); setError(null); setSubmitSuccess('');

    const payload = {
        vehicle_uid: selectedVehicleUid,
        task_performed: logFormData.task_performed,
        service_date: logFormData.service_date, // Format YYYY-MM-DD
        serviced_at_km: servicedKm,
        recommendation_id: logFormData.recommendation_id ? parseInt(logFormData.recommendation_id) : null,
        schedule_id: null, // Serverul va încerca să îl găsească pe baza recommendation_id și vehicle_id
        notes: logFormData.notes,
        parts_cost: logFormData.parts_cost && !isNaN(parseFloat(logFormData.parts_cost)) ? parseFloat(logFormData.parts_cost) : null,
        labor_cost: logFormData.labor_cost && !isNaN(parseFloat(logFormData.labor_cost)) ? parseFloat(logFormData.labor_cost) : null,
        total_cost: logFormData.total_cost && !isNaN(parseFloat(logFormData.total_cost)) ? parseFloat(logFormData.total_cost) : null,
        service_provider: logFormData.service_provider,
    };

    // Încercăm să găsim schedule_id client-side pentru a-l trimite, deși serverul are fallback
    if (payload.recommendation_id && maintenanceStatus.length > 0) {
        const schedule = maintenanceStatus.find(s => s.recommendation_id === payload.recommendation_id);
        if (schedule) payload.schedule_id = schedule.id;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/maintenance/logs`, {
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

        // Re-fetch status și actualizează kilometrajul vehiculului în lista locală
        fetchVehicleMaintenanceStatus(selectedVehicleUid);
        const updatedVehicles = vehicles.map(v =>
            v.vehicle_uid === selectedVehicleUid
            ? { ...v, current_odometer_km: Math.max(v.current_odometer_km || 0, payload.serviced_at_km) }
            : v
        );
        setVehicles(updatedVehicles);
        // Actualizăm și selectedVehicle dacă este cel curent
        if(selectedVehicle && selectedVehicle.vehicle_uid === selectedVehicleUid) {
            setSelectedVehicle(prev => ({...prev, current_odometer_km: Math.max(prev.current_odometer_km || 0, payload.serviced_at_km)}));
        }


    } catch (err) {
        setError(err.message);
    } finally {
        setLoadingSubmit(false);
    }
  };

  const getStatusInfo = (item, currentKm) => {
    const today = new Date(formatDateToYYYYMMDD(new Date()) + 'T00:00:00Z'); // Asigură compararea la nivel de zi
    let statusText = 'OK';
    let color = 'green';
    let details = [];
    currentKm = currentKm || 0;

    if (item.next_due_date) {
        const dueDateObj = new Date(item.next_due_date + 'T00:00:00Z'); // Compară la nivel de zi
        const daysRemaining = Math.round((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) { statusText = 'Depășit (Timp)'; color = 'red'; details.push(`${Math.abs(daysRemaining)} zile depășit`);
        } else if (daysRemaining <= 30) { statusText = 'Scadent Curând (Timp)'; color = 'orange'; details.push(`${daysRemaining} zile rămase`);
        } else { details.push(`${daysRemaining} zile rămase`); }
    }

    if (item.next_due_km) {
        const kmRemaining = item.next_due_km - currentKm;
        if (kmRemaining < 0) {
            statusText = color === 'red' ? 'Depășit (Timp & Km)' : 'Depășit (Km)';
            color = 'red';
            details.push(`${Math.round(Math.abs(kmRemaining)).toLocaleString()} km depășit`);
        } else if (kmRemaining <= (item.default_interval_km * 0.1 || 1000) && color !== 'red') { // 10% din interval sau 1000km
            statusText = color === 'orange' ? 'Scadent Curând (Timp & Km)' : 'Scadent Curând (Km)';
            color = 'orange';
            details.push(`${Math.round(kmRemaining).toLocaleString()} km rămași`);
        } else if (color !== 'red' && color !== 'orange') {
            details.push(`${Math.round(kmRemaining).toLocaleString()} km rămași`);
        }
    }

    if (details.length === 0 && !item.next_due_date && !item.next_due_km) { statusText = 'Nespecificat'; color = '#6c757d';
    } else if (statusText === 'OK' && details.length > 0) {
        statusText = `OK (${details.sort((a,b) => (a.includes("zile") ? -1 : 1)).join(', ')})`; // Prioritizează zilele
    } else if (details.length > 0 && statusText !== 'OK') {
        statusText = `${statusText.split(' (')[0]} (${details.sort((a,b) => (a.includes("zile") ? -1 : 1)).join(', ')})`;
    }
    return { text: statusText, color: color };
  };


  return (
    <div>
      <h2>Mentenanță Vehicule</h2>

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-end', gap: '15px', paddingBottom: '15px', borderBottom: '1px solid #dee2e6' }}>
        <div>
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
                {v.license_plate} ({v.type} - {v.current_odometer_km ? v.current_odometer_km.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'} km)
                </option>
            ))}
            </select>
        </div>
        {loadingVehicles && <LoadingSpinner size="25px" message="" />}
      </div>

      {error && <p className="error-message">{error}</p>}
      {submitSuccess && <p className="success-message">{submitSuccess}</p>}

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
            <form onSubmit={handleLogSubmit} className="data-card" style={{ marginBottom: '30px', backgroundColor: '#fdfdfd' }}>
              <h3 style={{marginTop:0, borderBottom:'1px solid #eee', paddingBottom:'10px'}}>Formular Logare Service pentru {selectedVehicle.license_plate}</h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem 1.5rem'}}>
                <div>
                  <label htmlFor="recommendation_id">Recomandare Service (Opțional):</label>
                  <select name="recommendation_id" value={logFormData.recommendation_id} onChange={handleLogFormChange} disabled={loadingRecs || loadingSubmit}>
                    <option value="">-- Selectează (sau introdu task manual) --</option>
                    {loadingRecs ? <option>Se încarcă...</option> : recommendations.map(rec => <option key={rec.id} value={rec.id}>{rec.task_name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="task_performed">Task Efectuat (*):</label>
                  <input type="text" name="task_performed" value={logFormData.task_performed} onChange={handleLogFormChange} required disabled={loadingSubmit} />
                </div>
                <div>
                  <label htmlFor="service_date">Data Service (*):</label>
                  <input type="date" name="service_date" value={logFormData.service_date} onChange={handleLogFormChange} required disabled={loadingSubmit} max={formatDateToYYYYMMDD(new Date())}/>
                </div>
                <div>
                  <label htmlFor="serviced_at_km">Kilometraj la Service (*):</label>
                  <input type="number" step="0.1" name="serviced_at_km" value={logFormData.serviced_at_km} onChange={handleLogFormChange} required placeholder="ex: 123450.5" disabled={loadingSubmit}/>
                </div>
                 <div><label htmlFor="parts_cost">Cost Piese (€):</label><input type="number" step="0.01" name="parts_cost" value={logFormData.parts_cost} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
                 <div><label htmlFor="labor_cost">Cost Manoperă (€):</label><input type="number" step="0.01" name="labor_cost" value={logFormData.labor_cost} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
                 <div><label htmlFor="total_cost">Cost Total (€):</label><input type="number" step="0.01" name="total_cost" value={logFormData.total_cost} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
                 <div><label htmlFor="service_provider">Furnizor Service:</label><input type="text" name="service_provider" value={logFormData.service_provider} onChange={handleLogFormChange} disabled={loadingSubmit}/></div>
              </div>
              <div style={{marginTop: '1rem'}}>
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
            <table>
              <thead>
                <tr>
                  <th>Task Mentenanță</th>
                  <th>Ultimul Service (Data)</th>
                  <th>Ultimul Service (Km)</th>
                  <th>Scadent la Data</th>
                  <th>Scadent la Km</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceStatus.map(item => {
                  const status = getStatusInfo(item, selectedVehicle.current_odometer_km);
                  return (
                    <tr key={item.id} style={{backgroundColor: status.color === 'red' ? '#ffebee' : status.color === 'orange' ? '#fff3e0' : status.color === 'green' ? '#e8f5e9': 'transparent'}}>
                      <td>{item.task_name}</td>
                      <td>{item.last_service_date ? new Date(item.last_service_date+'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
                      <td>{item.last_service_km ? item.last_service_km.toLocaleString() : 'N/A'}</td>
                      <td>{item.next_due_date ? new Date(item.next_due_date+'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
                      <td>{item.next_due_km ? item.next_due_km.toLocaleString() : 'N/A'}</td>
                      <td style={{color: status.color === '#6c757d' ? '#555' : status.color, fontWeight: 'bold'}}>
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
      {!selectedVehicleUid && !loadingVehicles && <p style={{textAlign:'center', marginTop:'20px'}}>Vă rugăm să selectați un vehicul pentru a vedea statusul de mentenanță.</p>}
    </div>
  );
};

export default MaintenancePage;
