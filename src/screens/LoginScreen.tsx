import React, { useState } from 'react';
import { api } from '../api/client';

export default function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await api.login(pin);
    setLoading(false);

    if (res.success) {
      onLogin(res.data);
    } else {
      setError(res.error || 'Login failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">NÉO Admin</h1>
        <p className="auth-subtitle">Secure Web Portal</p>
        
        <form onSubmit={handleLogin}>
          <input
            type="password"
            className="auth-input"
            placeholder="Enter Admin PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={4}
            autoFocus
          />
          {error && <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
