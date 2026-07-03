import { supabase } from '../api/supabase';

let heartbeatInterval: any = null;
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 30000; 
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 mins inactivity
let lastActivityTime = Date.now();
let activeSessionId: string | null = null;

const parseUserAgent = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'Desktop';

  if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
  else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Edg') > -1) browser = 'Edge';

  if (ua.indexOf('Windows') > -1) os = 'Windows';
  else if (ua.indexOf('Macintosh') > -1) os = 'macOS';
  else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
    os = 'iOS';
    deviceType = ua.indexOf('iPad') > -1 ? 'Tablet' : 'Phone';
  } else if (ua.indexOf('Android') > -1) {
    os = 'Android';
    deviceType = 'Phone';
  }

  return { browser, os, deviceType };
};

export const sessionLogger = {
  startSession: async (user: any) => {
    try {
      const sessionId = `SESS-WEB-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now()}`;
      activeSessionId = sessionId;
      localStorage.setItem('neo_web_session_id', sessionId);

      const { browser, os, deviceType } = parseUserAgent();
      
      const payload = {
        UserID: String(user.id),
        UserName: user.name,
        Branch: user.branch || 'All',
        Department: user.departments || 'All',
        Role: user.role,
        Action: 'Login',
        LoginTime: new Date().toISOString(),
        LastActivityAt: new Date().toISOString(),
        DeviceType: deviceType,
        DeviceName: navigator.platform || 'Web Browser',
        Browser: browser,
        OS: os,
        AppVersion: '1.0.0', 
        SessionID: sessionId,
        Status: 'Active'
      };

      lastActivityTime = Date.now();
      lastSyncTime = Date.now();

      await supabase.from('login_logs').insert([payload]);

      sessionLogger.startHeartbeat();
    } catch (e) {
      console.error('Failed to log admin login session:', e);
    }
  },

  recordActivity: () => {
    const sessionId = activeSessionId || localStorage.getItem('neo_web_session_id');
    if (!sessionId) return;

    lastActivityTime = Date.now();
    
    const now = Date.now();
    if (now - lastSyncTime > SYNC_THROTTLE_MS) {
      lastSyncTime = now;
      supabase
        .from('login_logs')
        .update({ LastActivityAt: new Date().toISOString() })
        .eq('SessionID', sessionId)
        .eq('Status', 'Active')
        .then(({ error }) => {
          if (error) console.error('Failed to sync admin activity:', error.message);
        });
    }
  },

  endSession: async () => {
    const sessionId = activeSessionId || localStorage.getItem('neo_web_session_id');
    if (!sessionId) return;

    try {
      sessionLogger.stopHeartbeat();
      localStorage.removeItem('neo_web_session_id');
      activeSessionId = null;

      await supabase
        .from('login_logs')
        .update({
          Action: 'Logout',
          Status: 'Logged Out',
          LogoutTime: new Date().toISOString()
        })
        .eq('SessionID', sessionId);
    } catch (e) {
      console.error('Failed to end admin session:', e);
    }
  },

  startHeartbeat: () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    const handleUserInteraction = () => {
      sessionLogger.recordActivity();
    };

    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('keypress', handleUserInteraction);
    window.addEventListener('scroll', handleUserInteraction);

    heartbeatInterval = setInterval(async () => {
      const sessionId = activeSessionId || localStorage.getItem('neo_web_session_id');
      if (!sessionId) {
        sessionLogger.stopHeartbeat();
        return;
      }

      const now = Date.now();
      if (now - lastActivityTime > INACTIVITY_TIMEOUT_MS) {
        console.log('Admin session inactive. Expiring.');
        sessionLogger.stopHeartbeat();
        
        try {
          await supabase
            .from('login_logs')
            .update({
              Action: 'SessionExpired',
              Status: 'Expired',
              LogoutTime: new Date().toISOString()
            })
            .eq('SessionID', sessionId)
            .eq('Status', 'Active');
        } catch (e) {
          console.error(e);
        }

        localStorage.removeItem('neo_web_session_id');
        activeSessionId = null;
        localStorage.removeItem('neo_admin_user');
        window.location.reload(); 
      }
    }, 15000);
  },

  stopHeartbeat: () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
};
