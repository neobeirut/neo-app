import React, { createContext, useContext, useState, useEffect } from 'react';
import { KNOWN_CONCEPTS, type ConceptCode, DEFAULT_CONCEPT_ID } from '../types/concept';

export type ConceptFilter = 'ALL' | ConceptCode;

export interface ConceptProfile {
  id: string;
  code: ConceptFilter;
  name: string;
  prefix: string;
  primaryColor: string;
  tagline: string;
  description: string;
  isCompanyOverview?: boolean;
}

export const COMPANY_OVERVIEW_PROFILE: ConceptProfile = {
  id: 'ALL',
  code: 'ALL',
  name: 'Company Overview',
  prefix: 'ALL',
  primaryColor: '#0f172a', // Slate 900
  tagline: 'Consolidated B.R.I.M.E. S.A.L. Multi-Concept Back Office',
  description: 'Consolidated financials, inventory, and cross-concept performance',
  isCompanyOverview: true
};

export const CONCEPT_PROFILES: Record<ConceptFilter, ConceptProfile> = {
  ALL: COMPANY_OVERVIEW_PROFILE,
  NEO: {
    id: KNOWN_CONCEPTS.NEO.id,
    code: 'NEO',
    name: KNOWN_CONCEPTS.NEO.name,
    prefix: KNOWN_CONCEPTS.NEO.prefix,
    primaryColor: KNOWN_CONCEPTS.NEO.primaryColor,
    tagline: KNOWN_CONCEPTS.NEO.tagline,
    description: KNOWN_CONCEPTS.NEO.description
  },
  OVRLOAD: {
    id: KNOWN_CONCEPTS.OVRLOAD.id,
    code: 'OVRLOAD',
    name: KNOWN_CONCEPTS.OVRLOAD.name,
    prefix: KNOWN_CONCEPTS.OVRLOAD.prefix,
    primaryColor: KNOWN_CONCEPTS.OVRLOAD.primaryColor,
    tagline: KNOWN_CONCEPTS.OVRLOAD.tagline,
    description: KNOWN_CONCEPTS.OVRLOAD.description
  },
  WICKD: {
    id: KNOWN_CONCEPTS.WICKD.id,
    code: 'WICKD',
    name: KNOWN_CONCEPTS.WICKD.name,
    prefix: KNOWN_CONCEPTS.WICKD.prefix,
    primaryColor: KNOWN_CONCEPTS.WICKD.primaryColor,
    tagline: KNOWN_CONCEPTS.WICKD.tagline,
    description: KNOWN_CONCEPTS.WICKD.description
  }
};

interface ConceptContextValue {
  activeConcept: ConceptFilter;
  activeProfile: ConceptProfile;
  conceptId: string | null; // null when 'ALL'
  setActiveConcept: (concept: ConceptFilter) => void;
  canAccessConcept: (concept: ConceptFilter, user: any) => boolean;
  availableConcepts: ConceptProfile[];
}

const ConceptContext = createContext<ConceptContextValue | null>(null);

export function ConceptProvider({ children, user }: { children: React.ReactNode; user: any }) {
  const [activeConcept, setActiveConceptState] = useState<ConceptFilter>(() => {
    const saved = localStorage.getItem('flow_active_concept');
    if (saved && (saved === 'ALL' || saved === 'NEO' || saved === 'OVRLOAD' || saved === 'WICKD')) {
      return saved as ConceptFilter;
    }
    return 'ALL';
  });

  const isSuperAdmin = 
    user?.role?.toLowerCase() === 'superadmin' || 
    user?.is_super_admin === true || 
    user?.role?.toLowerCase() === 'admin' ||
    user?.role?.toLowerCase() === 'owner';

  const canAccessConcept = (concept: ConceptFilter, u: any): boolean => {
    if (!u) return false;
    const isSA = u.role?.toLowerCase() === 'superadmin' || u.is_super_admin === true || u.role?.toLowerCase() === 'admin' || u.role?.toLowerCase() === 'owner';
    
    // Company Overview is restricted to authorized company administrators
    if (concept === 'ALL') {
      return isSA;
    }

    // Admins can access all concepts
    if (isSA) return true;

    // Check user-assigned concepts in metadata / admin permissions
    const assignedConcepts: string[] = u.assigned_concepts || u.admin_permissions?.allowed_concepts || [];
    if (assignedConcepts.length > 0) {
      return assignedConcepts.includes(concept) || assignedConcepts.includes(CONCEPT_PROFILES[concept].id);
    }

    // Concept-specific role check (e.g. "ovrload_manager" or user.concept === "OVRLOAD")
    if (u.concept && u.concept.toUpperCase() === concept) return true;
    if (u.role?.toLowerCase().includes(concept.toLowerCase())) return true;

    // Default concept is NEO for standard NEO staff
    if (concept === 'NEO' && (!u.concept || u.concept === 'NEO')) return true;

    return false;
  };

  // If activeConcept is ALL but user is not authorized, fallback to their assigned concept or NEO
  useEffect(() => {
    if (activeConcept === 'ALL' && !isSuperAdmin) {
      if (canAccessConcept('OVRLOAD', user) && !canAccessConcept('NEO', user)) {
        setActiveConceptState('OVRLOAD');
        localStorage.setItem('flow_active_concept', 'OVRLOAD');
      } else if (canAccessConcept('WICKD', user) && !canAccessConcept('NEO', user)) {
        setActiveConceptState('WICKD');
        localStorage.setItem('flow_active_concept', 'WICKD');
      } else {
        setActiveConceptState('NEO');
        localStorage.setItem('flow_active_concept', 'NEO');
      }
    }
  }, [user, activeConcept, isSuperAdmin]);

  const setActiveConcept = (concept: ConceptFilter) => {
    if (!canAccessConcept(concept, user)) {
      console.warn(`User ${user?.name} is not authorized to switch to concept ${concept}`);
      return;
    }
    setActiveConceptState(concept);
    localStorage.setItem('flow_active_concept', concept);
  };

  const activeProfile = CONCEPT_PROFILES[activeConcept] || COMPANY_OVERVIEW_PROFILE;
  const conceptId = activeConcept === 'ALL' ? null : activeProfile.id;

  const availableConcepts = Object.values(CONCEPT_PROFILES).filter(p => canAccessConcept(p.code, user));

  return (
    <ConceptContext.Provider
      value={{
        activeConcept,
        activeProfile,
        conceptId,
        setActiveConcept,
        canAccessConcept,
        availableConcepts
      }}
    >
      {children}
    </ConceptContext.Provider>
  );
}

export function useActiveConcept() {
  const ctx = useContext(ConceptContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      activeConcept: 'ALL' as ConceptFilter,
      activeProfile: COMPANY_OVERVIEW_PROFILE,
      conceptId: null,
      setActiveConcept: () => {},
      canAccessConcept: () => true,
      availableConcepts: [COMPANY_OVERVIEW_PROFILE, CONCEPT_PROFILES.NEO, CONCEPT_PROFILES.OVRLOAD, CONCEPT_PROFILES.WICKD]
    };
  }
  return ctx;
}
