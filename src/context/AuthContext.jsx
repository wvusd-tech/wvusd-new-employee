// src/context/AuthContext.jsx
// Authentication Context for WVUSD Onboarding Portal with Dev Persona Switcher,
// Super Admin Role Impersonation, and Live Demo Mode (with sample dataset & email suppression).

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEV_PERSONAS, isValidWvusdEmail } from '../config.js';
import { api, computeUserRoles } from '../services/api.js';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  USER: 'wvusd_onboarding_user',
  PERSONA: 'wvusd_onboarding_persona',
  DEMO_MODE: 'wvusd_onboarding_demo_mode'
};

// Rich sample requests for Demo Mode covering all statuses & roles
const DEMO_SEED_REQUESTS = [
  {
    id: "REQ-1001",
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    requestType: "New Employee",
    site: "Diamond Bar High",
    firstName: "Marcus",
    lastName: "Vance",
    fullName: "Marcus Vance",
    workEmail: "",
    originalTeacherName: "",
    originalTeacherEmail: "",
    accessRequested: ["Outlook Email", "Aeries", "Google Account", "Clever"],
    accessCompleted: [],
    status: "Pending HR",
    submitterEmail: "oa.dbhs@wvusd.org",
    hrAssignedAt: "",
    comments: "[Site Staff]: Science teacher candidate starting next Monday.",
    finalNotifiedAt: ""
  },
  {
    id: "REQ-1002",
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    requestType: "Long-Term Sub",
    site: "Walnut High",
    firstName: "Elena",
    lastName: "Rostova",
    fullName: "Elena Rostova",
    workEmail: "sub.erostova@wvusd.org",
    originalTeacherName: "Katherine Miller",
    originalTeacherEmail: "kmiller@wvusd.org",
    accessRequested: ["Google Account", "Aeries", "Clever"],
    accessCompleted: ["Google Account"],
    status: "In Progress",
    submitterEmail: "oa.whs@wvusd.org",
    hrAssignedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    comments: "[HR Specialist]: Sub email created and dispatched to specialists.",
    finalNotifiedAt: ""
  },
  {
    id: "REQ-1003",
    createdAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    requestType: "New Employee",
    site: "Chaparral Middle",
    firstName: "Brian",
    lastName: "O'Connor",
    fullName: "Brian O'Connor",
    workEmail: "boconnor@wvusd.org",
    originalTeacherName: "",
    originalTeacherEmail: "",
    accessRequested: ["Outlook Email", "Clever", "Aeries"],
    accessCompleted: ["Outlook Email", "Clever", "Aeries"],
    status: "Completed",
    submitterEmail: "oa.chms@wvusd.org",
    hrAssignedAt: new Date(Date.now() - 3600 * 1000 * 40).toISOString(),
    comments: "[Specialist]: All accounts active and verified.",
    finalNotifiedAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString()
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activePersonaId, setActivePersonaId] = useState(DEV_PERSONAS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Active View Tab ('site' | 'hr' | 'specialist' | 'admin')
  const [activeTab, setActiveTab] = useState('site');

  // Demo Mode: When active, all workflows run safely without outbound emails and with demo data
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.DEMO_MODE) === 'true';
    } catch {
      return false;
    }
  });

  // Demo-specific local requests state (so edits in demo mode reflect immediately in UI)
  const [demoRequests, setDemoRequests] = useState(DEMO_SEED_REQUESTS);

  // Super Admin Impersonation / View Toggle
  const [impersonatedRole, setImpersonatedRole] = useState(null); // 'admin' | 'hr' | 'specialist' | 'site'
  const [impersonatedSite, setImpersonatedSite] = useState(null);
  const [impersonatedTopic, setImpersonatedTopic] = useState('ALL');

  const [portalData, setPortalData] = useState({
    requests: [],
    services: [],
    sites: [],
    hrEmails: [],
    superAdminEmails: []
  });

  // Toggle Demo Mode
  const toggleDemoMode = () => {
    setIsDemoMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.DEMO_MODE, String(next));
      } catch (e) {
        console.warn("Could not save demo mode:", e);
      }
      return next;
    });
  };

  // Helper to filter out header words like "Topics", "Topic", etc. from services
  const filterForbiddenHeaders = (servicesList) => {
    const FORBIDDEN = ['topic', 'topics', 'service', 'services', 'system', 'systems', 'topic name', 'service name', 'all topics'];
    return (servicesList || []).filter(s => {
      const name = (typeof s === 'string' ? s : s?.serviceName || '').trim().toLowerCase();
      if (!name) return false;
      if (FORBIDDEN.includes(name)) return false;
      if (name.startsWith('---') || name.startsWith('(')) return false;
      return true;
    });
  };

  // Load initial dataset & restore active session if previously saved
  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      try {
        const savedUserJson = sessionStorage.getItem(STORAGE_KEYS.USER);
        const savedPersonaId = localStorage.getItem(STORAGE_KEYS.PERSONA) || DEV_PERSONAS[0].id;
        setActivePersonaId(savedPersonaId);

        let initialUser = null;
        let emailToQuery = "";

        if (savedUserJson) {
          try {
            initialUser = JSON.parse(savedUserJson);
            if (initialUser && initialUser.email) {
              emailToQuery = initialUser.email;
            }
          } catch (e) {
            console.warn("Error reading stored user:", e);
          }
        }

        // Fetch data from backend
        const data = await api.getInitialData(emailToQuery || "");
        const cleanServices = filterForbiddenHeaders(data.services || []);

        setPortalData({
          requests: data.requests || [],
          services: cleanServices,
          sites: data.sites || [],
          hrEmails: data.hrEmails || [],
          superAdminEmails: data.superAdminEmails || []
        });

        if (data.sites?.length > 0 && !impersonatedSite) {
          setImpersonatedSite(data.sites[0].siteName);
        }

        // If a valid saved user was in sessionStorage, restore their session
        if (initialUser && emailToQuery) {
          const roles = data.currentUser || computeUserRoles(emailToQuery, data);
          const fullUser = {
            ...initialUser,
            ...roles,
            email: emailToQuery
          };
          setUser(fullUser);

          // Set active tab based on role
          if (fullUser.isSuperAdmin) setActiveTab('admin');
          else if (fullUser.isHr) setActiveTab('hr');
          else if (fullUser.isSpecialist) setActiveTab('specialist');
          else setActiveTab('site');
        } else {
          // No saved user -> Leave user null so LoginView is displayed!
          setUser(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setAuthError("Failed to initialize authentication.");
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  // Switch persona during development / testing
  const switchPersona = async (personaId) => {
    const persona = DEV_PERSONAS.find(p => p.id === personaId);
    if (!persona) return;

    setIsLoading(true);
    setImpersonatedRole(null);
    try {
      setActivePersonaId(persona.id);
      localStorage.setItem(STORAGE_KEYS.PERSONA, persona.id);

      const data = await api.getInitialData(persona.email);
      const cleanServices = filterForbiddenHeaders(data.services || []);

      setPortalData({
        requests: data.requests || [],
        services: cleanServices,
        sites: data.sites || [],
        hrEmails: data.hrEmails || [],
        superAdminEmails: data.superAdminEmails || []
      });

      const roles = data.currentUser || computeUserRoles(persona.email, data);

      // Force role flags based on persona type so tester can freely experience that view
      if (persona.id === 'hr_specialist') roles.isHr = true;
      if (persona.id === 'service_specialist') {
        roles.isSpecialist = true;
        if (!roles.assignedServices || roles.assignedServices.length === 0) {
          roles.assignedServices = cleanServices.map(s => s.serviceName || s);
        }
      }
      if (persona.id === 'super_admin') roles.isSuperAdmin = true;
      if (persona.id === 'site_admin' || persona.id === 'site_oa') {
        roles.isSiteStaff = true;
        if (!roles.authorizedSites || roles.authorizedSites.length === 0) {
          roles.authorizedSites = ["Diamond Bar High"];
        }
      }

      const newUser = {
        name: persona.name,
        email: persona.email,
        isDevPersona: true,
        ...roles
      };

      setUser(newUser);
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));

      // Explicitly transition active tab to the persona's designated view!
      if (persona.id === 'hr_specialist') {
        setActiveTab('hr');
      } else if (persona.id === 'service_specialist') {
        setActiveTab('specialist');
      } else if (persona.id === 'super_admin') {
        setActiveTab('admin');
      } else {
        setActiveTab('site');
      }
    } catch (err) {
      console.error("Error switching persona:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Login
  const loginWithEmail = async (email, name = "") => {
    if (!isValidWvusdEmail(email)) {
      setAuthError("Domain unauthorized. Please use your official @wvusd.org staff account.");
      return false;
    }

    setIsLoading(true);
    setAuthError(null);
    setImpersonatedRole(null);
    try {
      const data = await api.getInitialData(email);
      const cleanServices = filterForbiddenHeaders(data.services || []);

      setPortalData({
        requests: data.requests || [],
        services: cleanServices,
        sites: data.sites || [],
        hrEmails: data.hrEmails || [],
        superAdminEmails: data.superAdminEmails || []
      });

      const roles = data.currentUser || computeUserRoles(email, data);
      const newUser = {
        email: email.toLowerCase().trim(),
        name: name || email.split("@")[0],
        isDevPersona: false,
        ...roles
      };

      setUser(newUser);
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));

      // Transition to appropriate view
      if (newUser.isSuperAdmin) setActiveTab('admin');
      else if (newUser.isHr) setActiveTab('hr');
      else if (newUser.isSpecialist) setActiveTab('specialist');
      else setActiveTab('site');

      return true;
    } catch (err) {
      setAuthError("Authentication service error. Please try again.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Launch into Demo Mode from Login Screen
  const launchDemoMode = async () => {
    setIsDemoMode(true);
    try {
      localStorage.setItem(STORAGE_KEYS.DEMO_MODE, 'true');
    } catch {}
    await switchPersona('super_admin');
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    setImpersonatedRole(null);
    setUser(null);
    setActiveTab('site');
  };

  const refreshData = async () => {
    if (!user?.email) return;
    try {
      const data = await api.getInitialData(user.email);
      const cleanServices = filterForbiddenHeaders(data.services || []);
      setPortalData({
        requests: data.requests || [],
        services: cleanServices,
        sites: data.sites || [],
        hrEmails: data.hrEmails || [],
        superAdminEmails: data.superAdminEmails || []
      });
      const roles = data.currentUser || computeUserRoles(user.email, data);
      setUser(prev => ({ ...prev, ...roles }));
    } catch (err) {
      console.warn("Failed to refresh data:", err);
    }
  };

  // Wrapped API actions injecting isDemo & demoMode automatically
  // In Demo Mode, updates demoRequests in-memory so tester sees immediate results!
  const submitRequestWithDemo = async (payload) => {
    if (isDemoMode) {
      const nextNum = demoRequests.reduce((max, r) => {
        const m = String(r.id).match(/REQ-(\d+)/i);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 1000) + 1;

      const newReq = {
        id: `REQ-${nextNum}`,
        createdAt: new Date().toISOString(),
        requestType: payload.requestType || "New Employee",
        site: payload.site,
        firstName: payload.firstName,
        lastName: payload.lastName,
        fullName: `${payload.firstName} ${payload.lastName}`.trim(),
        workEmail: "",
        originalTeacherName: payload.originalTeacherName || "",
        originalTeacherEmail: payload.originalTeacherEmail || "",
        accessRequested: Array.isArray(payload.requestedServices) ? payload.requestedServices : [],
        accessCompleted: [],
        status: "Pending HR",
        submitterEmail: payload.submitterEmail || user?.email || "staff@wvusd.org",
        hrAssignedAt: "",
        comments: "[Demo Mode]: Request submitted into simulated queue.",
        finalNotifiedAt: ""
      };

      setDemoRequests(prev => [newReq, ...prev]);
      return { success: true, request: newReq, message: "Request added in Demo Mode (Emails Suppressed)" };
    }

    return api.submitRequest({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const assignEmailWithDemo = async (payload) => {
    if (isDemoMode) {
      setDemoRequests(prev =>
        prev.map(r => {
          if (r.id === payload.requestId) {
            return {
              ...r,
              workEmail: payload.workEmail,
              status: "In Progress",
              hrAssignedAt: new Date().toISOString(),
              comments: r.comments ? `${r.comments}\n[HR Specialist]: Assigned ${payload.workEmail}` : `[HR Specialist]: Assigned ${payload.workEmail}`
            };
          }
          return r;
        })
      );
      return { success: true, message: "Work email assigned (Demo Mode - Emails Suppressed)" };
    }

    return api.assignEmail({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const toggleAccessWithDemo = async (payload) => {
    if (isDemoMode) {
      let allDone = false;
      setDemoRequests(prev =>
        prev.map(r => {
          if (r.id === payload.requestId) {
            let updatedComp = [...(r.accessCompleted || [])];
            if (payload.completed) {
              if (!updatedComp.includes(payload.serviceName)) updatedComp.push(payload.serviceName);
            } else {
              updatedComp = updatedComp.filter(s => s !== payload.serviceName);
            }

            allDone = r.accessRequested?.length > 0 && r.accessRequested.every(s => updatedComp.includes(s));
            return {
              ...r,
              accessCompleted: updatedComp,
              status: allDone ? "Completed" : "In Progress",
              finalNotifiedAt: allDone ? new Date().toISOString() : r.finalNotifiedAt
            };
          }
          return r;
        })
      );
      return { success: true, allCompleted: allDone };
    }

    return api.toggleAccess({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const addCommentWithDemo = async (payload) => {
    if (isDemoMode) {
      const now = new Date().toISOString().replace("T", " ").substring(0, 16);
      const note = `[${now} ${payload.userEmail || user?.email || "specialist"}]: ${payload.commentText}`;
      setDemoRequests(prev =>
        prev.map(r => {
          if (r.id === payload.requestId) {
            return {
              ...r,
              comments: r.comments ? `${r.comments}\n${note}` : note
            };
          }
          return r;
        })
      );
      return { success: true };
    }

    return api.addComment({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const adminOverrideWithDemo = async (payload) => {
    if (isDemoMode) {
      setDemoRequests(prev =>
        prev.map(r => {
          if (r.id === payload.requestId) {
            return {
              ...r,
              status: payload.status || r.status,
              workEmail: payload.workEmail !== undefined ? payload.workEmail : r.workEmail
            };
          }
          return r;
        })
      );
      return { success: true };
    }

    return api.adminOverride({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  // Determine active requests to display:
  // In Demo Mode: If live sheet has requests, use them, otherwise use demoRequests (or always demoRequests if sheet is empty)
  const activeRequests = isDemoMode
    ? (portalData.requests.length > 0 ? [...portalData.requests, ...demoRequests] : demoRequests)
    : portalData.requests;

  const effectivePortalData = {
    ...portalData,
    requests: activeRequests
  };

  const isSuperAdminUser = Boolean(user?.isSuperAdmin);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authError,
        portalData: effectivePortalData,
        activePersonaId,
        personas: DEV_PERSONAS,
        switchPersona,
        loginWithEmail,
        launchDemoMode,
        logout,
        refreshData,

        // Tab Navigation
        activeTab,
        setActiveTab,

        // Demo Mode
        isDemoMode,
        toggleDemoMode,

        // Super Admin Impersonation
        isSuperAdminUser,
        impersonatedRole,
        setImpersonatedRole,
        impersonatedSite,
        setImpersonatedSite,
        impersonatedTopic,
        setImpersonatedTopic,

        // Wrapped API methods
        submitRequest: submitRequestWithDemo,
        assignEmail: assignEmailWithDemo,
        toggleAccess: toggleAccessWithDemo,
        addComment: addCommentWithDemo,
        adminOverride: adminOverrideWithDemo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
