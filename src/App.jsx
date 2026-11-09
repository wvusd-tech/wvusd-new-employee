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

function MainApp() {
  const { user, isLoading, activeTab, setActiveTab } = useAuth();

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
            Role-Based Access Control: Site Staff, HR Specialist (Cell C1), Service Specialists (Col B), Super Admin (Cell D1)
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
