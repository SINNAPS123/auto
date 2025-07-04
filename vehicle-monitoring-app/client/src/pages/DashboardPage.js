// src/pages/DashboardPage.js
import React from 'react';
import MapDisplay from '../components/MapDisplay';

const DashboardPage = () => {
  return (
    <div>
      <h2>Dashboard & Hartă Vehicule</h2>
      {/* Stilul de mai jos este un exemplu, poate fi ajustat */}
      <div style={{ height: 'calc(100vh - 120px)', width: '100%' }}>
        <MapDisplay />
      </div>
    </div>
  );
};

export default DashboardPage;
