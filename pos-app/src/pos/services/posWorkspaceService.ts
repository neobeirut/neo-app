/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: POS Workspace & Concept Terminal Client (Phase 2)
 *
 * Manages terminal authentication, dynamic concept workspace switching,
 * and active concept state in the POS application.
 */

import { supabase, supabasePublic } from '../../api/supabase';

export interface ConceptWorkspaceInfo {
  id: string;
  code: string;
  name: string;
  tagline?: string;
  description?: string;
  concept_type?: 'RESTAURANT' | 'DELIVERY_PICKUP' | string;
  primary_color: string;
  secondary_color: string;
  receipt_prefix: string;
}

export interface TerminalWorkspaceState {
  terminalId: string;
  terminalName: string;
  branchId: string;
  activeConcept: ConceptWorkspaceInfo;
  allowedConcepts: ConceptWorkspaceInfo[];
  tokenSecret?: string;
  lastSwitchedAt: string;
}

const STORAGE_KEY_TERMINAL = 'flow_pos_terminal_state';
const DEFAULT_TERMINAL_ID = 'FLOW-TERM-01';

export const KNOWN_CONCEPT_PROFILES: Record<string, ConceptWorkspaceInfo> = {
  '00000000-0000-0000-0000-000000000001': {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'NEO',
    name: 'NÉO',
    tagline: 'Restaurant, Café, Bakery & Pastry',
    description: 'NÉO — Restaurant, Café, Bakery and Pastry',
    primary_color: '#1e5c4f',
    secondary_color: '#ffffff',
    receipt_prefix: 'NEO'
  },
  '00000000-0000-0000-0000-000000000002': {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'OVRLOAD',
    name: 'OVRLOAD',
    tagline: 'Loaded Wraps & Delivery',
    description: 'OVRLOAD — Loaded Wraps and Delivery',
    primary_color: '#e11d48',
    secondary_color: '#ffffff',
    receipt_prefix: 'OVR'
  },
  '00000000-0000-0000-0000-000000000003': {
    id: '00000000-0000-0000-0000-000000000003',
    code: 'WICKD',
    name: 'WICKD',
    tagline: 'Cinnamon-Roll Delivery Brand',
    description: 'WICKD — Cinnamon-Roll Delivery Brand',
    primary_color: '#7c3aed',
    secondary_color: '#ffffff',
    receipt_prefix: 'WCK'
  }
};

