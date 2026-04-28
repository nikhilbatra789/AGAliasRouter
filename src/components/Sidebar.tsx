'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminApi } from '@/features/api-client';

const navItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/configuration', icon: 'settings', label: 'Configuration' },
  { href: '/provider-pool', icon: 'account_tree', label: 'Provider Pools' },
  { href: '/model-mapping', icon: 'route', label: 'Model Mappings' },
  { href: '/credential-files', icon: 'key', label: 'Credential Files' },
  { href: '/real-time-logs', icon: 'terminal', label: 'Real-time Logs' }
];

function NavItem({ item, collapsed, onClick }: { item: { href: string; icon: string; label: string }; collapsed: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const active = pathname === item.href;
  const base = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: collapsed ? '12px 0' : '10px 16px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderLeft: '4px solid transparent',
    font: '500 13px/18px Inter',
    cursor: 'pointer',
    userSelect: 'none' as const,
    transition: 'background .15s, color .15s',
    textDecoration: 'none'
  };
  const style = active
    ? { ...base, background: '#fff', color: '#0f457c', borderLeftColor: '#0f457c' }
    : hovered
      ? { ...base, background: '#f2f4f6', color: '#0f457c' }
      : { ...base, background: 'transparent', color: '#424750' };

  return (
    <Link href={item.href} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} title={collapsed ? item.label : undefined} style={style}>
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'inherit', fontVariationSettings: active ? '"FILL" 1' : '"FILL" 0' }}>{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  isMobile
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isMobile: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await adminApi.logout();
    router.push('/login');
  }

  const contents = (
    <>
      <div style={{ padding: collapsed ? '14px 0' : '18px 16px', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'stretch', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/logo.png" alt="logo" width={32} height={32} style={{ objectFit: 'contain', borderRadius: 4 }} />
            {!collapsed && <span style={{ font: '500 15px/18px Inter', color: '#0f457c', letterSpacing: '-0.02em' }}><b style={{ fontWeight: 800 }}>AG</b> AliasRouter</span>}
          </div>
          {!collapsed && (
            <button onClick={onToggle} title="Collapse" style={{ background: 'transparent', border: 0, color: '#737781', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>keyboard_double_arrow_left</span>
            </button>
          )}
        </div>
        {!collapsed && <span style={{ font: '500 11px/14px "Space Grotesk"', color: '#737781', letterSpacing: '.05em', paddingLeft: 42 }}>v1.0.4</span>}
        {collapsed && (
          <button onClick={onToggle} title="Expand" style={{ background: 'transparent', border: 0, color: '#737781', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>keyboard_double_arrow_right</span>
          </button>
        )}
      </div>
      <div style={{ borderBottom: '1px solid #c2c6d1' }} />
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => <NavItem key={item.href} item={item} collapsed={collapsed && !isMobile} onClick={isMobile ? onMobileClose : undefined} />)}
      </div>
      <div style={{ borderTop: '1px solid #c2c6d1', padding: '4px 0' }}>
        <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: collapsed && !isMobile ? '12px 0' : '10px 16px', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', border: 0, borderLeft: '4px solid transparent', background: 'transparent', color: '#424750', font: '500 13px/18px Inter', cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {mobileOpen && <div onClick={onMobileClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 100, backdropFilter: 'blur(2px)' }} />}
        <nav style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, background: '#f7f9fb', borderRight: '1px solid #c2c6d1', display: 'flex', flexDirection: 'column', zIndex: 101, transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease', boxShadow: mobileOpen ? '4px 0 24px rgba(15,23,42,.12)' : 'none' }}>
          {contents}
        </nav>
      </>
    );
  }

  return (
    <nav style={{ width: collapsed ? 64 : 240, background: '#f7f9fb', borderRight: '1px solid #c2c6d1', display: 'flex', flexDirection: 'column', transition: 'width .2s ease', flexShrink: 0, height: '100%' }}>
      {contents}
    </nav>
  );
}
