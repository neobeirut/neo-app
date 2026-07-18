import React, { useState } from 'react';
import { api } from '../api/client';
import { sessionLogger } from '../utils/sessionLogger';

// Helper to calculate distance using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
};

const fetchLocationWithTimeout = (timeoutMs: number): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    const timer = setTimeout(() => {
      reject(new Error('Location request timed out'));
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve(pos);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      { enableHighAccuracy: true, timeout: timeoutMs }
    );
  });
};

export default function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Geolocation & Fallback modal states
  const [gpsChecking, setGpsChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [allowedBranches, setAllowedBranches] = useState<any[]>([]);
  const [tempUser, setTempUser] = useState<any>(null);

  const completeLogin = (userData: any, branchName: string, isLocked: boolean) => {
    const finalUser = {
      ...userData,
      branch: branchName,
      isBranchLocked: isLocked
    };
    sessionLogger.startSession(finalUser);
    onLogin(finalUser);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(email, password);

      if (res.success && res.data) {
        const userRole = (res.data.role || 'User').toLowerCase();
        const userName = (res.data.name || 'User').toLowerCase();

        // 1. Admins and SuperAdmins bypass geolocation check
        if (userRole === 'admin' || userRole === 'superadmin' || userName === 'admin') {
          setLoading(false);
          completeLogin(res.data, res.data.branch || 'All', false);
          return;
        }

        // 2. Fetch all branches to get coordinates
        const branchRes = await api.getBranches();
        let dbBranches: any[] = [];
        if (branchRes.success && branchRes.data) {
          dbBranches = branchRes.data;
        }

        // 3. Filter allowed branches
        const userBranchField = res.data.branch || '';
        const allowedNames = userBranchField.split(',').map((b: string) => b.trim()).filter(Boolean);

        let userAllowedBranches = dbBranches;
        if (userBranchField !== 'All' && userBranchField !== '*') {
          userAllowedBranches = dbBranches.filter(b => allowedNames.includes(b.name));
        }

        if (userAllowedBranches.length === 0) {
          userAllowedBranches = allowedNames.map((name: string) => ({
            name,
            latitude: null,
            longitude: null,
            radius_meters: 200
          }));
        }

        if (userAllowedBranches.length === 0) {
          setLoading(false);
          setError('Your account is not assigned to any branch. Please contact an admin.');
          return;
        }

        // 4. Check Geolocation
        setGpsChecking(true);
        let userLocation: GeolocationPosition | null = null;
        try {
          userLocation = await fetchLocationWithTimeout(5000);
        } catch (err) {
          console.warn('Geolocation check failed or timed out:', err);
        } finally {
          setGpsChecking(false);
        }

        // 5. Match position against branches
        let matchedBranch: any = null;
        if (userLocation) {
          const { latitude, longitude } = userLocation.coords;
          let minDistance = Infinity;

          for (const b of userAllowedBranches) {
            if (b.latitude !== null && b.longitude !== null) {
              const dist = calculateDistance(latitude, longitude, Number(b.latitude), Number(b.longitude));
              const radius = b.radius_meters || 200;
              if (dist <= radius && dist < minDistance) {
                minDistance = dist;
                matchedBranch = b;
              }
            }
          }
        }

        setLoading(false);

        // 6. Complete login
        if (matchedBranch) {
          alert(`📍 Geolocation verified. Auto-locking to branch: ${matchedBranch.name}`);
          completeLogin(res.data, matchedBranch.name, true);
        } else {
          if (userAllowedBranches.length === 1) {
            const singleBranch = userAllowedBranches[0];
            alert(`Location unverified. Logging in manually to branch: ${singleBranch.name}`);
            completeLogin(res.data, singleBranch.name, false);
          } else {
            setTempUser(res.data);
            setAllowedBranches(userAllowedBranches);
            setShowModal(true);
          }
        }
      } else {
        setLoading(false);
        setError(res.error || 'Login failed');
      }
    } catch (err) {
      setLoading(false);
      setError('An error occurred during login. Please try again.');
      console.error(err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <img src="/flow-logo.png" alt="Flow Logo" style={{ height: '48px', objectFit: 'contain' }} />
        </div>
        <p className="auth-subtitle" style={{ marginTop: '0', marginBottom: '16px' }}>Secure Web Portal</p>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-10px', marginBottom: '20px' }}>
          DB Ref: {import.meta.env.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL.split('.')[0].split('//')[1] : 'dybtzulafvtyfuqwsvkk (Default)'}
        </p>
        
        {gpsChecking ? (
          <div style={{ padding: '20px 0' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Verifying your location...</p>
            <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '30px', height: '30px', margin: 'auto', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            {error && <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        )}
      </div>

      {showModal && (
        <div className="web-modal-overlay">
          <div className="web-modal">
            <h2>Select Active Branch</h2>
            <p>We could not verify your location at any branch. Please select where you are working today:</p>
            <div className="web-modal-list">
              {allowedBranches.map((item) => (
                <button
                  key={item.name}
                  className="web-modal-item-btn"
                  onClick={() => completeLogin(tempUser, item.name, false)}
                >
                  🏢 {item.name}
                </button>
              ))}
            </div>
            <button
              className="web-modal-cancel-btn"
              onClick={() => {
                setShowModal(false);
                setTempUser(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
