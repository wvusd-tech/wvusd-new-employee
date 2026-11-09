// src/components/RequestDetailsModal.jsx
import React, { useState } from 'react';
import { X, MessageSquare, Send, CheckCircle2, Clock, User, Building, Mail, Calendar, Shield } from 'lucide-react';
import StatusBadge, { TypeBadge, EmployeeTypeBadge } from './StatusBadge.jsx';
import { api } from '../services/api.js';
import { getSiteLogo } from '../config.js';

export default function RequestDetailsModal({ request, onClose, onUpdate, currentUserEmail }) {
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState(null);

  if (!request) return null;

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    setCommentError(null);
    try {
      const res = await api.addComment({
        requestId: request.id,
        commentText: commentText.trim(),
        userEmail: currentUserEmail
      }, currentUserEmail);

      if (res.success) {
        setCommentText('');
        if (onUpdate) onUpdate();
      } else {
        setCommentError(res.error || "Failed to add comment.");
      }
    } catch (err) {
      setCommentError(err.message || "Failed to add comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const isSub = request.requestType === 'Long-Term Sub';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Modal Header with School Site Logo */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md p-1.5 flex items-center justify-center border border-white/20 shadow-md flex-shrink-0">
              <img
                src={getSiteLogo(request.site)}
                alt={request.site}
                className="max-h-full max-w-full object-contain filter drop-shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-blue-300 tracking-wider">
                  {request.id}
                </span>
                <TypeBadge type={request.requestType} />
                {request.employeeType && (
                  <EmployeeTypeBadge type={request.employeeType} />
                )}
                <StatusBadge status={request.status} size="sm" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {request.fullName || `${request.firstName} ${request.lastName}`}
              </h2>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold">{request.site}</span>
                <span>•</span>
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Created {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-sm">
          
          {/* Key Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Assigned Work Email:</span>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {request.workEmail ? (
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {request.workEmail}
                  </span>
                ) : (
                  <span className="text-amber-600 italic">Pending HR Assignment</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Submitter:</span>
              <div className="font-mono text-xs text-slate-700 mt-0.5 truncate">
                {request.submitterEmail || "N/A"}
              </div>
            </div>

            {isSub && (
              <>
                <div>
                  <span className="text-xs font-semibold text-purple-700 uppercase">Covering Teacher:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {request.originalTeacherName || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-purple-700 uppercase">Teacher Email:</span>
                  <div className="font-mono text-xs text-slate-700 mt-0.5">
                    {request.originalTeacherEmail || "N/A"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Requested Services & Provisioning Status */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>System Access Checklist ({request.accessCompleted?.length || 0} / {request.accessRequested?.length || 0} completed)</span>
            </h4>
            
            {/* Progress bar */}
            {request.accessRequested?.length > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(((request.accessCompleted?.length || 0) / request.accessRequested.length) * 100)}%`
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {request.accessRequested?.map(service => {
                const isComplete = request.accessCompleted?.includes(service);
                return (
                  <div
                    key={service}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium ${
                      isComplete
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{service}</span>
                    {isComplete ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comments & Activity Log */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Specialist Notes & Activity Log</span>
            </h4>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 max-h-48 overflow-y-auto space-y-2">
              {request.comments ? (
                request.comments.split('\n').filter(Boolean).map((line, idx) => (
                  <div key={idx} className="text-xs p-2 rounded-lg bg-white border border-slate-200 shadow-2xs font-mono text-slate-700 whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 italic text-center py-2">
                  No notes recorded yet.
                </div>
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Log a note or comment for HR..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingComment ? "Saving..." : "Add Note"}</span>
              </button>
            </form>
            {commentError && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{commentError}</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
