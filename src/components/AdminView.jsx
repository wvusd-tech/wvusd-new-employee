// src/components/AdminView.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import StatusBadge, { TypeBadge, EmployeeTypeBadge } from './StatusBadge.jsx';
import RequestDetailsModal from './RequestDetailsModal.jsx';
import { getSiteLogo } from '../config.js';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  CheckCircle,
  AlertTriangle,
  Building,
  RefreshCw,
  Mail,
  UserCog
} from 'lucide-react';

export default function AdminView() {
  const { user, portalData, refreshData, adminOverride, isDemoMode } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected request for details modal
  const [selectedRequestForModal, setSelectedRequestForModal] = useState(null);

  // Override inline state
  const [editingEmailId, setEditingEmailId] = useState(null);
  const [newEmailValue, setNewEmailValue] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  // Filter requests
  const filteredRequests = portalData.requests.filter(req => {
    if (siteFilter !== 'ALL' && req.site !== siteFilter) return false;
    if (typeFilter !== 'ALL' && req.requestType !== typeFilter) return false;
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.fullName?.toLowerCase().includes(q);
      const matchId = req.id?.toLowerCase().includes(q);
      const matchEmail = req.workEmail?.toLowerCase().includes(q);
      const matchSubmitter = req.submitterEmail?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchEmail && !matchSubmitter) return false;
    }

    return true;
  });

  // KPI Metrics
  const totalCount = portalData.requests.length;
  const pendingCount = portalData.requests.filter(r => r.status === 'Pending HR').length;
  const inProgressCount = portalData.requests.filter(r => r.status === 'In Progress').length;
  const completedCount = portalData.requests.filter(r => r.status === 'Completed').length;

  // Handle Manual Status Override
  const handleStatusOverride = async (req, newStatus) => {
    if (confirm(`Override status of ${req.id} (${req.fullName}) to "${newStatus}"?`)) {
      try {
        const res = await adminOverride({
          requestId: req.id,
          status: newStatus,
          adminEmail: user?.email || ''
        });

        if (res.success) {
          const demoNote = isDemoMode ? " (Demo Mode Active)" : "";
          setActionMessage(`Status updated to ${newStatus}${demoNote}`);
          await refreshData();
          setTimeout(() => setActionMessage(null), 2500);
        }
      } catch (err) {
        alert("Failed to override status: " + err.message);
      }
    }
  };

  // Handle Work Email Override
  const handleEmailSave = async (req) => {
    try {
      const res = await adminOverride({
        requestId: req.id,
        workEmail: newEmailValue.trim().toLowerCase(),
        adminEmail: user?.email || ''
      });

      if (res.success) {
        setEditingEmailId(null);
        setActionMessage(`Work email updated for ${req.id}`);
        await refreshData();
        setTimeout(() => setActionMessage(null), 2500);
      }
    } catch (err) {
      alert("Failed to update email: " + err.message);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (portalData.requests.length === 0) return;

    const headers = [
      "Request ID",
      "Created At",
      "Request Type",
      "Site",
      "First Name",
      "Last Name",
      "Work Email",
      "Original Teacher Name",
      "Access Requested",
      "Access Completed",
      "Status",
      "Submitter Email",
      "HR Assigned At",
      "Final Notified At"
    ];

    const rows = filteredRequests.map(r => [
      `"${r.id}"`,
      `"${r.createdAt || ''}"`,
      `"${r.requestType}"`,
      `"${r.site}"`,
      `"${r.firstName}"`,
      `"${r.lastName}"`,
      `"${r.workEmail || ''}"`,
      `"${r.originalTeacherName || ''}"`,
      `"${(r.accessRequested || []).join('; ')}"`,
      `"${(r.accessCompleted || []).join('; ')}"`,
      `"${r.status}"`,
      `"${r.submitterEmail || ''}"`,
      `"${r.hrAssignedAt || ''}"`,
      `"${r.finalNotifiedAt || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WVUSD_Onboarding_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-purple-500/30 text-purple-200 border border-purple-400/40 tracking-wider">
              Super Admin Control Console
            </span>
            <span className="text-purple-300 font-mono text-xs hidden sm:inline">
              Cell D1 Master Access
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2">
            District-Wide Onboarding Governance & Overrides
          </h2>
          <p className="text-purple-200 text-xs sm:text-sm mt-1 leading-relaxed">
            Global oversight across all {portalData.sites.length} district sites and systems. Perform administrative status overrides, modify credential assignments, and audit end-to-end provisioning timestamps.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Records</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalCount}</div>
          <span className="text-[11px] text-slate-400">All intake submissions</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending HR</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">{pendingCount}</div>
          <span className="text-[11px] text-slate-400">Awaiting work emails</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">In Progress</span>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-1">{inProgressCount}</div>
          <span className="text-[11px] text-slate-400">Active specialist tasks</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{completedCount}</div>
          <span className="text-[11px] text-slate-400">Fully provisioned</span>
        </div>
      </div>

      {/* Audit Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-base">District Access Audit Table</h3>
            <p className="text-xs text-slate-500">
              Showing {filteredRequests.length} of {totalCount} total intake records
            </p>
          </div>

          {/* Search, Filters, and Export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search candidate, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-44 sm:w-56"
              />
            </div>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Sites</option>
              {portalData.sites.map(s => (
                <option key={s.siteName} value={s.siteName}>{s.siteName}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Types</option>
              <option value="New Employee">New Employee</option>
              <option value="Long-Term Sub">Long-Term Sub</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending HR">Pending HR</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Action feedback message */}
        {actionMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 rounded-xl flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">ID / Candidate</th>
                <th className="py-3 px-3">Site & Type</th>
                <th className="py-3 px-3">Work Email (Override)</th>
                <th className="py-3 px-3">Provisioning</th>
                <th className="py-3 px-3">Status Override</th>
                <th className="py-3 px-3 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const completedCount = req.accessCompleted?.length || 0;
                  const totalCount = req.accessRequested?.length || 0;
                  const isEditingEmail = editingEmailId === req.id;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      {/* Candidate & ID */}
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-slate-900 text-sm">{req.fullName}</div>
                        <div className="text-[11px] font-mono text-blue-600 font-bold mt-0.5">
                          {req.id}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Site & Type with Site Logo */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center flex-shrink-0 shadow-2xs">
                            <img
                              src={getSiteLogo(req.site)}
                              alt={req.site}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <span className="font-semibold text-slate-800">{req.site}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <TypeBadge type={req.requestType} />
                          {req.employeeType && (
                            <EmployeeTypeBadge type={req.employeeType} />
                          )}
                        </div>
                      </td>

                      {/* Work Email with inline edit */}
                      <td className="py-3.5 px-3">
                        {isEditingEmail ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="email"
                              value={newEmailValue}
                              onChange={(e) => setNewEmailValue(e.target.value)}
                              className="px-2 py-1 text-xs font-mono rounded border border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              placeholder="email@wvusd.org"
                            />
                            <button
                              onClick={() => handleEmailSave(req)}
                              className="px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingEmailId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-700">
                              {req.workEmail || <span className="text-slate-400 italic font-normal">None</span>}
                            </span>
                            <button
                              onClick={() => {
                                setEditingEmailId(req.id);
                                setNewEmailValue(req.workEmail || '');
                              }}
                              className="text-slate-400 hover:text-purple-600 p-0.5 rounded"
                              title="Override work email"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Provisioning progress */}
                      <td className="py-3.5 px-3 min-w-[130px]">
                        <div className="text-[11px] font-bold text-slate-700 mb-1">
                          {completedCount} / {totalCount} systems
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                          />
                        </div>
                      </td>

                      {/* Status Override dropdown */}
                      <td className="py-3.5 px-3">
                        <select
                          value={req.status}
                          onChange={(e) => handleStatusOverride(req, e.target.value)}
                          className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="Pending HR">Pending HR</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => setSelectedRequestForModal(req)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition inline-flex items-center gap-1"
                          title="View complete audit record and timestamps"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400 italic">
                    No requests found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRequestForModal && (
        <RequestDetailsModal
          request={selectedRequestForModal}
          onClose={() => setSelectedRequestForModal(null)}
          onUpdate={refreshData}
          currentUserEmail={user?.email}
        />
      )}
    </div>
  );
}
