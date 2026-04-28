'use client';

const labels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/configuration': 'Configuration',
  '/provider-pool': 'Provider Pools',
  '/model-mapping': 'Model Mappings',
  '/credential-files': 'Credential Files',
  '/real-time-logs': 'Real-time Logs'
};

export function TopBar({ pathname, onMenuOpen, isMobile }: { pathname: string; onMenuOpen: () => void; isMobile: boolean }) {
  const breadcrumb = ['Production', labels[pathname] || 'Dashboard'];
  return (
    <header style={{ height: 56, flexShrink: 0, background: '#fff', borderBottom: '1px solid #c2c6d1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {isMobile && (
          <button onClick={onMenuOpen} aria-label="Open navigation" style={{ background: 'transparent', border: 0, color: '#424750', cursor: 'pointer', padding: 6, borderRadius: 4, display: 'inline-flex', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>menu</span>
          </button>
        )}
        <div style={{ font: '500 13px/18px Inter', color: '#424750', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          {breadcrumb.map((crumb, index) => (
            <span key={crumb} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              {index > 0 && <span style={{ color: '#c2c6d1', flexShrink: 0 }}>/</span>}
              <span style={{ color: index === breadcrumb.length - 1 ? '#191c1e' : '#737781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumb}</span>
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: '#eceef0', border: '1px solid #c2c6d1', flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981', boxShadow: '0 0 8px #10b98180' }} />
        <span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#424750', whiteSpace: 'nowrap' }}>{isMobile ? 'Healthy' : 'System: Healthy'}</span>
      </div>
    </header>
  );
}
