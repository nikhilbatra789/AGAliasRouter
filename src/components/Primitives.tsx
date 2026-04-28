'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AlertToastTone = 'success' | 'error' | 'warning';
export type AlertToastItem = {
  id: string;
  tone: AlertToastTone;
  title: string;
  message?: string;
};

export function Button({
  variant = 'primary',
  icon,
  iconClassName,
  iconStyle,
  children,
  onClick,
  disabled,
  full,
  type = 'button',
  title
}: {
  variant?: ButtonVariant;
  icon?: string;
  iconClassName?: string;
  iconStyle?: CSSProperties;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const base: CSSProperties = {
    font: '600 14px/20px "Space Grotesk"',
    padding: '10px 16px',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: '1px solid transparent',
    transition: 'background .15s, color .15s, opacity .15s, transform .08s',
    opacity: disabled ? 0.5 : 1,
    width: full ? '100%' : 'auto'
  };
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: '#0f457c', color: '#fff' },
    secondary: { background: 'transparent', color: '#0f457c', borderColor: '#0f457c' },
    ghost: { background: 'transparent', color: '#424750' },
    danger: { background: '#ba1a1a', color: '#fff' }
  };
  const hover: Record<ButtonVariant, CSSProperties> = {
    primary: { background: '#002e5a', color: '#fff' },
    secondary: { background: '#f2f4f6', color: '#0f457c', borderColor: '#0f457c' },
    ghost: { background: '#f2f4f6', color: '#0f457c' },
    danger: { background: '#93000a', color: '#fff' }
  };

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...base, ...variants[variant], ...(hovered && !disabled ? hover[variant] : {}) }}
    >
      {icon && <span className={`material-symbols-outlined ${iconClassName || ''}`.trim()} style={{ fontSize: 18, ...(iconStyle || {}) }}>{icon}</span>}
      {children}
    </button>
  );
}

export function Field({
  label,
  icon,
  trailingIcon,
  onTrailing,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  autoFocus
}: {
  label: string;
  icon?: string;
  trailingIcon?: string;
  onTrailing?: () => void;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const borderColor = error ? '#ba1a1a' : focus ? '#0f457c' : '#c2c6d1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ font: '500 12px/16px "Space Grotesk"', letterSpacing: '.05em', textTransform: 'uppercase', color: '#424750' }}>{label}</label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          border: `1px solid ${borderColor}`,
          borderRadius: 4,
          padding: '0 12px',
          boxShadow: focus ? '0 0 0 3px rgba(15,69,124,.18)' : 'none',
          transition: 'border .15s, box-shadow .15s'
        }}
      >
        {icon && <span className="material-symbols-outlined" style={{ fontSize: 18, color: focus ? '#0f457c' : '#737781', marginRight: 6 }}>{icon}</span>}
        <input
          autoFocus={autoFocus}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, border: 0, outline: 0, padding: '10px 0', font: '400 14px/20px Inter', background: 'transparent', color: '#191c1e', minWidth: 0 }}
        />
        {trailingIcon && (
          <button type="button" aria-label={trailingIcon} onClick={onTrailing} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#737781', padding: 4, display: 'inline-flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{trailingIcon}</span>
          </button>
        )}
      </div>
      {error && <span style={{ font: '400 12px/16px Inter', color: '#ba1a1a' }}>{error}</span>}
    </div>
  );
}

export function StatusChip({ status = 'active', children }: { status?: 'active' | 'degraded' | 'failed' | 'routing' | 'draft'; children: ReactNode }) {
  const map = {
    active: { bg: 'rgba(16,185,129,.12)', fg: '#047857', dot: '#10b981' },
    degraded: { bg: 'rgba(245,158,11,.14)', fg: '#b45309', dot: '#f59e0b' },
    failed: { bg: 'rgba(186,26,26,.1)', fg: '#93000a', dot: '#ba1a1a' },
    routing: { bg: 'rgba(124,58,237,.1)', fg: '#6d28d9', dot: '#7c3aed' },
    draft: { bg: 'rgba(115,119,129,.12)', fg: '#424750', dot: '#737781' }
  }[status];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, font: '600 10px/14px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', background: map.bg, color: map.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: map.dot }} />
      {children}
    </span>
  );
}

export function DataTable<T extends { name?: string }>({
  columns,
  rows
}: {
  columns: Array<{ key: string; label: string; mono?: boolean; render?: (row: T) => ReactNode }>;
  rows: T[];
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  font: '500 11px/16px "Space Grotesk"',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#424750',
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderBottom: '1px solid #c2c6d1',
                  background: '#f2f4f6'
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.name || index}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    padding: '11px 14px',
                    font: column.mono ? '600 13px/18px "Space Grotesk"' : '400 13px/18px Inter',
                    fontVariantNumeric: column.mono ? 'tabular-nums' : 'normal',
                    color: '#191c1e',
                    borderBottom: index < rows.length - 1 ? '1px solid #e6e8ea' : 0
                  }}
                >
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
      <h1 style={{ font: '600 20px/28px Inter', color: '#191c1e', margin: 0 }}>{children}</h1>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(25,28,30,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #c2c6d1', boxShadow: '0 8px 32px rgba(15,23,42,.14)', width: 560, maxWidth: '96vw', padding: '24px 24px 20px', animation: 'fadeInUp .18s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ font: '600 16px/22px Inter', color: '#191c1e' }}>{title}</span>
          <button type="button" aria-label="Close modal" onClick={onClose} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#737781', display: 'inline-flex', padding: 4, borderRadius: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AlertToastStack({
  toasts,
  onDismiss
}: {
  toasts: AlertToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  const toneStyles: Record<AlertToastTone, { border: string; bg: string; fg: string; icon: string; dot: string }> = {
    success: { border: '#a7f3d0', bg: '#f0fdf8', fg: '#065f46', icon: 'check_circle', dot: '#10b981' },
    error: { border: '#fca5a5', bg: '#fff5f5', fg: '#991b1b', icon: 'error', dot: '#ef4444' },
    warning: { border: '#fcd34d', bg: '#fffbeb', fg: '#92400e', icon: 'warning', dot: '#f59e0b' }
  };

  return (
    <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 1300, display: 'flex', flexDirection: 'column', gap: 8, width: 'min(420px, calc(100vw - 24px))' }}>
      {toasts.map((toast) => {
        const tone = toneStyles[toast.tone];
        return (
          <div key={toast.id} style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 8, boxShadow: '0 8px 20px rgba(15,23,42,.12)', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'fadeInUp .16s ease both' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: tone.dot, marginTop: 1 }}>{tone.icon}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: '600 13px/18px Inter', color: tone.fg }}>{toast.title}</div>
              {toast.message && <div style={{ font: '400 12px/17px Inter', color: '#424750', marginTop: 2, wordBreak: 'break-word' }}>{toast.message}</div>}
            </div>
            <button type="button" aria-label="Dismiss alert" onClick={() => onDismiss(toast.id)} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: '#737781', display: 'inline-flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
