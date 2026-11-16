import React, { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import PosPinScreen from './pos/components/PosPinScreen';
import PosTerminalScreen from './screens/PosTerminalScreen';
import PosWaiterScreen from './screens/PosWaiterScreen';
import PosScreenBuilderScreen from './screens/PosScreenBuilderScreen';
import PosSettingsScreen from './screens/PosSettingsScreen';
import { KdsScreen } from './pos/kds';
import { sessionLogger } from './utils/sessionLogger';
import { supabase } from './api/supabase';
import { normalizePosRole } from './pos/services/posPermissionService';
import { useRestaurantTheme } from './pos/theme/useRestaurantTheme';
import { posWorkspaceService, KNOWN_CONCEPT_PROFILES } from './pos/services/posWorkspaceService';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('POS Error Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0A0D14] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans z-50">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mb-4 border border-rose-500/40">
            ⚠️
          </div>
          <h2 className="text-xl font-black mb-2">POS Interface Error</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              Reload POS
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('pos_current_cashier');
                localStorage.removeItem('flow_pos_user');
                window.location.hash = '#/';
                window.location.reload();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700 cursor-pointer"
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useRestaurantTheme();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
        if (p.includes('/waiter')) {
          window.location.hash = '#/waiter';
        } else if (p.includes('/kds')) {
          window.location.hash = '#/kds';
        } else if (p.includes('/pos')) {
          window.location.hash = '#/pos';
        }
      }
    }
  }, []);

  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('flow_pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flow_pos_locked') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleLock = () => setIsLocked(true);
    const handleUnlock = () => setIsLocked(false);
    window.addEventListener('flow:pos_lock', handleLock);
    window.addEventListener('flow:pos_unlock', handleUnlock);
    return () => {
      window.removeEventListener('flow:pos_lock', handleLock);
      window.removeEventListener('flow:pos_unlock', handleUnlock);
    };
  }, []);

  // Revalidate user concept from shared database settings upon app launch
  useEffect(() => {
    if (!user?.id) return;
    const revalidateUserConcept = async () => {
      try {
        const restId = user.restaurant_id || '79256f11-a9f8-4fec-901d-69baf929762d';
        const { data: restData } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', restId)
          .maybeSingle();
        const userConcepts = restData?.settings?.user_concepts;
        if (userConcepts && userConcepts[user.id]) {
          const remoteConfig = userConcepts[user.id];
          if (remoteConfig.concept && (remoteConfig.concept !== user.concept || remoteConfig.can_switch_concepts !== user.can_switch_concepts)) {
            const updated = {
              ...user,
              concept: remoteConfig.concept,
              can_switch_concepts: remoteConfig.can_switch_concepts
            };
            setUser(updated);
            localStorage.setItem('flow_pos_user', JSON.stringify(updated));
            handleLogin(updated);
          }
        }
      } catch (e) {
        console.warn('Concept revalidation error:', e);
      }
    };
    revalidateUserConcept();
  }, [user?.id]);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('flow_pos_user', JSON.stringify(userData));
    sessionLogger.startSession(userData);

    // Synchronize terminal workspace to user's assigned concept immediately upon login
    if (userData?.concept && userData.concept !== 'ALL') {
      const target = Object.values(KNOWN_CONCEPT_PROFILES).find(
        c => c.id === userData.concept || c.code === String(userData.concept).toUpperCase() || c.receipt_prefix === String(userData.concept).toUpperCase()
      );
      if (target) {
        posWorkspaceService.saveWorkspaceState({
          terminalId: 'FLOW-TERM-01',
          terminalName: `${target.name} Dedicated Terminal`,
          branchId: '9c214659-9cc7-4f33-b115-cbbb8a823a94',
          activeConcept: target,
          allowedConcepts: userData.can_switch_concepts ? Object.values(KNOWN_CONCEPT_PROFILES) : [target],
          lastSwitchedAt: new Date().toISOString()
        });
      }
    }

    const norm = normalizePosRole(userData?.role);
    const isOvrConcept =
      String(userData?.concept || '').toUpperCase().includes('OVR') ||
      userData?.concept === '00000000-0000-0000-0000-000000000002';

    const p = (typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '');
    const isWaiterUrl = p.includes('/waiter');
    const isKdsUrl = p.includes('/kds');

    if (isKdsUrl) {
      window.location.hash = '#/kds';
    } else if (isWaiterUrl || (norm === 'waiter' && !isOvrConcept)) {
      window.location.hash = '#/waiter';
    } else {
      if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/pos' || window.location.hash === '#/waiter') {
        window.location.hash = '#/pos';
      }
    }
  };

  const handleLogout = async () => {
    try {
      await sessionLogger.endSession();
    } catch (e) {
      console.warn('Session end error:', e);
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
    setUser(null);
    setIsLocked(false);
    localStorage.removeItem('flow_pos_user');
    localStorage.removeItem('pos_current_cashier');
    localStorage.removeItem('flow_pos_locked');
  };

  const branchId = user?.branch_id || localStorage.getItem('flow_pos_selected_branch') || '9c214659-9cc7-4f33-b115-cbbb8a823a94';

  return (
    <ErrorBoundary>
      <div className="fixed bottom-2 right-2 z-[9999] px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-[10px] rounded-full pointer-events-none uppercase tracking-wider backdrop-blur-sm select-none shadow-md">
        TEST VERSION
      </div>
      <HashRouter>
        <Routes>
          {!user || isLocked ? (
            <Route
              path="*"
              element={
                <PosPinScreen
                  isLockScreen={Boolean(user && isLocked)}
                  initialRestaurantId={user?.restaurant_id || '79256f11-a9f8-4fec-901d-69baf929762d'}
                  onLogout={handleLogout}
                  onSuccess={(unlockedUser) => {
                    localStorage.removeItem('flow_pos_locked');
                    setIsLocked(false);
                    handleLogin(unlockedUser);
                    window.dispatchEvent(new Event('flow:pos_unlock'));
                  }}
                />
              }
            />
          ) : (
            <>
              <Route
                path="/kds"
                element={
                  <KdsScreen
                    branchId={branchId}
                    onExit={() => {
                      handleLogout();
                    }}
                  />
                }
              />
              <Route path="/waiter" element={<PosWaiterScreen user={user} onExit={handleLogout} />} />
              <Route path="/pos" element={<PosTerminalScreen user={user} onExit={handleLogout} />} />
              <Route path="/orders" element={<PosTerminalScreen user={user} onExit={handleLogout} />} />
              <Route path="/pos-screens" element={<PosScreenBuilderScreen user={user} />} />
              <Route path="/pos-settings" element={<PosSettingsScreen user={user} />} />
              <Route
                path="*"
                element={
                  <Navigate
                    to={
                      (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('/kds'))
                        ? '/kds'
                        : (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('/waiter')) ||
                          (normalizePosRole(user?.role) === 'waiter' &&
                           !String(user?.concept || '').toUpperCase().includes('OVR') &&
                           user?.concept !== '00000000-0000-0000-0000-000000000002')
                        ? '/waiter'
                        : '/pos'
                    }
                    replace
                  />
                }
              />
            </>
          )}
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
