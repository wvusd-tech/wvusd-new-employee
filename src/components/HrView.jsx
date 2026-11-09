// src/components/HrView.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { getSiteLogo } from '../config.js';
import StatusBadge, { TypeBadge, EmployeeTypeBadge } from './StatusBadge.jsx';
import RequestDetailsModal from './RequestDetailsModal.jsx';
import {
  UserCheck,
  Mail,
  Send,
  Building,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  Filter,
  Sparkles,
  X
} from 'lucide-react';

export default function HrView() {
  const { user, portalData, refreshData, assignEmail, isDemoMode } = useAuth();

  // Tab State: 'pending' (Pending HR queue) | 'active' (In Progress) | 'all' (All requests)
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');

  // Assignment Modal State
  const [assignModalRequest, setAssignModalRequest] = useState(null);
  const [workEmailInput, setWorkEmailInput] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(null);

  // Details Modal State
  const [detailsModalRequest, setDetailsModalRequest] = useState(null);

  // Compute counts
  const pendingRequests = portalData.requests.filter(r => r.status === 'Pending HR');
  const inProgressRequests = portalData.requests.filter(r => r.status === 'In Progress');
  const completedRequests = portalData.requests.filter(r => r.status === 'Completed');

  // Filter requests based on active tab & filters
  const displayedRequests = portalData.requests.filter(req => {
    // Tab filter
    if (activeTab === 'pending' && req.status !== 'Pending HR') return false;
    if (activeTab === 'inProgress' && req.status !== 'In Progress') return false;
    if (activeTab === 'completed' && req.status !== 'Completed') return false;

    // Site filter
    if (siteFilter !== 'ALL' && req.site !== siteFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.fullName?.toLowerCase().includes(q);
      const matchId = req.id?.toLowerCase().includes(q);
      const matchEmail = req.workEmail?.toLowerCase().includes(q);
      const matchSite = req.site?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchEmail && !matchSite) return false;
    }

    return true;
  });

  // Open Assign Modal and generate smart default email suggestion
  const openAssignModal = (req) => {
    setAssignModalRequest(req);
    setAssignError(null);
    setAssignSuccess(null);

    // Smart default email generator:
    // e.g., Jane Doe -> jdoe@wvusd.org (or sub.jdoe@wvusd.org for subs)
    const firstClean = (req.firstName || '').toLowerCase().replace(/[^a-z]/g, '');
    const lastClean = (req.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
    const firstInitial = firstClean.charAt(0) || 'user';
    const isSub = req.requestType === 'Long-Term Sub';

    const suggested = isSub
      ? `sub.${firstInitial}${lastClean}@wvusd.org`
      : `${firstInitial}${lastClean}@wvusd.org`;

    setWorkEmailInput(req.workEmail || suggested);
  };

  // Submit Work Email & Dispatch
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!workEmailInput.trim()) {
      setAssignError("Please provide a valid District Work Email.");
      return;
    }

    if (!workEmailInput.includes('@wvusd.org')) {
      setAssignError("District email must be in the @wvusd.org domain.");
      return;
    }

    setIsAssigning(true);
    setAssignError(null);
    try {
      const res = await assignEmail({
        requestId: assignModalRequest.id,
        workEmail: workEmailInput.trim().toLowerCase(),
        hrUserEmail: user?.email || ''
      });

      if (res.success) {
        const demoNote = isDemoMode ? " (Demo Mode Active: Live email suppressed)" : "";
        setAssignSuccess(`Work email ${workEmailInput} assigned. Request moved to In Progress and dispatched to specialists.${demoNote}`);
        await refreshData();
        setTimeout(() => {
          setAssignModalRequest(null);
        }, 1200);
      } else {
        setAssignError(res.error || "Failed to assign work email.");
      }
    } catch (err) {
      setAssignError(err.message || "An error occurred during assignment.");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/30 text-amber-200 border border-amber-400/40 tracking-wider">
              Human Resources Specialist Desk
            </span>
            <span className="text-amber-300 font-mono text-xs hidden sm:inline">
              Cell C1 Coordinator
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2">
            Employee Work Email Provisioning & Specialist Dispatch
          </h2>
          <p className="text-amber-100 text-xs sm:text-sm mt-1 leading-relaxed">
            Review incoming site intake requests, allocate official @wvusd.org Google Workspace credentials, and automatically trigger notification dispatches to responsible system specialists.
          </p>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('pending')}
          className={`cursor-pointer p-5 rounded-3xl border transition shadow-sm ${
            activeTab === 'pending'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/40'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Pending HR Action
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
              {pendingRequests.length}
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {pendingRequests.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Candidates awaiting district email assignment
          </div>
        </div>

        <div
          onClick={() => setActiveTab('inProgress')}
          className={`cursor-pointer p-5 rounded-3xl border transition shadow-sm ${
            activeTab === 'inProgress'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/40'
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              In Specialist Hands
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              {inProgressRequests.length}
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {inProgressRequests.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Email assigned; specialists checking off items
          </div>
        </div>

        <div
          onClick={() => setActiveTab('completed')}
          className={`cursor-pointer p-5 rounded-3xl border transition shadow-sm ${
            activeTab === 'completed'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/40'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Completed & Active
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              {completedRequests.length}
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {completedRequests.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Fully provisioned and ready for instruction
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* Filter & View Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          
          {/* Sub Navigation Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'pending'
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending HR Queue ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('inProgress')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'inProgress'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Progress ({inProgressRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'completed'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({completedRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Records ({portalData.requests.length})
            </button>
          </div>

          {/* Search & Site Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search candidate, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 w-44 sm:w-56"
              />
            </div>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Sites</option>
              {portalData.sites.map(s => (
                <option key={s.siteName} value={s.siteName}>{s.siteName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actionable Cards Grid / Table */}
        {displayedRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedRequests.map(req => {
              const isPending = req.status === 'Pending HR';
              const isSub = req.requestType === 'Long-Term Sub';
              const completedCount = req.accessCompleted?.length || 0;
              const totalCount = req.accessRequested?.length || 0;

              return (
                <div
                  key={req.id}
                  className={`p-5 rounded-3xl border transition shadow-xs flex flex-col justify-between space-y-4 ${
                    isPending
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Row with Site Logo */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0 shadow-2xs">
                          <img
                            src={getSiteLogo(req.site)}
                            alt={req.site}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-slate-500">
                              {req.id}
                            </span>
                            <TypeBadge type={req.requestType} />
                            {req.employeeType && req.employeeType !== 'Substitute' && (
                              <EmployeeTypeBadge type={req.employeeType} />
                            )}
                          </div>
                          <h4 className="text-base font-black text-slate-900 mt-0.5 truncate">
                            {req.fullName}
                          </h4>
                        </div>
                      </div>
                      <StatusBadge status={req.status} size="sm" />
                    </div>

                    {/* Site & Submitter info */}
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{req.site}</span>
                      </div>
                      {isSub && (
                        <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          Sub covering: {req.originalTeacherName || 'N/A'}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400">
                        Submitted by: {req.submitterEmail || 'N/A'}
                      </div>
                    </div>

                    {/* Work Email Pill */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Work Email:
                      </span>
                      {req.workEmail ? (
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                          {req.workEmail}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-bold bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300 inline-block animate-pulse">
                          Pending Email Assignment
                        </span>
                      )}
                    </div>

                    {/* Requested Services Tags */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Requested Services ({completedCount}/{totalCount}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {req.accessRequested?.map(service => {
                          const isDone = req.accessCompleted?.includes(service);
                          return (
                            <span
                              key={service}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                isDone
                                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isDone ? '✓ ' : ''}{service}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setDetailsModalRequest(req)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    {isPending ? (
                      <button
                        onClick={() => openAssignModal(req)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Assign Email & Dispatch</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openAssignModal(req)}
                        className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        Edit Email
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 italic">
            No requests found matching your filter criteria.
          </div>
        )}
      </div>

      {/* ASSIGN WORK EMAIL MODAL */}
      {assignModalRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
            
            {/* Modal Header with Site Logo */}
            <div className="bg-gradient-to-r from-amber-900 to-amber-950 text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md p-1 flex items-center justify-center border border-white/20 shadow-md flex-shrink-0">
                  <img
                    src={getSiteLogo(assignModalRequest.site)}
                    alt={assignModalRequest.site}
                    className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                  />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-amber-300 tracking-wider">
                    {assignModalRequest.id}
                  </span>
                  <h3 className="text-xl font-black text-white mt-0.5">
                    Assign District Work Email
                  </h3>
                  <p className="text-xs text-amber-100 mt-0.5 flex items-center gap-2">
                    <strong>{assignModalRequest.fullName}</strong> • {assignModalRequest.site}
                    {assignModalRequest.employeeType && (
                      <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                        {assignModalRequest.employeeType}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalRequest(null)}
                className="p-1 rounded-full text-amber-200 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-5">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Automated Specialist Dispatch Notice:
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Submitting will mark this request as <strong>In Progress</strong> and trigger automated provisioning emails to all specialists responsible for the requested services.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  District Work Email (@wvusd.org) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={workEmailInput}
                    onChange={(e) => setWorkEmailInput(e.target.value)}
                    placeholder="firstinitial+lastname@wvusd.org"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Auto-formatted per WVUSD district naming convention.
                </p>
              </div>

              {/* Requested services preview */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Services to be Dispatched:
                </span>
                <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {assignModalRequest.accessRequested?.map(s => (
                    <span key={s} className="text-[11px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status messages */}
              {assignError && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{assignError}</span>
                </div>
              )}

              {assignSuccess && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{assignSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalRequest(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAssigning ? "Dispatching..." : "Submit & Dispatch"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModalRequest && (
        <RequestDetailsModal
          request={detailsModalRequest}
          onClose={() => setDetailsModalRequest(null)}
          onUpdate={refreshData}
          currentUserEmail={user?.email}
        />
      )}
    </div>
  );
}
