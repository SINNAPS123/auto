// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
// Momentan vom folosi componente placeholder simple
// Importurile originale vor fi restaurate/adaptate ulterior

// Placeholder pentru Navigation
const Navigation = () => (
  <nav style={{ padding: '10px', background: '#eee', marginBottom: '20px' }}>
    <Link to="/" style={{ marginRight: '10px' }}>Dashboard</Link>
    <Link to="/istoric-trasee" style={{ marginRight: '10px' }}>Istoric Trasee</Link>
    <Link to="/ore-functionare" style={{ marginRight: '10px' }}>Ore Funcționare</Link>
    <Link to="/consum-combustibil" style={{ marginRight: '10px' }}>Consum Combustibil</Link>
    <Link to="/mentenanta" style={{ marginRight: '10px' }}>Mentenanță</Link>
    <Link to="/date-bord">Date Bord</Link>
  </nav>
);

// Placeholdere pentru pagini
const DashboardPage = () => <div><h2>Dashboard & Hartă Vehicule (Placeholder)</h2><p>Harta va fi aici.</p></div>;
const RouteHistoryPage = () => <div><h2>Istoric Trasee (Placeholder)</h2></div>;
const OperatingHoursPage = () => <div><h2>Ore Funcționare (Placeholder)</h2></div>;
const FuelConsumptionPage = () => <div><h2>Consum Combustibil (Placeholder)</h2></div>;
const MaintenancePage = () => <div><h2>Mentenanță (Placeholder)</h2></div>;
const OnBoardComputerDataPage = () => <div><h2>Date Calculator Bord (Placeholder)</h2></div>;

// Vom crea un App.css de bază mai târziu
// import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <main className="content-container" style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/istoric-trasee" element={<RouteHistoryPage />} />
            <Route path="/ore-functionare" element={<OperatingHoursPage />} />
            <Route path="/consum-combustibil" element={<FuelConsumptionPage />} />
            <Route path="/mentenanta" element={<MaintenancePage />} />
            <Route path="/date-bord" element={<OnBoardComputerDataPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