export const posWorkspaceService = {
  /**
   * Retrieves the current terminal workspace state from URL params, user context, local cache, or initializes defaults.
   */
  getInitialWorkspaceState: (userContext?: any): TerminalWorkspaceState => {
    // 1. Direct URL Query Routing: ?concept=ovrload or #/pos?concept=wickd
    try {
      if (typeof window !== 'undefined') {
        const fullUrl = window.location.href;
        const match = fullUrl.match(/[?&]concept=([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          const reqCode = match[1].toUpperCase();
          const target = Object.values(KNOWN_CONCEPT_PROFILES).find(
            c => c.code === reqCode || c.receipt_prefix === reqCode || c.id === match[1]
          );
          if (target) {
            const state: TerminalWorkspaceState = {
              terminalId: DEFAULT_TERMINAL_ID,
              terminalName: `${target.name} Dedicated Terminal`,
              branchId: '9c214659-9cc7-4f33-b115-cbbb8a823a94',
              activeConcept: target,
              allowedConcepts: Object.values(KNOWN_CONCEPT_PROFILES),
              lastSwitchedAt: new Date().toISOString()
            };
            posWorkspaceService.saveWorkspaceState(state);
            return state;
          }
        }
      }
    } catch {}

    // 2. User / Cashier Profile Concept Binding
    if (userContext) {
      let uConcept = userContext.concept || userContext.concept_id || userContext.assigned_concept;
      if (!uConcept || uConcept === 'ALL') {
        try {
          const stored = JSON.parse(localStorage.getItem('flow_user_concept_settings') || '{}');
          if (userContext.id && stored[userContext.id]) {
            uConcept = stored[userContext.id].concept;
          }
        } catch (e) {}
      }

      const uName = (userContext.name || userContext.username || '').toUpperCase();
      let matchedProfile: ConceptWorkspaceInfo | undefined;

      if (uConcept && uConcept !== 'ALL') {
        matchedProfile = Object.values(KNOWN_CONCEPT_PROFILES).find(
          c => c.id === uConcept || c.code === String(uConcept).toUpperCase() || c.receipt_prefix === String(uConcept).toUpperCase()
        );
      } else if (uName.includes('OVRLOAD') || uName.includes('OVR')) {
        matchedProfile = KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000002'];
      } else if (uName.includes('WICKD') || uName.includes('WCK')) {
        matchedProfile = KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000003'];
      } else if (uName.includes('NEO')) {
        matchedProfile = KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000001'];
      }

      if (matchedProfile) {
        const canSwitch = userContext.can_switch_concepts !== false;
        const state: TerminalWorkspaceState = {
          terminalId: DEFAULT_TERMINAL_ID,
          terminalName: `${matchedProfile.name} Terminal`,
          branchId: '9c214659-9cc7-4f33-b115-cbbb8a823a94',
          activeConcept: matchedProfile,
          allowedConcepts: canSwitch ? Object.values(KNOWN_CONCEPT_PROFILES) : [matchedProfile],
          lastSwitchedAt: new Date().toISOString()
        };
        posWorkspaceService.saveWorkspaceState(state);
        return state;
      }
    }

    // 3. Fallback to cached state
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TERMINAL);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeConcept && parsed.allowedConcepts) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // 4. Default to NÉO Beirut at Badaro Branch
    const defaultState: TerminalWorkspaceState = {
      terminalId: DEFAULT_TERMINAL_ID,
      terminalName: 'Badaro Counter Terminal 01',
      branchId: '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      activeConcept: KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000001'],
      allowedConcepts: Object.values(KNOWN_CONCEPT_PROFILES),
      lastSwitchedAt: new Date().toISOString()
    };
    posWorkspaceService.saveWorkspaceState(defaultState);
    return defaultState;
  },

  /**
   * Persists workspace state to browser local storage.
   */
  saveWorkspaceState: (state: TerminalWorkspaceState): void => {
    try {
      localStorage.setItem(STORAGE_KEY_TERMINAL, JSON.stringify(state));
    } catch {
      // ignore
    }
  },

  /**
   * Switches the active concept workspace.
   * If database RPC is available, executes rpc_switch_terminal_concept_workspace.
   * Otherwise falls back gracefully to local verified concept profiles.
   */
  switchConceptWorkspace: async (
    targetConceptId: string,
    userContext?: { id?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; state?: TerminalWorkspaceState; error?: string }> => {
    const currentState = posWorkspaceService.getInitialWorkspaceState();

    // Verify concept is permitted on this terminal
    const targetProfile = currentState.allowedConcepts.find(c => c.id === targetConceptId);
    if (!targetProfile) {
      return {
        success: false,
        error: `Concept ${targetConceptId} is not permitted on this terminal.`
      };
    }

    try {
      // Call server RPC if available
      const { data, error } = await supabase.rpc('rpc_switch_terminal_concept_workspace', {
        p_terminal_id: currentState.terminalId,
        p_target_concept_id: targetConceptId,
        p_user_id: userContext?.id || 'cashier',
        p_user_name: userContext?.name || 'Cashier',
        p_user_role: userContext?.role || 'staff'
      });

      if (error) {
        console.warn('[posWorkspaceService] RPC switch failed, using verified local state:', error.message);
      }
    } catch (err: any) {
      console.warn('[posWorkspaceService] Exception contacting switch RPC:', err.message);
    }

    const newState: TerminalWorkspaceState = {
      ...currentState,
      activeConcept: targetProfile,
      lastSwitchedAt: new Date().toISOString()
    };

    posWorkspaceService.saveWorkspaceState(newState);
    return { success: true, state: newState };
  }
};
