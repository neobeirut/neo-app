import { AlertTriangle, X } from 'lucide-react';

interface ConflictModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export default function ConflictModal({ isOpen, message, onClose }: ConflictModalProps) {
  if (!isOpen || !message) return null;

  // Clean up raw error prefixes to make the message extra friendly
  const cleanMessage = message
    .replace(/^Error saving schedule assignment:\s*/i, '')
    .replace(/^Error quick assigning shift:\s*/i, '');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            padding: '6px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            borderRadius: '6px'
          }}
        >
          <X size={18} />
        </button>

        {/* Warning Icon */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: '#fff7ed',
            border: '1px solid #ffedd5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ea580c',
            marginBottom: '16px'
          }}
        >
          <AlertTriangle size={26} />
        </div>

        {/* Title */}
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
          Schedule Conflict
        </h3>

        {/* Message */}
        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 20px 0' }}>
          {cleanMessage}
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px 18px',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
          }}
        >
          Got it
        </button>

      </div>
    </div>
  );
}
