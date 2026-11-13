import React, { useState, useEffect, useCallback } from 'react';
import { api, setCachedRestaurantId } from '../../api/client';
import { supabase } from '../../api/supabase';
import { setGlobalRestaurantId } from '../../api/supabase';
import { sessionLogger } from '../../utils/sessionLogger';
import { Delete, ArrowRight, ArrowLeft, Shield, Utensils, AlertCircle, Download } from 'lucide-react';
import FullscreenToggleButton from './FullscreenToggleButton';

interface PosPinScreenProps {
  onSuccess: (user: any) => void;
  onSwitchToPasswordLogin?: () => void;
  initialRestaurantId?: string;
  isLockScreen?: boolean;
  onCancel?: () => void;
  onLogout?: () => void;
}

interface StaffUser {
  id: string;
  name: string;
  display_name: string | null;
  role: string;
  branch: string;
  initials: string;
  color: string;
}

const AVATAR_COLORS = [
  'bg-amber-600', 'bg-emerald-600', 'bg-blue-600', 'bg-purple-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-orange-600', 'bg-indigo-600',
  'bg-teal-600', 'bg-pink-600',
];

function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'ST';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
  return (name.slice(0, 2) || 'ST').toUpperCase();
}

export default function PosPinScreen({
  onSuccess,
  onSwitchToPasswordLogin,
  initialRestaurantId,
  isLockScreen = false,
  onCancel,
  onLogout
}: PosPinScreenProps) {
  const [restaurantId] = useState<string>(() =>
    initialRestaurantId || localStorage.getItem('flow_pos_selected_restaurant') || '79256f11-a9f8-4fec-901d-69baf929762d'
  );
  const [restaurantName, setRestaurantName] = useState('');

  // Step: 'staff' | 'pin'
  const [step, setStep] = useState<'staff' | 'pin'>('staff');
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);

  // PIN entry state
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (restaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783') {
      setRestaurantName('The Bistro');
    } else if (restaurantId === '79256f11-a9f8-4fec-901d-69baf929762d') {
      setRestaurantName('Neo Beirut');
    } else {
      (async () => {
        try {
          const { data } = await supabase
            .from('restaurants')
            .select('name')
            .eq('id', restaurantId)
            .maybeSingle();
          if (data?.name) setRestaurantName(data.name);
          else setRestaurantName('FLOW POS');
        } catch {
          setRestaurantName('FLOW POS');
        }
      })();
    }
  }, [restaurantId]);

  // Fetch active staff with POS access
  useEffect(() => {
    let isMounted = true;
    setStaffLoading(true);

    const loadStaff = async () => {
      try {
        let { data, error: usersErr } = await supabase
          .from('users')
          .select('id, name, display_name, role, branch, permissions, admin_permissions')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('name');

        if (usersErr) {
          console.warn('Error fetching users for restaurant:', usersErr);
        }

        // Fallback: If no active users found with this restaurant_id, load all active users
        if (!data || data.length === 0) {
          const { data: fallbackUsers } = await supabase
            .from('users')
            .select('id, name, display_name, role, branch, permissions, admin_permissions')
            .eq('is_active', true)
            .order('name');
          data = fallbackUsers || [];
        }

        if (!isMounted) return;

        if (!data || data.length === 0) {
          setStaffList([]);
          setStaffLoading(false);
          return;
        }

        // Build the list of user-permission record IDs (format: "user:{name}")
        const permIds = data.map((u: any) => `user:${u.display_name || u.name}`);

        const { data: permsData } = await supabase
          .from('app_permissions')
          .select('id, admin_permissions')
          .in('id', permIds);

        const posAccessMap: Record<string, boolean> = {};
        (permsData || []).forEach((p: any) => {
          posAccessMap[p.id] = !!(p.admin_permissions?.can_access_pos);
        });

        // Filter staff who have can_access_pos = true OR have an authorized role
        let posStaff = data.filter((u: any) => {
          if (u.permissions?.can_access_pos === false || u.admin_permissions?.can_access_pos === false) {
            return false;
          }
          const key = `user:${u.display_name || u.name}`;
          if (posAccessMap[key] === false) return false;
          return true;
        });

        // Fallback: If no staff matched permissions (e.g. newly created branch/restaurant),
        // show all active users so the POS NEVER renders an empty dead screen!
        if (posStaff.length === 0) {
          posStaff = data;
        }

        if (!isMounted) return;

        setStaffList(posStaff.map((u: any, i: number) => ({
          ...u,
          name: u.display_name || u.name || 'Staff',
          initials: getInitials(u.display_name || u.name),
          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        })));
      } catch (err) {
        console.error('Staff loading error:', err);
      } finally {
        if (isMounted) setStaffLoading(false);
      }
    };

    loadStaff();
    return () => {
      isMounted = false;
    };
  }, [restaurantId]);

  const selectUser = (user: StaffUser) => {
    setSelectedUser(user);
    setPin('');
    setError('');
    setStep('pin');
  };

  const goBack = () => {
    setStep('staff');
    setSelectedUser(null);
    setPin('');
    setError('');
  };

  // PIN handlers
  const handleDigit = useCallback((digit: string) => {
    setError('');
    setPin(prev => prev.length >= 8 ? prev : prev + digit);
  }, []);

  const handleBackspace = useCallback(() => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  const handleSubmitPin = useCallback(async (pinToSubmit?: string) => {
    if (!selectedUser) return;
    const code = pinToSubmit || pin;
    if (!code || code.length < 3) {
      setError('Please enter your PIN');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Verify PIN for the specific selected user
      const { data, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', selectedUser.id)
        .eq('is_active', true)
        .or(`pin.eq.${code},pin_code.eq.${code}`)
        .maybeSingle();

      if (dbErr) throw new Error(dbErr.message);

      if (!data) {
        setError('Incorrect PIN. Try again.');
        setPin('');
        setLoading(false);
        return;
      }

      if (data.permissions?.can_access_pos === false || data.admin_permissions?.can_access_pos === false) {
        setError('POS Access is disabled for this account. Contact your manager.');
        setPin('');
        setLoading(false);
        return;
      }

      const resolvedRestId = data.restaurant_id || restaurantId;
      setGlobalRestaurantId(resolvedRestId);
      setCachedRestaurantId(resolvedRestId);
      localStorage.setItem('flow_pos_selected_restaurant', resolvedRestId);

      let userConcept = data.concept;
      let userCanSwitch = data.can_switch_concepts;

      // Hydrate concept and permissions from Supabase restaurants.settings.user_concepts
      try {
        const { data: restData } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', resolvedRestId)
          .maybeSingle();
        const remoteUserConcepts = restData?.settings?.user_concepts;
        if (remoteUserConcepts && remoteUserConcepts[data.id]) {
          userConcept = remoteUserConcepts[data.id].concept || userConcept;
          if (remoteUserConcepts[data.id].can_switch_concepts !== undefined) {
            userCanSwitch = remoteUserConcepts[data.id].can_switch_concepts;
          }
        }
      } catch (e) {
        console.warn('Failed to load user_concepts from restaurant settings:', e);
      }

      try {
        const localSettings = JSON.parse(localStorage.getItem('flow_user_concept_settings') || '{}');
        if (localSettings[data.id]) {
          if (!userConcept) userConcept = localSettings[data.id].concept;
          if (userCanSwitch === undefined) userCanSwitch = localSettings[data.id].can_switch_concepts;
        }
      } catch (e) {}

      // Fallback check on user's name: if name contains OVRLOAD or OVR, bind to OVRLOAD
      const uNameUpper = (data.display_name || data.name || '').toUpperCase();
      if (!userConcept || userConcept === 'ALL') {
        if (uNameUpper.includes('OVRLOAD') || uNameUpper.includes('OVR')) {
          userConcept = '00000000-0000-0000-0000-000000000002';
          userCanSwitch = false;
        } else if (uNameUpper.includes('WICKD') || uNameUpper.includes('WCK')) {
          userConcept = '00000000-0000-0000-0000-000000000003';
          userCanSwitch = false;
        }
      }

      const fullUser = {
        id: data.id,
        name: data.display_name || data.name,
        role: (data.role && data.role !== 'waiter') ? data.role : ((data.name || data.display_name || '').toLowerCase().includes('cashier') ? 'cashier' : (data.role || 'waiter')),
        branch: data.branch || 'Badaro',
        branch_id: data.branch_id || 1,
        restaurant_id: resolvedRestId,
        concept: userConcept || 'ALL',
        can_switch_concepts: userCanSwitch !== undefined ? userCanSwitch : (data.role === 'Admin' || data.role === 'Manager'),
        permissions: data.permissions || { can_access_pos: true },
        admin_permissions: data.admin_permissions || {},
        pos_overrides: data.permissions?.pos_overrides || data.admin_permissions?.pos_overrides || {},
      };

      sessionLogger.startSession(fullUser);
      onSuccess(fullUser);
    } catch (err: any) {
      setError(err?.message || 'Verification error. Try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [pin, selectedUser, restaurantId, onSuccess]);

  // Auto-submit when PIN reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) handleSubmitPin(pin);
  }, [pin, handleSubmitPin]);

  // Keyboard support for PIN step
  useEffect(() => {
    if (step !== 'pin') return;
    const onKey = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Enter') handleSubmitPin();
      else if (e.key === 'Escape') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, loading, handleDigit, handleBackspace, handleSubmitPin]);

  const [installPrompt, setInstallPrompt] = useState<any>(() =>
    typeof window !== 'undefined' ? (window as any).deferredPwaPrompt || null : null
  );

  useEffect(() => {
    const onPwaReady = (e: any) => {
      setInstallPrompt(e?.detail || (window as any).deferredPwaPrompt || null);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('flow:pwa_install_ready', onPwaReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('flow:pwa_install_ready', onPwaReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        (window as any).deferredPwaPrompt = null;
        setInstallPrompt(null);
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-[#F5F6F4] text-slate-900 flex flex-col items-center justify-between p-6 select-none z-50 overflow-hidden font-sans">

      {/* Header */}
      <div className="w-full max-w-5xl flex items-center justify-between pt-2 sm:pt-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pos-primary flex items-center justify-center font-black text-2xl text-white shadow-md">
            {restaurantName.charAt(0) || 'F'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              {restaurantName}
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-[#1e5c4f] font-bold border border-emerald-200">POS</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">{isLockScreen ? 'Terminal Locked • Select Account & Enter PIN' : 'Touch Terminal Sign-In'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FullscreenToggleButton />
          {installPrompt && (
            <button
              type="button"
              onClick={handleInstallPwa}
              className="px-3.5 py-2 rounded-xl bg-[#eb660c] hover:bg-[#d95b08] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Install FLOW POS as an app on this tablet"
            >
              <Download size={14} />
              <span>Install POS App</span>
            </button>
          )}
          {isLockScreen && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-xs cursor-pointer shadow-md"
              title="Return to POS"
            >
              <span>✕</span> Return
            </button>
          )}
        </div>
      </div>

      {/* ── STEP 1: STAFF SELECTION ── */}
      {step === 'staff' && (
        <div className="w-full max-w-5xl flex flex-col items-center my-auto gap-4 sm:gap-6 px-2">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Who's signing in?</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Select your name to enter your PIN</p>
          </div>

          {staffLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-12">
              <span className="w-5 h-5 border-2 border-[#1e5c4f] border-t-transparent rounded-full animate-spin" />
              Loading staff accounts...
            </div>
          ) : staffList.length > 0 ? (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 max-h-[70vh] overflow-y-auto p-1 pr-2">
              {staffList.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectUser(user)}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-white hover:bg-slate-50 active:bg-emerald-50 border border-slate-200 hover:border-[#1e5c4f] hover:shadow-md active:scale-95 transition-all cursor-pointer group min-h-[120px] shadow-xs"
                >
                  <div className={`w-14 h-14 rounded-full ${user.color} flex items-center justify-center font-black text-xl text-white shadow-lg group-hover:scale-105 transition-transform`}>
                    {user.initials}
                  </div>
                  <div className="text-center w-full">
                    <span className="text-sm font-black text-slate-800 group-hover:text-slate-950 block truncate leading-snug">{user.name}</span>
                    <span className="text-[11px] font-bold text-slate-400 capitalize mt-0.5 block">{user.role}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="w-full max-w-md text-center py-8 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <AlertCircle size={32} className="text-[#1e5c4f] mx-auto mb-2" />
              <p className="text-base font-black text-slate-900">No Staff Accounts Found</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">No active staff users found for {restaurantName}.</p>
              {onSwitchToPasswordLogin && (
                <button
                  type="button"
                  onClick={onSwitchToPasswordLogin}
                  className="px-4 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs transition cursor-pointer"
                >
                  Admin Password Login
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: PIN ENTRY ── */}
      {step === 'pin' && selectedUser && (
        <div className="w-full max-w-xs flex flex-col items-center my-auto">
          {/* Back + selected user display */}
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-bold mb-4 self-start transition cursor-pointer"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="text-center mb-5">
            <div className={`w-16 h-16 rounded-full ${selectedUser.color} flex items-center justify-center font-black text-2xl text-white shadow-lg mx-auto mb-3`}>
              {selectedUser.initials}
            </div>
            <h2 className="text-lg font-black text-slate-900">{selectedUser.name}</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Enter your PIN to unlock</p>
          </div>

          {/* PIN dots */}
          <div className="flex items-center justify-center gap-4 mb-5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  pin.length > i
                    ? 'bg-[#1e5c4f] scale-125 shadow-md shadow-emerald-700/30'
                    : 'bg-slate-200 border border-slate-300'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="w-full mb-4 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 justify-center">
              <AlertCircle size={14} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Numpad */}
          <div className="w-full grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9'].map(digit => (
              <button
                key={digit}
                type="button"
                disabled={loading}
                onClick={() => handleDigit(digit)}
                className="h-16 rounded-2xl bg-white hover:bg-slate-50 active:bg-[#1e5c4f] active:text-white border border-slate-200 text-2xl font-black text-slate-900 shadow-xs flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={handleClear}
              className="h-16 rounded-2xl bg-slate-100 hover:bg-rose-50 active:bg-rose-100 border border-slate-200 text-sm font-bold text-slate-600 hover:text-rose-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              CLEAR
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDigit('0')}
              className="h-16 rounded-2xl bg-white hover:bg-slate-50 active:bg-[#1e5c4f] active:text-white border border-slate-200 text-2xl font-black text-slate-900 shadow-xs flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={loading || pin.length === 0}
              onClick={handleBackspace}
              className="h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-30"
            >
              <Delete size={22} />
            </button>
          </div>

          {/* Unlock button */}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={() => handleSubmitPin()}
            className={`w-full mt-4 h-14 rounded-2xl font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-xl active:scale-98 cursor-pointer ${
              loading || pin.length === 0
                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                : 'bg-pos-primary hover:bg-pos-primary-hover text-white shadow-md'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                VERIFYING...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                UNLOCK TERMINAL <ArrowRight size={18} />
              </span>
            )}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="w-full max-w-5xl flex flex-col items-center gap-2.5 pb-2 text-center">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-red-950/40 border border-transparent hover:border-red-900/50 cursor-pointer"
          >
            <span>🚪</span>
            <span>Sign Out Completely</span>
          </button>
        )}
        {onSwitchToPasswordLogin && (
          <button
            type="button"
            onClick={onSwitchToPasswordLogin}
            className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-900/80 border border-transparent hover:border-slate-800 cursor-pointer"
          >
            <Shield size={13} className="text-slate-500" />
            <span>Admin Email &amp; Password Login</span>
          </button>
        )}
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Utensils size={11} />
          <span>FLOW Restaurant Touch POS • Fast Staff Switching</span>
        </div>
      </div>
    </div>
  );
}
