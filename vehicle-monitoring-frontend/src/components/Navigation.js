// src/components/Navigation.js
import React from 'react';
import { NavLink } from 'react-router-dom'; // Import NavLink
import './Navigation.css';

const Navigation = () => {
  // Definim stilurile direct aici pentru simplitate sau le putem muta în CSS cu o clasă activă
  const getLinkStyle = ({ isActive }) => {
    return isActive
      ? { ...navLinkBaseStyle, ...activeNavLinkStyle }
      : navLinkBaseStyle;
  };

  return (
    <nav className="main-nav">
      <ul>
        {/* `end` prop pe NavLink pentru Dashboard asigură că nu e activ pentru alte rute care încep cu "/" */}
        <li><NavLink to="/" style={getLinkStyle} end>Dashboard</NavLink></li>
        <li><NavLink to="/istoric-trasee" style={getLinkStyle}>Istoric Trasee</NavLink></li>
        <li><NavLink to="/ore-functionare" style={getLinkStyle}>Ore Funcționare</NavLink></li>
        <li><NavLink to="/consum-combustibil" style={getLinkStyle}>Consum Combustibil</NavLink></li>
        <li><NavLink to="/mentenanta" style={getLinkStyle}>Mentenanță</NavLink></li>
        <li><NavLink to="/date-bord" style={getLinkStyle}>Date Calculator Bord</NavLink></li>
      </ul>
    </nav>
  );
};

// Stiluri de bază pentru NavLink
const navLinkBaseStyle = {
  color: 'white',
  textDecoration: 'none',
  fontSize: '15px', // Puțin mai mic pentru a încăpea mai bine
  padding: '12px 18px', // Padding ajustat
  borderRadius: '5px',
  transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
  display: 'inline-block', // Pentru padding corect
  fontWeight: '500',
};

// Stiluri pentru NavLink când este activ
const activeNavLinkStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.2)', // O culoare de accent subtilă
  // backgroundColor: '#0056b3', // Alternativă: fundal mai închis
  // fontWeight: 'bold', // Deja setat în base, sau poate fi doar aici
};

export default Navigation;
