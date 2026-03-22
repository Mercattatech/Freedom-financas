import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Privacy Mode override for Intl.NumberFormat
const formatGetter = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, 'format').get;
Object.defineProperty(Intl.NumberFormat.prototype, 'format', {
  get() {
    const boundFormat = formatGetter.call(this);
    const options = this.resolvedOptions();
    return function(value) {
      if (window.isPrivacyModeOn && options.style === 'currency') return 'R$ ••••';
      return boundFormat(value);
    }
  }
});

// Inicializar estado global
window.isPrivacyModeOn = localStorage.getItem('freedom_privacy_mode') === 'true';

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
