import React, { useState } from 'react';
import { api } from '../api/client';
import { sessionLogger } from '../utils/sessionLogger';
import { Lock, User, AlertCircle, Eye, EyeOff, ShieldCheck, Layers } from 'lucide-react';

export default function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setError(res.error || 'Login failed. Please check your credentials.');
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
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <Layers size={28} color="#ffffff" />
          </div>
          <div className="auth-brand-name">FLOW</div>
        </div>

        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to access your operations dashboard</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} className="auth-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email address or Username</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                id="email"
                type="text"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email or username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-button auth-btn" disabled={loading}>
            {loading ? (
              <span className="auth-loading">
                <span className="spin-loader"></span> Authenticating...
              </span>
            ) : (
              'Login to Dashboard'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <ShieldCheck size={14} />
          <span>256-bit Encrypted Enterprise Security</span>
        </div>
      </div>
    </div>
  );
}

