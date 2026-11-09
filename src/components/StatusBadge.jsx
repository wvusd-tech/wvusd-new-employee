// src/components/StatusBadge.jsx
import React from 'react';
import { Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

export default function StatusBadge({ status, size = "md" }) {
  const s = String(status || "Pending HR").trim().toLowerCase();

  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-[11px]"
    : size === "lg"
    ? "px-3.5 py-1.5 text-xs"
    : "px-2.5 py-1 text-xs";

  if (s === "completed") {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        Completed
      </span>
    );
  }

  if (s === "in progress") {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" style={{ animationDuration: '4s' }} />
        In Progress
      </span>
    );
  }

  if (s === "cancelled") {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}>
        <XCircle className="w-3.5 h-3.5 text-slate-400" />
        Cancelled
      </span>
    );
  }

  // Pending HR
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}>
      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
      Pending HR
    </span>
  );
}

export function TypeBadge({ type }) {
  const isSub = String(type).toLowerCase().includes("sub");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${
        isSub
          ? "bg-purple-100 text-purple-800 border border-purple-200"
          : "bg-blue-100 text-blue-800 border border-blue-200"
      }`}
    >
      {isSub ? "Long-Term Sub" : "New Employee"}
    </span>
  );
}
