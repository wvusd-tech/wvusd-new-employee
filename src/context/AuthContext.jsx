// src/context/AuthContext.jsx
// Authentication Context for WVUSD Onboarding Portal with Dev Persona Switcher,
// Super Admin Role Impersonation, and Live Demo Mode (Email suppression).

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEV_PERSONAS, isValidWvusdEmail } from '../config.js';
import { api, computeUserRoles } from '../services/api.js';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  USER: 'wvusd_onboarding_user',
  PERSONA: 'wvusd_onboarding_persona',
  DEMO_MODE: 'wvusd_onboarding_demo_mode'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activePersonaId, setActivePersonaId] = useState(DEV_PERSONAS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Demo Mode: When active, all workflows run normally but real emails are suppressed
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.DEMO_MODE) === 'true';
    } catch {
      return false;
    }
  });

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

  // Load initial dataset & restore active session or default dev persona
  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      try {
        // Check saved session
        const savedUserJson = sessionStorage.getItem(STORAGE_KEYS.USER);
        const savedPersonaId = localStorage.getItem(STORAGE_KEYS.PERSONA) || DEV_PERSONAS[0].id;
        setActivePersonaId(savedPersonaId);

        let emailToQuery = "";
        let initialUser = null;

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

        // If no saved user, default to the saved dev persona in development
        if (!emailToQuery) {
          const defaultPersona = DEV_PERSONAS.find(p => p.id === savedPersonaId) || DEV_PERSONAS[0];
          emailToQuery = defaultPersona.email;
          initialUser = {
            email: defaultPersona.email,
            name: defaultPersona.name,
            isDevPersona: true
          };
        }

        const data = await api.getInitialData(emailToQuery);
        setPortalData({
          requests: data.requests || [],
          services: data.services || [],
          sites: data.sites || [],
          hrEmails: data.hrEmails || [],
          superAdminEmails: data.superAdminEmails || []
        });

        // Compute RBAC permissions
        const roles = data.currentUser || computeUserRoles(emailToQuery, data);
        const fullUser = {
          ...initialUser,
          ...roles,
          email: emailToQuery
        };

        setUser(fullUser);
        sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(fullUser));

        if (data.sites?.length > 0 && !impersonatedSite) {
          setImpersonatedSite(data.sites[0].siteName);
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

  // Switch persona during local dev
  const switchPersona = async (personaId) => {
    const persona = DEV_PERSONAS.find(p => p.id === personaId);
    if (!persona) return;

    setIsLoading(true);
    setImpersonatedRole(null); // reset impersonation
    try {
      setActivePersonaId(persona.id);
      localStorage.setItem(STORAGE_KEYS.PERSONA, persona.id);

      const data = await api.getInitialData(persona.email);
      setPortalData({
        requests: data.requests || [],
        services: data.services || [],
        sites: data.sites || [],
        hrEmails: data.hrEmails || [],
        superAdminEmails: data.superAdminEmails || []
      });

      const roles = data.currentUser || computeUserRoles(persona.email, data);
      const newUser = {
        name: persona.name,
        email: persona.email,
        isDevPersona: true,
        ...roles
      };

      setUser(newUser);
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
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
      setPortalData({
        requests: data.requests || [],
        services: data.services || [],
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
      return true;
    } catch (err) {
      setAuthError("Authentication service error. Please try again.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    setImpersonatedRole(null);
    setUser(null);
  };

  const refreshData = async () => {
    if (!user?.email) return;
    try {
      const data = await api.getInitialData(user.email);
      setPortalData({
        requests: data.requests || [],
        services: data.services || [],
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
  const submitRequestWithDemo = (payload) => {
    return api.submitRequest({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const assignEmailWithDemo = (payload) => {
    return api.assignEmail({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const toggleAccessWithDemo = (payload) => {
    return api.toggleAccess({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const addCommentWithDemo = (payload) => {
    return api.addComment({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  const adminOverrideWithDemo = (payload) => {
    return api.adminOverride({
      ...payload,
      isDemo: isDemoMode,
      demoMode: isDemoMode
    }, user?.email);
  };

  // Effective Role (computes active view depending on whether Super Admin is impersonating another role)
  const isSuperAdminUser = Boolean(user?.isSuperAdmin);

  // If user is super admin and chose a specific role to test:
  const effectiveRole = isSuperAdminUser && impersonatedRole ? impersonatedRole : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authError,
        portalData,
        activePersonaId,
        personas: DEV_PERSONAS,
        switchPersona,
        loginWithEmail,
        logout,
        refreshData,

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
        effectiveRole,

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
