import React from 'react';
import { createRoot } from 'react-dom/client';
import MechanicAssessment from './MechanicAssessment.jsx';
import instrument from '../instruments/vintage-mechanic-v1.json';
import './styles.css';

// Demo bootstrap. In production, you'd import MechanicAssessment into your
// own React app and pass it your own instrument + endpoints.
function Demo() {
  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const adminMode = params.get('admin') === '1';
  const submissionsMode = params.get('submissions') === '1';
  const token = params.get('token') || 'dev-admin-token';

  return (
    <div style={{ minHeight: '100vh', padding: '40px 16px', background: '#F5F1EA' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <MechanicAssessment
          instrument={instrument}
          adminMode={adminMode}
          submissionsMode={submissionsMode}
          adminToken={token}
          branding={{ companyName: 'Axacraft Vintage Motorworks' }}
        />
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#8A7E6C' }}>
          Demo views ·{' '}
          <a style={{ color: '#8A7E6C' }} href="?">candidate flow</a> ·{' '}
          <a style={{ color: '#8A7E6C' }} href="?admin=1">instrument preview</a> ·{' '}
          <a style={{ color: '#8A7E6C' }} href="?submissions=1&token=dev-admin-token">submissions admin</a>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
