import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';

import MenuManualScreen from './screens/MenuManualScreen';
import MenuRecipeFormScreen from './screens/MenuRecipeFormScreen';
import EmployeesScreen from './screens/EmployeesScreen';
import EmployeeFormScreen from './screens/EmployeeFormScreen';
import TipsScreen from './screens/TipsScreen';
import TipsCreateScreen from './screens/TipsCreateScreen';
import TipsDistributionScreen from './screens/TipsDistributionScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import SOPsScreen from './screens/SOPsScreen';
import SOPFormScreen from './screens/SOPFormScreen';
import { LayoutDashboard, ChefHat, Users, LogOut, DollarSign, Shield, BookOpen } from 'lucide-react';

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  return (
    <div className="sidebar">
      <div className="sidebar-header">NÉO Admin</div>
      <div className="nav-links" style={{ flex: 1, overflowY: 'auto' }}>
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/menu" className={`nav-link ${location.pathname.startsWith('/menu') ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ChefHat size={20} /> Menu Manual
        </Link>
        <Link to="/employees" className={`nav-link ${location.pathname.startsWith('/employees') ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={20} /> HR & Employees
        </Link>
        <Link to="/tips" className={`nav-link ${location.pathname.startsWith('/tips') ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <DollarSign size={20} /> Tips Config
        </Link>
        <Link to="/sops" className={`nav-link ${location.pathname.startsWith('/sops') ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} /> SOPs & Training
        </Link>
        <Link to="/permissions" className={`nav-link ${location.pathname.startsWith('/permissions') ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={20} /> Security & Matrix
        </Link>
      </div>
      <div className="nav-links">
        <button onClick={onLogout} className="nav-link" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', color: 'var(--danger)' }}>
          <LogOut size={20} /> Logout
        </button>
      </div>
    </div>
  );
}

function MainLayout({ user, onLogout }: { user: any, onLogout: () => void }) {
  return (
    <div className="app-layout">
      <Sidebar onLogout={onLogout} />
      <div className="main-content">
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="var(--text-muted)" />
            <span style={{ fontWeight: 600 }}>{user.name}</span>
            <span style={{ fontSize: '12px', background: '#eef2f5', color: '#007bff', padding: '4px 8px', borderRadius: '12px' }}>{user.role}</span>
          </div>
        </div>
        <div className="content-area">
          <Routes>
            <Route path="/" element={
              <div>
                <h2>Dashboard Overview</h2>
                <p style={{color: 'var(--text-muted)', marginTop: '10px'}}>Welcome to the NÉO Web Admin Portal. Please select a module from the sidebar.</p>
              </div>
            } />
            <Route path="/menu" element={<MenuManualScreen />} />
            <Route path="/menu/new" element={<MenuRecipeFormScreen />} />
            <Route path="/menu/edit/:id" element={<MenuRecipeFormScreen />} />
            <Route path="/employees" element={<EmployeesScreen />} />
            <Route path="/employees/new" element={<EmployeeFormScreen />} />
            <Route path="/employees/edit/:id" element={<EmployeeFormScreen />} />
            <Route path="/tips" element={<TipsScreen />} />
            <Route path="/tips/new" element={<TipsCreateScreen />} />
            <Route path="/tips/distribution/:id" element={<TipsDistributionScreen />} />
            <Route path="/permissions" element={<PermissionsScreen />} />
            <Route path="/sops" element={<SOPsScreen />} />
            <Route path="/sops/new" element={<SOPFormScreen />} />
            <Route path="/sops/edit/:id" element={<SOPFormScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Quick and simple persist
    const saved = localStorage.getItem('neo_admin_user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('neo_admin_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('neo_admin_user');
  };

  if (loading) return null;

  return (
    <BrowserRouter>
      {user ? (
        <MainLayout user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </BrowserRouter>
  );
}

export default App;
