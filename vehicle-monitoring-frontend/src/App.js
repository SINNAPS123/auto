// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import DashboardPage from './pages/DashboardPage';
import RouteHistoryPage from './pages/RouteHistoryPage';
import OperatingHoursPage from './pages/OperatingHoursPage';
import FuelConsumptionPage from './pages/FuelConsumptionPage';
import OnBoardComputerDataPage from './pages/OnBoardComputerDataPage';
import MaintenancePage from './pages/MaintenancePage';
import './App.css'; // Asigură-te că App.css este importat

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <main className="content-container">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/istoric-trasee" element={<RouteHistoryPage />} />
            <Route path="/ore-functionare" element={<OperatingHoursPage />} />
            <Route path="/consum-combustibil" element={<FuelConsumptionPage />} />
            <Route path="/mentenanta" element={<MaintenancePage />} />
            <Route path="/date-bord" element={<OnBoardComputerDataPage />} />
            {/* Adaugă o rută catch-all pentru pagini negăsite, dacă dorești */}
            {/* <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
