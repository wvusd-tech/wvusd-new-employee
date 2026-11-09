// src/App.jsx
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import DevToolbar from './components/DevToolbar.jsx';
import Navbar from './components/Navbar.jsx';
import LoginView from './components/LoginView.jsx';
import SiteSubmissionView from './components/SiteSubmissionView.jsx';
import HrView from './components/HrView.jsx';
import SpecialistView from './components/SpecialistView.jsx';
import AdminView from './components/AdminView.jsx';

function MainApp() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('site');

  // Automatically switch default active tab when persona / role changes
  useEffect(() => {
    if (user?.isSuperAdmin) {
      setActiveTab('admin');
    } else if (user?.isHr) {
      setActiveTab('hr');
    } else if (user?.isSpecialist) {
      setActiveTab('specialist');
    } else if (user?.isSiteStaff) {
      setActiveTab('site');
    }
  }, [user?.email, user?.isSuperAdmin, user?.isHr, user?.isSpecialist, user?.isSiteStaff]);

  // If user is not signed in
  if (!user && !isLoading) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Dev Switcher Toolbar */}
      <DevToolbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Navigation Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Body */}
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
            Integrated Google Sheets REST Backend • RBAC Protocols for Site Staff, HR (Cell C1), Specialists (Col B), and Super Admin (Cell D1)
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
