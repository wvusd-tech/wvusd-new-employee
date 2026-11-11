// src/components/DevToolbar.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Users,
  ChevronDown,
  Check,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Shield,
  Eye,
  Building,
  Wrench,
  UserCheck
} from 'lucide-react';
import { resetMockData } from '../services/api.js';

export default function DevToolbar() {
  const {
    user,
    activePersonaId,
    personas,
    switchPersona,
    refreshData,
    portalData,
    isDemoMode,
    toggleDemoMode,
    isSuperAdminUser,
    impersonatedRole,
    setImpersonatedRole,
    impersonatedSite,
    setImpersonatedSite,
    impersonatedTopic,
    setImpersonatedTopic,
    activeTab,
    setActiveTab
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const activePersona = personas.find(p => p.id === activePersonaId) || personas[0];

  const handleResetData = () => {
    if (confirm("Reset local mock data back to factory defaults?")) {
      setIsResetting(true);
      resetMockData();
      refreshData().then(() => {
        setIsResetting(false);
      });
    }
  };

  // Switch role view for Super Admin or in Demo Mode
  const handleSuperAdminRoleSwitch = (roleKey) => {
    setImpersonatedRole(roleKey);
    setActiveTab(roleKey);
  };

  // Show toolbar ONLY if user is Super Admin (Specialist!D1) or in Demo Mode
  // Regular staff (HR, Specialists, Site Staff) NEVER see this toolbar or other staff test personas
  if (!isSuperAdminUser && !isDemoMode && !user?.isSuperAdmin) {
    return null;
  }

  // Show view switcher if user is Super Admin, or in Demo Mode, or in Dev persona
  const canAccessAdminControls = isSuperAdminUser || isDemoMode || user?.isSuperAdmin || activePersonaId === 'super_admin';

  return (
    <div className="bg-slate-950 border-b border-slate-800 text-slate-200 text-xs px-4 py-2 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Left Section: Demo Mode Button & Status Indicator */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* THE DEMO BUTTON */}
          <button
            onClick={toggleDemoMode}
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isDemoMode
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300/50"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            }`}
            title="Click to toggle Demo Mode: safely view and test all parts of the system with demo data & live emails suppressed"
          >
            {isDemoMode ? (
              <>
                <ShieldAlert className="w-4 h-4 text-slate-950 animate-pulse" />
                <span>DEMO MODE: ON</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>DEMO BUTTON (OFF)</span>
              </>
            )}
          </button>

          {/* Indicator text */}
          {isDemoMode ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/60">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
              Demo Data Loaded • Live Emails Suppressed
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Live Emails: <strong className="text-emerald-400 font-semibold">Active</strong>
            </span>
          )}
        </div>

        {/* Center / Right Section: Super Admin Role View Toggle & Quick Personas */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Super Admin / Demo View Switcher */}
          {canAccessAdminControls && (
            <div className="flex flex-wrap items-center gap-1.5 bg-purple-950/70 p-1 rounded-xl border border-purple-800/80">
              <span className="text-[10px] font-bold text-purple-300 uppercase px-2 tracking-wider flex items-center gap-1">
                <Eye className="w-3 h-3 text-purple-400" />
                Switch View:
              </span>

              {/* View as Super Admin */}
              <button
                type="button"
                onClick={() => handleSuperAdminRoleSwitch('admin')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeTab === 'admin'
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-purple-300 hover:bg-purple-900/60"
                }`}
              >
                👑 Master Admin
              </button>

              {/* View as HR Specialist */}
              <button
                type="button"
                onClick={() => handleSuperAdminRoleSwitch('hr')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeTab === 'hr'
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-purple-300 hover:bg-purple-900/60"
                }`}
              >
                📋 HR Queue
              </button>

              {/* View as Specialist */}
              <button
                type="button"
                onClick={() => handleSuperAdminRoleSwitch('specialist')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeTab === 'specialist'
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-purple-300 hover:bg-purple-900/60"
                }`}
              >
                🔧 Specialist
              </button>

              {/* View as Site Staff */}
              <button
                type="button"
                onClick={() => handleSuperAdminRoleSwitch('site')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeTab === 'site'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-purple-300 hover:bg-purple-900/60"
                }`}
              >
                🏫 Site Intake
              </button>

              {/* If viewing as Site Staff, allow selecting which site! */}
              {activeTab === 'site' && portalData.sites?.length > 0 && (
                <select
                  value={impersonatedSite || portalData.sites[0]?.siteName}
                  onChange={(e) => setImpersonatedSite(e.target.value)}
                  className="bg-slate-900 text-white text-[11px] font-semibold px-2 py-0.5 rounded border border-purple-700 focus:outline-none"
                  title="Test view for specific school site"
                >
                  {portalData.sites.map(s => (
                    <option key={s.siteName} value={s.siteName}>{s.siteName}</option>
                  ))}
                </select>
              )}

              {/* If viewing as Specialist, allow selecting which topic! */}
              {activeTab === 'specialist' && portalData.services?.length > 0 && (
                <select
                  value={impersonatedTopic}
                  onChange={(e) => setImpersonatedTopic(e.target.value)}
                  className="bg-slate-900 text-white text-[11px] font-semibold px-2 py-0.5 rounded border border-purple-700 focus:outline-none"
                  title="Filter by specific specialist system topic"
                >
                  <option value="ALL">All Topics</option>
                  {portalData.services.map(s => (
                    <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Quick Dev Personas */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 tracking-wider">
              Test Persona:
            </span>
            {personas.map(p => {
              const isSelected = p.id === activePersonaId;
              const subName = portalData.hrSpecialists?.sub?.name || 'Yesenia';
              const classifiedName = portalData.hrSpecialists?.classified?.name || 'Martha';
              const certificatedName = portalData.hrSpecialists?.certificated?.name || 'Lorraine';

              const shortLabel =
                p.id === 'site_admin' ? 'Principal'
                : p.id === 'site_oa' ? 'Secretary'
                : p.id === 'hr_sub' ? `${subName} (Sub HR)`
                : p.id === 'hr_classified' ? `${classifiedName} (Classified HR)`
                : p.id === 'hr_certificated' ? `${certificatedName} (Certificated HR)`
                : p.id === 'spec_acagnones' ? 'Alex C. (Email/Lists)'
                : p.id === 'spec_sunnygarcia' ? 'Sunny G. (Aeries)'
                : p.id === 'spec_msakai' ? 'Melissa S. (Aeries)'
                : p.id === 'spec_rrivas' ? 'Robert R. (Clever/Illum)'
                : p.id === 'spec_mlewin' ? 'Melody L. (CAASPP)'
                : p.id === 'super_admin' ? 'Admin'
                : p.name.split(' ')[0];

              const tooltipTitle =
                p.id === 'hr_sub' ? `Switch test persona to: ${subName} (Sub HR Coordinator - ${p.email})`
                : p.id === 'hr_classified' ? `Switch test persona to: ${classifiedName} (Classified HR Coordinator - ${p.email})`
                : p.id === 'hr_certificated' ? `Switch test persona to: ${certificatedName} (Certificated HR Coordinator - ${p.email})`
                : `Switch test persona to: ${p.name} (${p.roleName})`;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchPersona(p.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                  title={tooltipTitle}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>

          {/* Reset Mock */}
          <button
            type="button"
            onClick={handleResetData}
            disabled={isResetting}
            title="Reset sample records in local storage"
            className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 transition text-[11px] cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? "animate-spin text-amber-400" : ""}`} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
