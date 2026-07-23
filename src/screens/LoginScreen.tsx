import React, { useState } from 'react';
import { api } from '../api/client';
import { sessionLogger } from '../utils/sessionLogger';

export default function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        setLoading(false);
        completeLogin(res.data, 'All', false);
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
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to access your dashboard</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email address or Username</label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email or username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
