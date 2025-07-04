import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = '40px', message = 'Se încarcă...' }) => {
  return (
    <div className="loading-spinner-container"> {/* Am schimbat numele clasei pentru container */}
      <div className="loading-spinner-indicator" style={{ width: size, height: size }}></div> {/* Și pentru indicator */}
      {message && <p className="loading-spinner-message">{message}</p>} {/* Și pentru mesaj */}
    </div>
  );
};
export default LoadingSpinner;
