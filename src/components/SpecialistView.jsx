// src/components/SpecialistView.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { getSiteLogo } from '../config.js';
import StatusBadge, { TypeBadge, EmployeeTypeBadge } from './StatusBadge.jsx';
import RequestDetailsModal from './RequestDetailsModal.jsx';
import {
  Wrench,
  CheckCircle2,
  Clock,
  MessageSquare,
  Building,
  Mail,
  Send,
  Sparkles,
  AlertCircle,
  Eye,
  CheckSquare,
  Square
} from 'lucide-react';

export default function SpecialistView() {
  const {
    user,
    portalData,
    refreshData,
    toggleAccess,
    addComment,
    isDemoMode,
    impersonatedTopic
  } = useAuth();

  // Tab filter: 'actionable' (needs checkoff) vs 'all' (all assigned)
  const [activeFilter, setActiveFilter] = useState('actionable');
  const [commentingRequestId, setCommentingRequestId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(null);
  const [toggleLoading, setToggleLoading] = useState({}); // { `${reqId}_${service}`: boolean }
  const [selectedRequestForModal, setSelectedRequestForModal] = useState(null);

  // Determine the services this specialist is responsible for
  // If Super Admin, allow overseeing all services or the selected impersonated topic
  const isSuperAdmin = user?.isSuperAdmin;
  let myAssignedServices = isSuperAdmin
    ? (impersonatedTopic && impersonatedTopic !== 'ALL' ? [impersonatedTopic] : portalData.services.map(s => s.serviceName))
    : user?.assignedServices || [];

  // Filter requests that require at least one service this specialist is responsible for
  const specialistRequests = portalData.requests.filter(req => {
    // Only requests that have work email assigned or in progress/completed
    const relevantServices = req.accessRequested?.filter(s => myAssignedServices.includes(s)) || [];
    if (relevantServices.length === 0) return false;

    if (activeFilter === 'actionable') {
      // Must have at least one assigned service that is NOT completed yet
      const hasPendingService = relevantServices.some(s => !req.accessCompleted?.includes(s));
      return hasPendingService && req.status !== 'Completed';
    }

    return true;
  });

  // Handle checking or unchecking a service
  const handleToggleService = async (request, serviceName, currentCompleted) => {
    const key = `${request.id}_${serviceName}`;
    setToggleLoading(prev => ({ ...prev, [key]: true }));

    try {
      const res = await toggleAccess({
        requestId: request.id,
        serviceName: serviceName,
        completed: !currentCompleted,
        userEmail: user?.email || ''
      });

      if (res.success) {
        await refreshData();
      }
    } catch (err) {
      console.error("Error toggling service access:", err);
    } finally {
      setToggleLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Handle adding comment for HR
  const handleAddComment = async (requestId) => {
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    setCommentSuccess(null);
    try {
      const res = await addComment({
        requestId,
        commentText: commentText.trim(),
        userEmail: user?.email || ''
      });

      if (res.success) {
        const demoNote = isDemoMode ? " (Demo Mode: Live email suppressed)" : "";
        setCommentSuccess(`Note logged and notification dispatched to HR (Cell C1).${demoNote}`);
        setCommentText('');
        await refreshData();
        setTimeout(() => {
          setCommentingRequestId(null);
          setCommentSuccess(null);
        }, 1500);
      }
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 tracking-wider">
              Specialist Task Flow
            </span>
            <span className="text-emerald-300 font-mono text-xs hidden sm:inline">
              Col B (Rows 3+)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2">
            System Access Provisioning & Verification
          </h2>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1 leading-relaxed">
            Check off systems you have provisioned once district credentials are created. When all items are marked complete, final completion notifications are automatically sent to HR and CC'd to Site Principals and Office Staff.
          </p>

          {/* Assigned Services Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-emerald-300 font-semibold mr-1">Your Managed Services:</span>
            {myAssignedServices.length > 0 ? (
              myAssignedServices.map(s => (
                <span key={s} className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/20">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-amber-300 italic">No assigned services found for this email in Col B.</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* Sub-header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-base">
              My Provisioning Queue
            </h3>
            <p className="text-xs text-slate-500">
              Tasks requiring your assigned system authorizations
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setActiveFilter('actionable')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeFilter === 'actionable'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Needs My Action ({
                portalData.requests.filter(r => {
                  const rev = r.accessRequested?.filter(s => myAssignedServices.includes(s)) || [];
                  return rev.some(s => !r.accessCompleted?.includes(s)) && r.status !== 'Completed';
                }).length
              })
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Assigned Records ({specialistRequests.length})
            </button>
          </div>
        </div>

        {/* Candidate Cards Grid */}
        {specialistRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {specialistRequests.map(req => {
              const myServicesForReq = req.accessRequested?.filter(s => myAssignedServices.includes(s)) || [];
              const allMyServicesDone = myServicesForReq.every(s => req.accessCompleted?.includes(s));
              const isSub = req.requestType === 'Long-Term Sub';

              return (
                <div
                  key={req.id}
                  className={`p-5 rounded-3xl border transition shadow-xs flex flex-col justify-between space-y-4 ${
                    allMyServicesDone
                      ? 'bg-emerald-50/30 border-emerald-200'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header with Site Logo */}
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
                          Sub for: {req.originalTeacherName || 'N/A'}
                        </div>
                      )}
                    </div>

                    {/* Work Email */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Assigned District Work Email:
                      </span>
                      {req.workEmail ? (
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {req.workEmail}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 italic">
                          Awaiting HR Email Creation
                        </span>
                      )}
                    </div>

                    {/* Specialist Service Checklists */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-2">
                        Your Responsible Systems:
                      </span>

                      <div className="space-y-2">
                        {myServicesForReq.map(service => {
                          const isDone = req.accessCompleted?.includes(service);
                          const loadingKey = `${req.id}_${service}`;
                          const isLoadingToggle = toggleLoading[loadingKey];

                          return (
                            <button
                              key={service}
                              type="button"
                              disabled={isLoadingToggle}
                              onClick={() => handleToggleService(req, service, isDone)}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition text-left ${
                                isDone
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100/60'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/30'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {isDone ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                )}
                                <span>{service}</span>
                              </div>

                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                isDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {isLoadingToggle ? "Updating..." : isDone ? "Completed" : "Mark Done"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* All Services Progress summary */}
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Total Request Progress:</span>
                      <span className="font-bold text-slate-700">
                        {req.accessCompleted?.length || 0} of {req.accessRequested?.length || 0} total items
                      </span>
                    </div>
                  </div>

                  {/* Actions & Comment Drawer Toggle */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedRequestForModal(req)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition flex items-center gap-1 font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    <button
                      onClick={() => {
                        setCommentingRequestId(commentingRequestId === req.id ? null : req.id);
                        setCommentSuccess(null);
                      }}
                      className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl font-bold transition flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Note for HR</span>
                    </button>
                  </div>

                  {/* Inline Comment Box */}
                  {commentingRequestId === req.id && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-fade-in mt-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase">
                        Add Note / Alert for HR (Cell C1):
                      </label>
                      <textarea
                        rows={2}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="e.g. Account created, badge pending photo..."
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-between">
                        {commentSuccess ? (
                          <span className="text-[11px] font-bold text-emerald-600">
                            {commentSuccess}
                          </span>
                        ) : <span />}
                        <button
                          type="button"
                          disabled={isSubmittingComment || !commentText.trim()}
                          onClick={() => handleAddComment(req.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isSubmittingComment ? "Sending..." : "Submit Note"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 italic">
            No system access tasks currently require your attention.
          </div>
        )}
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
