// src/App.jsx
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import DevToolbar from './components/DevToolbar.jsx';
import Navbar from './components/Navbar.jsx';
import LoginView from './components/LoginView.jsx';
import SiteSubmissionView from './components/SiteSubmissionView.jsx';
import HrView from './components/HrView.jsx';
import SpecialistView from './components/SpecialistView.jsx';
import AdminView from './components/AdminView.jsx';
import { ShieldAlert } from 'lucide-react';

function MainApp() {
  const { user, isLoading, activeTab, setActiveTab, isDemoMode, logout } = useAuth();

  // If user is not signed in, show the WVUSD Login Screen
  if (!user && !isLoading) {
    return <LoginView />;
  }

  // Loading spinner during initial auth check
  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-bold text-blue-700 bg-blue-50 px-6 py-3 rounded-2xl border border-blue-200 shadow-sm">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Connecting to WVUSD Onboarding Portal...</span>
        </div>
      </div>
    );
  }

  // Strict Roster Authorization: Lock portal down to emails on Specialist or Sites tabs
  const isAuthorized = user?.isSuperAdmin || user?.isHr || user?.isSpecialist || user?.isSiteStaff;
  if (user && !isAuthorized && !isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase bg-amber-100 text-amber-800 tracking-wider">
              Access Restricted
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Not on Authorized Roster
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your Google account (<strong className="font-semibold text-slate-900">{user.email}</strong>) is authenticated, but is not currently registered on the district <strong className="font-semibold">Specialist</strong> or <strong className="font-semibold">Sites</strong> tabs.
            </p>
            <p className="text-xs text-slate-500">
              Please contact District IT Administration (Cell D1) to request portal access.
            </p>
          </div>
          <button
            onClick={logout}
            type="button"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Dev Switcher & Demo Toolbar */}
      <DevToolbar />

      {/* Main Navigation Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Body - Renders ONLY the active view */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'site' && <SiteSubmissionView />}
        {activeTab === 'hr' && <HrView />}
        {activeTab === 'specialist' && <SpecialistView />}
        {activeTab === 'admin' && <AdminView />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-700">
            Walnut Valley Unified School District • Onboarding & System Access Automation Portal
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Role-Based Access Control: Site Staff, HR Coordinators, System Specialists, District Administration
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
