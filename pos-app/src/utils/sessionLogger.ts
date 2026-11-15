import { supabase } from '../api/supabase';

let heartbeatInterval: any = null;
let activeSessionId: string | null = null;

export const sessionLogger = {
  startSession: async (user: any) => {
    try {
      const sessionId = `POS-SESS-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now()}`;
      activeSessionId = sessionId;
      localStorage.setItem('flow_pos_session_id', sessionId);
      sessionLogger.startHeartbeat();
    } catch (e) {
      console.warn('Session start warn:', e);
    }
  },

  recordActivity: () => {
    // Activity tracking in memory
  },

  endSession: async () => {
    sessionLogger.stopHeartbeat();
    localStorage.removeItem('flow_pos_session_id');
    activeSessionId = null;
  },

  startHeartbeat: () => {
    // Keepalive handled passively via user activity; no background interval needed
  },

  stopHeartbeat: () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
};
