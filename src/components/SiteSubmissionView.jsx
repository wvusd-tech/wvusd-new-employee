// src/components/SiteSubmissionView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import StatusBadge, { TypeBadge, EmployeeTypeBadge } from './StatusBadge.jsx';
import RequestDetailsModal from './RequestDetailsModal.jsx';
import { getSiteLogo } from '../config.js';
import {
  UserPlus,
  Users,
  Building,
  CheckSquare,
  Square,
  Send,
  Search,
  Filter,
  Eye,
  CheckCircle,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';

export default function SiteSubmissionView() {
  const { user, portalData, refreshData, submitRequest, impersonatedSite, isDemoMode } = useAuth();

  // Intake Form State
  const [requestType, setRequestType] = useState('New Employee'); // 'New Employee' | 'Long-Term Sub'
  const [employeeType, setEmployeeType] = useState('Classified'); // 'Classified' | 'Certificated'
  const [selectedSite, setSelectedSite] = useState(() => {
    if (impersonatedSite) return impersonatedSite;
    if (user?.authorizedSites && user.authorizedSites.length > 0) {
      return user.authorizedSites[0];
    }
    return portalData.sites[0]?.siteName || 'Diamond Bar High';
  });

  useEffect(() => {
    if (impersonatedSite) {
      setSelectedSite(impersonatedSite);
    }
  }, [impersonatedSite]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [originalTeacherName, setOriginalTeacherName] = useState('');
  const [originalTeacherEmail, setOriginalTeacherEmail] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [formError, setFormError] = useState(null);

  // Status Tracking Table Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRequestForModal, setSelectedRequestForModal] = useState(null);

  // Available services from backend, strictly filtering out sheet header labels like "Topics"
  const FORBIDDEN_HEADERS = [
    'topic',
    'topics',
    'service',
    'services',
    'system',
    'systems',
    'topic name',
    'service name',
    'all topics',
    'escape'
  ];

  const availableServices = (portalData.services || [])
    .map(s => (typeof s === 'string' ? s : s.serviceName))
    .filter(name => {
      if (!name) return false;
      const lower = String(name).trim().toLowerCase();
      if (FORBIDDEN_HEADERS.includes(lower)) return false;
      if (lower.startsWith('---') || lower.startsWith('(')) return false;
      return true;
    });

  // Toggle single service
  const toggleService = (serviceName) => {
    setSelectedServices(prev =>
      prev.includes(serviceName)
        ? prev.filter(s => s !== serviceName)
        : [...prev, serviceName]
    );
  };

  // Select / Deselect all
  const selectAllServices = () => setSelectedServices([...availableServices]);
  const deselectAllServices = () => setSelectedServices([]);

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(null);

    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Please provide both First Name and Last Name.");
      return;
    }

    if (requestType === 'Long-Term Sub' && !originalTeacherName.trim()) {
      setFormError("Please provide the Original Teacher's Name who is being covered.");
      return;
    }

    if (selectedServices.length === 0) {
      setFormError("Please select at least one required system access service.");
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedEmployeeType = employeeType; // 'Classified' or 'Certificated'
      const payload = {
        requestType,
        employeeType: resolvedEmployeeType,
        site: selectedSite,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        originalTeacherName: requestType === 'Long-Term Sub' ? originalTeacherName.trim() : '',
        originalTeacherEmail: requestType === 'Long-Term Sub' ? originalTeacherEmail.trim() : '',
        requestedServices: selectedServices,
        submitterEmail: user?.email || ''
      };

      const result = await submitRequest(payload);

      if (result.success) {
        const demoNote = isDemoMode ? " (Demo Mode Active: Live email suppressed)" : "";
        setSubmitSuccess(`Request for ${firstName} ${lastName} (${requestType} - ${resolvedEmployeeType}) submitted successfully (Status: Pending HR). An alert has been dispatched to HR.${demoNote}`);
        // Reset form fields
        setFirstName('');
        setLastName('');
        setOriginalTeacherName('');
        setOriginalTeacherEmail('');
        setSelectedServices([]);
        setEmployeeType('Classified');
        // Refresh requests list
        await refreshData();
      } else {
        setFormError(result.error || "Failed to submit request.");
      }
    } catch (err) {
      setFormError(err.message || "An error occurred while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter requests for the status tracking table:
  // If user is restricted Site Staff (not Super Admin), only show their authorized site(s).
  const isSuperAdmin = user?.isSuperAdmin;
  const userSites = user?.authorizedSites || [];

  const siteRequests = portalData.requests.filter(req => {
    // Site filter based on authorization
    if (!isSuperAdmin) {
      if (userSites.length > 0 && !userSites.includes(req.site)) {
        return false;
      }
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.fullName?.toLowerCase().includes(q);
      const matchId = req.id?.toLowerCase().includes(q);
      const matchEmail = req.workEmail?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchEmail) return false;
    }
    // Status filter
    if (statusFilter !== 'ALL' && req.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-blue-500/30 text-blue-200 border border-blue-400/40 tracking-wider">
            Site Access Intake
          </span>
          <h2 className="text-2xl sm:text-3xl font-black mt-2">
            Submit New Employee or Sub Access Request
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1 leading-relaxed">
            Authorized site administrators and office assistants can initiate system provisioning. Once submitted, HR will assign the district work email and dispatch tasks to specialists.
          </p>
        </div>
      </div>

      {/* Main Grid: Left = Intake Form, Right = Site Status Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* INTAKE FORM (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">New Access Request</h3>
              <p className="text-xs text-slate-500">Intake form for staff onboarding</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Request Type Selector (Toggle) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Request Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setRequestType('New Employee')}
                  className={`py-2 text-xs font-bold rounded-xl transition ${
                    requestType === 'New Employee'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  New Employee
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('Long-Term Sub')}
                  className={`py-2 text-xs font-bold rounded-xl transition ${
                    requestType === 'Long-Term Sub'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Long-Term Sub
                </button>
              </div>
            </div>

            {/* Employee Classification (Circle Radio Choice for Classified or Certificated) */}
            <div className="space-y-2 animate-fade-in">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Employee Classification <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {/* Classified Circle Option */}
                <button
                  type="button"
                  onClick={() => setEmployeeType('Classified')}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl transition text-xs font-bold text-left cursor-pointer border ${
                    employeeType === 'Classified'
                      ? 'bg-white border-emerald-400 text-emerald-900 shadow-xs ring-1 ring-emerald-400/30'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 ${
                      employeeType === 'Classified'
                        ? 'border-emerald-600 bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {employeeType === 'Classified' && (
                      <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    )}
                  </div>
                  <span>Classified</span>
                </button>

                {/* Certificated Circle Option */}
                <button
                  type="button"
                  onClick={() => setEmployeeType('Certificated')}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl transition text-xs font-bold text-left cursor-pointer border ${
                    employeeType === 'Certificated'
                      ? 'bg-white border-indigo-400 text-indigo-900 shadow-xs ring-1 ring-indigo-400/30'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 ${
                      employeeType === 'Certificated'
                        ? 'border-indigo-600 bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {employeeType === 'Certificated' && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <span>Certificated</span>
                </button>
              </div>

              {/* Dynamic Routing Notification Target */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                <span className="font-medium">Intake Destination:</span>
                <span className="font-bold text-slate-700">
                  {requestType === 'Long-Term Sub'
                    ? 'Sub HR Coordinator'
                    : employeeType === 'Classified'
                    ? 'Classified HR Coordinator'
                    : 'Certificated HR Coordinator'}
                </span>
              </div>
            </div>

            {/* Site Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                School / Site <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {/* If user is site staff, prioritize their authorized sites */}
                {user?.authorizedSites && user.authorizedSites.length > 0 && !isSuperAdmin ? (
                  user.authorizedSites.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))
                ) : (
                  portalData.sites.map(s => (
                    <option key={s.siteName} value={s.siteName}>{s.siteName}</option>
                  ))
                )}
              </select>
            </div>

            {/* Candidate Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Jane"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Doe"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Conditional Long-Term Sub Fields */}
            {requestType === 'Long-Term Sub' && (
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-3 animate-fade-in">
                <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-700" />
                  Long-Term Sub Assignment Information
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-1">
                    Original Teacher Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={requestType === 'Long-Term Sub'}
                    value={originalTeacherName}
                    onChange={(e) => setOriginalTeacherName(e.target.value)}
                    placeholder="e.g. Katherine Miller (on leave)"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-1">
                    Original Teacher Email
                  </label>
                  <input
                    type="email"
                    value={originalTeacherEmail}
                    onChange={(e) => setOriginalTeacherEmail(e.target.value)}
                    placeholder="kmiller@wvusd.org"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            )}

            {/* Requested Services Dynamic Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Requested Systems & Services <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllServices}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllServices}
                    className="text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Expanded container showing all services clearly without cramped scrollbar */}
              <div className="grid grid-cols-1 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {availableServices.map(service => {
                  const isChecked = selectedServices.includes(service);
                  return (
                    <label
                      key={service}
                      onClick={() => toggleService(service)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-xs transition border ${
                        isChecked
                          ? 'bg-blue-50/80 text-blue-900 font-bold border-blue-300 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm font-medium">{service}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Error & Success Alerts */}
            {formError && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {submitSuccess && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? "Submitting Request & Notifying HR..." : "Submit Access Request"}</span>
            </button>
          </form>
        </div>

        {/* STATUS TRACKING TABLE (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base">Site Request Status</h3>
              <p className="text-xs text-slate-500">
                Tracking records for {isSuperAdmin ? "All Sites" : userSites.join(", ") || "Your Site"}
              </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-44"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="Pending HR">Pending HR</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5">Candidate</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Provisioning Progress</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {siteRequests.length > 0 ? (
                  siteRequests.map(req => {
                    const completedCount = req.accessCompleted?.length || 0;
                    const totalCount = req.accessRequested?.length || 0;
                    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center flex-shrink-0 shadow-2xs">
                              <img
                                src={getSiteLogo(req.site)}
                                alt={req.site}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{req.fullName}</div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                                <span>{req.id}</span>
                                <span>•</span>
                                <span>{req.site}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <TypeBadge type={req.requestType} />
                            {req.employeeType && (
                              <EmployeeTypeBadge type={req.employeeType} />
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <StatusBadge status={req.status} size="sm" />
                        </td>

                        <td className="py-3 px-3 min-w-[120px]">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span>{completedCount}/{totalCount} items</span>
                            <span className="font-bold">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRequestForModal(req)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 shadow-xs transition-all duration-150 cursor-pointer active:scale-95 group"
                            title="View request details and audit history"
                          >
                            <Eye className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400 italic">
                      No matching access requests found for this site.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details & Comments Modal */}
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
