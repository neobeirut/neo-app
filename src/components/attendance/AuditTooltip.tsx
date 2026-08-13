/* eslint-disable @typescript-eslint/no-explicit-any */
import { Edit3, ShieldCheck } from 'lucide-react';

interface AuditTooltipProps {
  log: {
    modified_by?: string;
    modified_at?: string;
    modification_reason?: string;
    punch_in_notes?: string;
    punch_out_notes?: string;
    notes?: string;
    is_excused?: boolean;
  };
}

export default function AuditTooltip({ log }: AuditTooltipProps) {
  const modifiedBy = log.modified_by || (log.punch_in_notes?.includes('[System]') ? 'Store Manager' : null);
  const modifiedAt = log.modified_at;
  const reason = log.modification_reason || log.notes || log.punch_out_notes || log.punch_in_notes;

  if (!modifiedBy && !modifiedAt && !log.is_excused && !reason) {
    return null;
  }

  const tooltipTitle = `Modified by: ${modifiedBy || 'Manager'}${modifiedAt ? ` on ${new Date(modifiedAt).toLocaleString()}` : ''}${reason ? ` | Note: ${reason}` : ''}`;

  return (
    <div
      title={tooltipTitle}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'help',
        marginLeft: '6px'
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '6px',
          backgroundColor: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        <Edit3 size={11} /> Modified
      </span>
    </div>
  );
}

export function AuditTooltipCard({ log }: AuditTooltipProps) {
  const modifiedBy = log.modified_by || 'Store Manager';
  const modifiedAt = log.modified_at ? new Date(log.modified_at).toLocaleString() : new Date().toLocaleDateString();
  const reason = log.modification_reason || log.notes || log.punch_out_notes || log.punch_in_notes;

  return (
    <div
      style={{
        marginTop: '6px',
        padding: '8px 12px',
        backgroundColor: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '8px',
        fontSize: '11px',
        color: '#92400e',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309' }}>
        <ShieldCheck size={13} /> Punch Audit Trail (Rollover Log)
      </div>
      <div><strong>Modified by:</strong> {modifiedBy}</div>
      <div><strong>Modified at:</strong> {modifiedAt}</div>
      {reason && <div><strong>Audit Note:</strong> {reason}</div>}
    </div>
  );
}
