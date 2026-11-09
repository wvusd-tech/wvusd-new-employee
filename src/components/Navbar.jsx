// src/components/Navbar.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { DISTRICT_LOGO } from '../config.js';
import {
  LogOut,
  RefreshCw,
  Building2,
  ShieldCheck,
  UserCheck,
  Wrench,
  FileSpreadsheet,
  Layers
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, refreshData, isLoading, isDemoMode, toggleDemoMode } = useAuth();

  const getRoleBadge = () => {
    if (user?.isSuperAdmin) {
      return {
        label: "Super Admin",
        color: "bg-purple-100 text-purple-900 border-purple-300",
        icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
      };
    }
    if (user?.isHr) {
      return {
        label: "HR Specialist",
        color: "bg-amber-100 text-amber-900 border-amber-300",
        icon: <UserCheck className="w-3.5 h-3.5 text-amber-700" />
      };
    }
    if (user?.isSpecialist) {
      return {
        label: "Service Specialist",
        color: "bg-emerald-100 text-emerald-900 border-emerald-300",
        icon: <Wrench className="w-3.5 h-3.5 text-emerald-700" />
      };
    }
    if (user?.isSiteStaff) {
      return {
        label: "Site Staff",
        color: "bg-blue-100 text-blue-900 border-blue-300",
        icon: <Building2 className="w-3.5 h-3.5 text-blue-700" />
      };
    }
    return {
      label: "Staff Member",
      color: "bg-slate-100 text-slate-800 border-slate-300",
      icon: <Building2 className="w-3.5 h-3.5 text-slate-600" />
    };
  };

  const badge = getRoleBadge();

  // Determine which tabs this user is allowed to navigate between
  const canSeeSite = user?.isSuperAdmin || user?.isSiteStaff || isDemoMode;
  const canSeeHr = user?.isSuperAdmin || user?.isHr || isDemoMode;
  const canSeeSpecialist = user?.isSuperAdmin || user?.isSpecialist || isDemoMode;
  const canSeeAdmin = user?.isSuperAdmin || isDemoMode;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: District Logo & Brand */}
          <div className="flex items-center gap-3">
            <img
              src={DISTRICT_LOGO}
              alt="WVUSD Logo"
              className="h-10 w-auto object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-900">
                Walnut Valley Unified
              </span>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                Onboarding & Sub Access Portal
              </h1>
            </div>
          </div>

          {/* Center: Navigation View Tabs (for roles with multi-access, especially Super Admin) */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {canSeeSite && (
              <button
                onClick={() => setActiveTab('site')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'site'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Site Submission & Status
              </button>
            )}

            {canSeeHr && (
              <button
                onClick={() => setActiveTab('hr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'hr'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                HR Queue
              </button>
            )}

            {canSeeSpecialist && (
              <button
                onClick={() => setActiveTab('specialist')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'specialist'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Specialist Tasks
              </button>
            )}

            {canSeeAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Super Admin
              </button>
            )}
          </nav>

          {/* Right: User Role & Actions */}
          <div className="flex items-center gap-3">
            {/* User Details Pill */}
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                {isDemoMode && (
                  <button
                    onClick={toggleDemoMode}
                    title="Demo Mode Active: live emails suppressed. Click to toggle."
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 border border-amber-500 shadow-xs cursor-pointer hover:bg-amber-300 transition"
                  >
                    <span>🛡️ DEMO MODE</span>
                  </button>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.color}`}>
                  {badge.icon}
                  {badge.label}
                </span>
                {user?.authorizedSites?.length > 0 && !user?.isSuperAdmin && (
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {user.authorizedSites.join(", ")}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                {user?.email}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={refreshData}
              disabled={isLoading}
              title="Refresh sheet data"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Tab Bar */}
        <div className="md:hidden flex items-center space-x-1 pb-3 overflow-x-auto">
          {canSeeSite && (
            <button
              onClick={() => setActiveTab('site')}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                activeTab === 'site'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              Site Intake
            </button>
          )}
          {canSeeHr && (
            <button
              onClick={() => setActiveTab('hr')}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                activeTab === 'hr'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              HR Queue
            </button>
          )}
          {canSeeSpecialist && (
            <button
              onClick={() => setActiveTab('specialist')}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                activeTab === 'specialist'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              Specialist
            </button>
          )}
          {canSeeAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              Admin
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
