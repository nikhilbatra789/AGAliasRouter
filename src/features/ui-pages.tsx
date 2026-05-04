'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi } from './api-client';
import { AlertToastStack, Button, DataTable, Field, Modal, PageTitle } from '@/components/Primitives';
import type { AppConfig, CredentialFile, DashboardMetrics, HealthState, LogEvent, ModelMapping, Provider, ProviderFamily, ProviderModel, ProviderPool, RoutingStrategy } from '@/shared/types';

function genId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function useUptime(startIso?: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startIso) return;
    const origin = new Date(startIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - origin) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startIso]);
  const d = Math.floor(elapsed / 86400);
  const h = Math.floor((elapsed % 86400) / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function useMobile(bp = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < bp);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [bp]);
  return mobile;
}

export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  async function login() {
    setError('');
    const response = await adminApi.login(user, pw, params.get('next') || undefined);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    router.push(params.get('next') || '/dashboard');
    router.refresh();
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fb', color: '#191c1e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', borderRadius: '50%', background: 'rgba(15,69,124,.05)', filter: 'blur(120px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', borderRadius: '50%', background: 'rgba(255,150,77,.05)', filter: 'blur(120px)', zIndex: 0 }} />
      <main style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, animation: 'fadeInUp .7s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Image src="/logo.png" alt="AG AliasRouter" width={96} height={96} style={{ objectFit: 'contain', marginBottom: 8 }} />
          <h1 style={{ font: '500 28px/32px Inter', letterSpacing: '-0.02em', color: '#002e5a', margin: '0 0 4px' }}><b style={{ fontWeight: 800 }}>AG</b> AliasRouter</h1>
          <p style={{ font: '400 14px/20px Inter', color: '#424750', margin: 0 }}>Authenticate to manage routing infrastructure</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            login();
          }}
          style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 12, padding: 32, boxShadow: '0 4px 12px rgba(15,23,42,.03)', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Field label="Username" icon="person" autoFocus value={user} onChange={setUser} placeholder="admin@gmail.com" error={!user.trim() ? 'Username is required.' : undefined} />
          <Field label="Password" icon="lock" type={showPw ? 'text' : 'password'} trailingIcon={showPw ? 'visibility_off' : 'visibility'} onTrailing={() => setShowPw((value) => !value)} value={pw} onChange={setPw} placeholder="Password" error={!pw.trim() ? 'Password is required.' : undefined} />
          {error && <div style={{ font: '500 13px/18px Inter', color: '#991b1b', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '9px 12px' }}>{error}</div>}
          <Button variant="primary" full type="submit" disabled={!user.trim() || !pw.trim()}>Login</Button>
        </form>
        <footer style={{ marginTop: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, opacity: .85 }}>
          <p style={{ font: '400 13px/18px Inter', color: '#737781', margin: 0 }}>Copyright © 2026 AG AliasRouter</p>
          <p style={{ font: '500 11px/14px "Space Grotesk"', letterSpacing: '.1em', color: '#737781', textTransform: 'uppercase', margin: 0 }}>v2.4.1-STABLE</p>
        </footer>
      </main>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, display: 'flex', gap: 2, opacity: .2 }}>
        {['#002e5a', '#ff964d', '#0f457c', '#262e42', '#002e5a'].map((color, index) => <div key={index} style={{ flex: 1, background: color }} />)}
      </div>
    </div>
  );
}

function ProviderBigCard({
  label,
  count,
  healthy,
  icon,
  logoSrc,
  logoAlt,
  accent,
  unhealthy,
  unhealthyProviders = []
}: {
  label: string;
  count: number;
  healthy?: number;
  icon?: string;
  logoSrc?: string;
  logoAlt?: string;
  accent: string;
  unhealthy?: boolean;
  unhealthyProviders?: DashboardMetrics['unhealthyProviders'];
}) {
  const healthyCount = healthy ?? 0;
  const healthColor = (health: HealthState) => health === 'degraded' ? '#f59e0b' : health === 'healthy' ? '#10b981' : '#ef4444';
  return (
    <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '8px 0 0 8px' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 6 }}>{label}</div>
          <div style={{ font: '600 48px/1 Inter', letterSpacing: '-0.03em', color: '#191c1e' }}>{count}</div>
          <div style={{ font: '400 12px/16px Inter', color: '#424750', marginTop: 4 }}>{unhealthy ? 'providers degraded or offline' : `${healthyCount} healthy · ${count - healthyCount} degraded`}</div>
        </div>
        {logoSrc ? (
          <Image src={logoSrc} alt={logoAlt || label} width={38} height={38} style={{ objectFit: 'contain', opacity: .95 }} />
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: accent, opacity: .7 }}>{icon}</span>
        )}
      </div>
      {!unhealthy && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: Math.max(healthyCount, 1), height: 4, background: '#10b981', borderRadius: 2 }} />
          {count - healthyCount > 0 && <div style={{ flex: count - healthyCount, height: 4, background: '#f59e0b', borderRadius: 2 }} />}
        </div>
      )}
      {unhealthy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: count > 0 ? '#ba1a1a' : '#10b981', display: 'inline-block' }} />
            <span style={{ font: '600 11px/16px "Space Grotesk"', letterSpacing: '.05em', textTransform: 'uppercase', color: count > 0 ? '#93000a' : '#047857' }}>{count > 0 ? 'Action Required' : 'All Clear'}</span>
          </div>
          {unhealthyProviders.length > 0 && (
            <div style={{ borderTop: '1px solid #f0f2f4', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 96, overflow: 'auto' }}>
              {unhealthyProviders.map((provider) => (
                <div key={provider.uuid} title={provider.lastError || provider.customName} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: healthColor(provider.health), flexShrink: 0 }} />
                  <span style={{ font: '500 12px/16px Inter', color: '#424750', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.customName}</span>
                  <span style={{ font: '500 10px/14px "Space Grotesk"', color: healthColor(provider.health), textTransform: 'uppercase', marginLeft: 'auto', flexShrink: 0 }}>{provider.health}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RoutingNode({ label, sub, accent, icon, highlight, logoSrc, logoAlt }: { label: string; sub?: string; accent: string; icon?: string; highlight?: boolean; logoSrc?: string; logoAlt?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${highlight ? accent : '#c2c6d1'}`, borderRadius: 6, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3, flex: '0 0 230px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {logoSrc && <Image src={logoSrc} alt={logoAlt || label} width={22} height={22} style={{ objectFit: 'contain', opacity: 0.9 }} />}
        {icon && <span className="material-symbols-outlined" style={{ fontSize: 16, color: highlight ? accent : '#737781' }}>{icon}</span>}
        <span style={{ font: '600 13px/18px Inter', color: '#191c1e' }}>{label}</span>
      </div>
      {sub && <span style={{ font: '400 11px/14px "Space Grotesk"', letterSpacing: '.04em', color: '#737781', textTransform: 'uppercase' }}>{sub}</span>}
    </div>
  );
}

function DiagramArrow({ label, color }: { label?: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1, minWidth: 72 }}>
      <div style={{ width: '100%', height: 1, background: color, position: 'relative' }}>
        <div style={{ position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `7px solid ${color}` }} />
      </div>
      {label && <span style={{ font: '500 10px/12px "Space Grotesk"', letterSpacing: '.04em', color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>}
    </div>
  );
}

function RoutingDiagram({ title, accent, endpoint, aliasPaths, curlExample, steps }: { title: string; accent: string; endpoint: string; aliasPaths: string[]; curlExample: string; steps: Array<{ kind: 'node'; label: string; sub?: string; icon?: string; highlight?: boolean; logoSrc?: string; logoAlt?: string } | { kind: 'arrow'; label?: string }> }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(curlExample).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, padding: '20px 24px' }}>
      <div style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', overflowX: 'auto', paddingBottom: 4 }}>
        {steps.map((step, index) =>
          step.kind === 'arrow'
            ? <DiagramArrow key={`a-${index}`} label={step.label} color={accent} />
            : <RoutingNode key={`n-${index}`} label={step.label} sub={step.sub} icon={step.icon} accent={accent} highlight={step.highlight} logoSrc={step.logoSrc} logoAlt={step.logoAlt} />
        )}
      </div>
      <div style={{ marginTop: 20, borderTop: '1px solid #f0f2f4', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ font: '500 10px/14px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 4 }}>Endpoint</div>
            <code style={{ font: '600 12px/18px "Space Grotesk"', color: accent, background: `${accent}0d`, padding: '2px 8px', borderRadius: 4 }}>{endpoint}</code>
          </div>
          <div>
            <div style={{ font: '500 10px/14px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 4 }}>Alias Paths</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {aliasPaths.map((path) => (
                <code key={path} style={{ font: '400 12px/18px "Space Grotesk"', color: '#424750', background: '#f7f9fb', padding: '2px 8px', borderRadius: 4, border: '1px solid #e6e8ea' }}>{path}</code>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div style={{ font: '500 10px/14px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 6 }}>Example Usage</div>
          <div style={{ position: 'relative', background: '#1e2537', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={handleCopy} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, color: copied ? '#10b981' : '#aab1ca', font: '500 11px/16px "Space Grotesk"', transition: 'color .15s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre style={{ margin: 0, padding: '14px 16px', paddingRight: 80, font: '400 12px/20px "Space Grotesk"', color: '#eff1f3', overflowX: 'auto', whiteSpace: 'pre' }}>{curlExample}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [runtimeBaseUrl, setRuntimeBaseUrl] = useState('http://localhost:9001');
  const isMobile = useMobile();

  useEffect(() => {
    let mounted = true;
    async function load() {
      const response = await adminApi.dashboard();
      if (mounted && response.ok) setMetrics(response.data);
    }
    load();
    const id = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRuntimeBaseUrl(window.location.origin);
    }
  }, []);

  const uptime = useUptime(metrics?.serviceStartedAt);
  const serverTime = metrics?.serverTime ? metrics.serverTime.replace('T', ' ').slice(0, 19) + ' UTC' : 'Loading';

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ font: '600 14px/20px Inter', color: '#191c1e', margin: 0 }}>Provider Health</h2>
          <span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.05em', textTransform: 'uppercase', color: '#737781' }}>Live · auto-refresh</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
          <ProviderBigCard label="OpenAI Providers" count={metrics?.providerCounts['openai-custom'] ?? 0} healthy={metrics?.healthyCounts['openai-custom'] ?? 0} logoSrc="/openai.svg" logoAlt="OpenAI logo" accent="#0f457c" />
          <ProviderBigCard label="Anthropic Providers" count={metrics?.providerCounts['anthropic-custom'] ?? 0} healthy={metrics?.healthyCounts['anthropic-custom'] ?? 0} logoSrc="/anthropic.svg" logoAlt="Anthropic logo" accent="#7c3aed" />
          <ProviderBigCard label="Unhealthy Providers" count={metrics?.unhealthyCount ?? 0} icon="warning" accent="#ba1a1a" unhealthy unhealthyProviders={metrics?.unhealthyProviders ?? []} />
        </div>
      </section>
      <section>
        <div style={{ marginBottom: 12 }}><h2 style={{ font: '600 14px/20px Inter', color: '#191c1e', margin: 0 }}>System Status</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, padding: '20px 24px' }}>
            <div style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 16 }}>System</div>
            {[
              ['code', 'Node.js', metrics?.nodeVersion ?? 'Loading'],
              ['dns', 'Platform', metrics?.platform ?? 'Loading'],
              ['schedule', 'Server Time', serverTime]
            ].map(([icon, label, value], index) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', gap: 8, borderBottom: index < 2 ? '1px solid #f0f2f4' : 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 13px/18px Inter', color: '#424750' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0f457c' }}>{icon}</span>{label}</span>
                <span style={{ font: '600 13px/18px Inter', color: '#191c1e', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781' }}>Service Uptime</div>
            <span style={{ font: '600 36px/1 "Space Grotesk"', letterSpacing: '-0.02em', color: '#0f457c', fontVariantNumeric: 'tabular-nums' }}>{uptime}</span>
            <div style={{ font: '400 12px/16px Inter', color: '#737781' }}>Started {metrics?.serviceStartedAt?.replace('T', ' ').slice(0, 16) ?? 'Loading'} UTC</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 2px rgba(16,185,129,.25)' }} /><span style={{ font: '600 11px/16px "Space Grotesk"', letterSpacing: '.05em', textTransform: 'uppercase', color: '#047857' }}>Service Online</span></div>
          </div>
        </div>
      </section>
      <section>
        <div style={{ marginBottom: 12 }}><h2 style={{ font: '600 14px/20px Inter', color: '#191c1e', margin: 0 }}>Active Routing Paths</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RoutingDiagram
            title="OpenAI — gpt-5-fast → gpt-40"
            accent="#0f457c"
            endpoint="/v1/chat/completions"
            aliasPaths={['/openai-{UID}/v1/chat/completions', '/openai-{CustomName}/v1/chat/completions']}
            curlExample={`curl ${runtimeBaseUrl}/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{\n    "model": "gpt-4o",\n    "messages": [{"role": "user", "content": "Hello!"}],\n    "max_tokens": 1000\n  }'`}
            steps={[
              { kind: 'node', label: 'Client Request', sub: 'alias: gpt-5-fast', icon: 'cloud_upload' },
              { kind: 'arrow', label: 'alias match' },
              { kind: 'node', label: 'AliasRouter', sub: 'routing engine', icon: 'route', highlight: true },
              { kind: 'arrow', label: 'pool select' },
              { kind: 'node', label: 'Your Provider', sub: 'pool · us-east-1', icon: 'account_tree', highlight: true },
              { kind: 'arrow', label: 'load balance' },
              { kind: 'node', label: 'OpenAI API', sub: 'gpt-40 · prod', logoSrc: '/openai.svg', logoAlt: 'OpenAI logo' }
            ]}
          />
          <RoutingDiagram
            title="Anthropic — claude-sonnet → claude-3-5-sonnet"
            accent="#7c3aed"
            endpoint="/v1/messages"
            aliasPaths={['/claude-{uid}/v1/messages', '/claude-{CustomName}/v1/messages']}
            curlExample={`curl ${runtimeBaseUrl}/v1/messages \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d '{\n    "model": "claude-sonnet-4-6",\n    "max_tokens": 1000,\n    "messages": [{"role": "user", "content": "Hello!"}]\n  }'`}
            steps={[
              { kind: 'node', label: 'Client Request', sub: 'alias: claude-sonnet', icon: 'cloud_upload' },
              { kind: 'arrow', label: 'alias match' },
              { kind: 'node', label: 'AliasRouter', sub: 'routing engine', icon: 'route', highlight: true },
              { kind: 'arrow', label: 'pool select' },
              { kind: 'node', label: 'Your Provider', sub: 'pool · us-west-2', icon: 'account_tree', highlight: true },
              { kind: 'arrow', label: 'load balance' },
              { kind: 'node', label: 'Anthropic API', sub: 'claude-3-5-sonnet', logoSrc: '/anthropic.svg', logoAlt: 'Anthropic logo' }
            ]}
          />
        </div>
      </section>
    </div>
  );
}

export function ConfigurationPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [timerConfig, setTimerConfig] = useState({
    cacheIntervalMinutes: '15',
    degradedIntervalMinutes: '15',
    unhealthyIntervalMinutes: '60',
    healthyModelsIntervalMinutes: '240',
    unhealthyModelsIntervalMinutes: '15',
    retentionIntervalMinutes: '60',
    healthCheckTimeoutSeconds: '60'
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.config().then((response) => {
      if (response.ok) {
        setConfig(response.data);
        setAdminUsername(response.data.adminUsername);
        setTimerConfig({
          cacheIntervalMinutes: String(response.data.cacheIntervalMinutes),
          degradedIntervalMinutes: String(response.data.degradedIntervalMinutes),
          unhealthyIntervalMinutes: String(response.data.unhealthyIntervalMinutes),
          healthyModelsIntervalMinutes: String(response.data.healthyModelsIntervalMinutes),
          unhealthyModelsIntervalMinutes: String(response.data.unhealthyModelsIntervalMinutes),
          retentionIntervalMinutes: String(response.data.retentionIntervalMinutes),
          healthCheckTimeoutSeconds: String(response.data.healthCheckTimeoutSeconds)
        });
      }
    });
  }, []);

  async function saveConfig(payload: Partial<AppConfig> & { sharedApiKey?: string; adminPassword?: string }) {
    setError('');
    const response = await adminApi.updateConfig(payload);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setConfig(response.data);
    setAdminUsername(response.data.adminUsername);
    setMessage('Saved successfully.');
    window.setTimeout(() => setMessage(''), 2200);
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #c2c6d1', background: '#fff', font: '400 13px/20px Inter', color: '#191c1e', outline: 'none' };
  const labelStyle = { font: '500 12px/16px Inter', color: '#424750', marginBottom: 6, display: 'block' };
  const sectionCard = { background: '#fff', border: '1px solid #c2c6d1', borderRadius: 10, overflow: 'hidden' };
  const sectionHeader = { padding: '18px 24px 14px', borderBottom: '1px solid #e6e8ea', display: 'flex', alignItems: 'center', gap: 12 };
  const sectionBody = { padding: '24px' };

  function parseTimerValue(value: string) {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }

  const timerFormValid = [
    timerConfig.cacheIntervalMinutes,
    timerConfig.degradedIntervalMinutes,
    timerConfig.unhealthyIntervalMinutes,
    timerConfig.healthyModelsIntervalMinutes,
    timerConfig.unhealthyModelsIntervalMinutes,
    timerConfig.retentionIntervalMinutes
  ].every((value) => parseTimerValue(value) !== null);

  async function copyApiKey() {
    if (!config?.sharedApiKey) return;
    try {
      await navigator.clipboard.writeText(config.sharedApiKey);
      setApiKeyCopied(true);
      window.setTimeout(() => setApiKeyCopied(false), 1400);
    } catch {
      setError('Could not copy API key.');
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <PageTitle>Configuration</PageTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={sectionCard}>
          <div style={sectionHeader}><div style={{ width: 36, height: 36, borderRadius: 8, background: '#eef3fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0f457c' }}>vpn_key</span></div><div><div style={{ font: '600 15px/20px Inter', color: '#191c1e' }}>API Key</div><div style={{ font: '400 12px/18px Inter', color: '#737781', marginTop: 2 }}>Used to authenticate requests to the AliasRouter API.</div></div></div>
          <div style={sectionBody}>
            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>Current API Key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 6, border: '1px solid #e6e8ea', background: '#f7f9fb' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9aa0ab', flexShrink: 0 }}>key</span>
                <code style={{ flex: 1, font: '500 13px/20px "Space Grotesk"', color: '#424750', letterSpacing: '.04em', wordBreak: 'break-all' }}>{apiKeyVisible ? config?.sharedApiKey : config?.sharedApiKeyMasked.replace(/./g, (c, i) => i < 2 ? c : '•')}</code>
                <button type="button" onClick={() => void copyApiKey()} aria-label="Copy API key" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: apiKeyCopied ? '#10b981' : '#737781', padding: '0 6px', display: 'inline-flex', alignItems: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>{apiKeyCopied ? 'check' : 'content_copy'}</span></button>
                <button type="button" onClick={() => setApiKeyVisible((value) => !value)} aria-label={apiKeyVisible ? 'Hide API key' : 'Reveal API key'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#737781', padding: '0 6px', display: 'inline-flex', alignItems: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>{apiKeyVisible ? 'visibility_off' : 'visibility'}</span></button>
              </div>
            </div>
            {!apiKeyEditing ? <Button variant="secondary" icon="edit" onClick={() => setApiKeyEditing(true)}>Update API Key</Button> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={labelStyle}>New API Key</label>
                <input style={inputStyle} type="password" value={apiKeyInput} onChange={(event) => setApiKeyInput(event.target.value)} placeholder="sk-..." autoFocus />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button icon="save" disabled={!apiKeyInput.trim()} onClick={() => { saveConfig({ sharedApiKey: apiKeyInput.trim() }); setApiKeyInput(''); setApiKeyEditing(false); }}>Save Key</Button>
                  <Button variant="ghost" onClick={() => { setApiKeyEditing(false); setApiKeyInput(''); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={sectionCard}>
          <div style={sectionHeader}><div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#7c3aed' }}>manage_accounts</span></div><div><div style={{ font: '600 15px/20px Inter', color: '#191c1e' }}>Admin Credentials</div><div style={{ font: '400 12px/18px Inter', color: '#737781', marginTop: 2 }}>Email and password for the control plane admin account.</div></div></div>
          <div style={sectionBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div><label style={labelStyle}>Admin Email</label><input style={inputStyle} value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} /></div>
              <div><label style={labelStyle}>New Password <span style={{ color: '#9aa0ab' }}>(leave blank to keep current)</span></label><input style={inputStyle} type="password" value={adminPass} onChange={(event) => setAdminPass(event.target.value)} /></div>
              {adminPass && <div><label style={labelStyle}>Confirm New Password</label><input style={{ ...inputStyle, borderColor: adminPassConfirm && adminPass !== adminPassConfirm ? '#ef4444' : '#c2c6d1' }} type="password" value={adminPassConfirm} onChange={(event) => setAdminPassConfirm(event.target.value)} /></div>}
              {error && <div style={{ font: '500 13px/18px Inter', color: '#991b1b', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '9px 12px' }}>{error}</div>}
              {message && <div style={{ font: '500 13px/18px Inter', color: '#065f46', background: '#f0fdf8', border: '1px solid #a7f3d0', borderRadius: 6, padding: '9px 12px' }}>{message}</div>}
              <Button icon="save" disabled={!adminUsername.trim() || (!!adminPass && adminPass !== adminPassConfirm)} onClick={() => saveConfig({ adminUsername, adminPassword: adminPass || undefined })}>Save Changes</Button>
            </div>
          </div>
        </div>
        <div style={sectionCard}>
          <div style={sectionHeader}><div style={{ width: 36, height: 36, borderRadius: 8, background: '#eef3fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0f457c' }}>timer</span></div><div><div style={{ font: '600 15px/20px Inter', color: '#191c1e' }}>Runtime Timers</div><div style={{ font: '400 12px/18px Inter', color: '#737781', marginTop: 2 }}>Background job intervals.</div></div></div>
          <div style={sectionBody}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div><label style={labelStyle}>Models Cache Refresh (mins)</label><input style={inputStyle} inputMode="numeric" value={timerConfig.cacheIntervalMinutes} onChange={(event) => setTimerConfig((current) => ({ ...current, cacheIntervalMinutes: event.target.value }))} /></div>
              <div><label style={labelStyle}>Degraded Provider Check (mins)</label><input style={inputStyle} inputMode="numeric" value={timerConfig.degradedIntervalMinutes} onChange={(event) => setTimerConfig((current) => ({ ...current, degradedIntervalMinutes: event.target.value }))} /></div>
              <div><label style={labelStyle}>Unhealthy/Failed Provider Check (mins)</label><input style={inputStyle} inputMode="numeric" value={timerConfig.unhealthyIntervalMinutes} onChange={(event) => setTimerConfig((current) => ({ ...current, unhealthyIntervalMinutes: event.target.value }))} /></div>
              <div><label style={labelStyle}>Healthy Model Mapping Check (mins)</label><input style={inputStyle} inputMode="numeric" value={timerConfig.healthyModelsIntervalMinutes} onChange={(event) => setTimerConfig((current) => ({ ...current, healthyModelsIntervalMinutes: event.target.value }))} /></div>
              <div><label style={labelStyle}>Unhealthy/Failed Model Mapping Check (mins)</label><input style={inputStyle} inputMode="numeric" value={timerConfig.unhealthyModelsIntervalMinutes} onChange={(event) => setTimerConfig((current) => ({ ...current, unhealthyModelsIntervalMinutes: event.target.value }))} /></div>
              <div><label style={labelStyle}>Logs Retention Sweep (mins)</label><input style={inputStyle} inputMode="numeric" value={timerConfig.retentionIntervalMinutes} onChange={(event) => setTimerConfig((current) => ({ ...current, retentionIntervalMinutes: event.target.value }))} /></div>
            </div>
            <div style={{ marginTop: 14, font: '400 12px/18px Inter', color: '#737781' }}>
              Timer values are in minutes and must be positive integers.
            </div>
            <div style={{ marginTop: 16 }}>
              <Button
                icon="save"
                disabled={!timerFormValid}
                onClick={() => {
                  const payload = {
                    cacheIntervalMinutes: parseTimerValue(timerConfig.cacheIntervalMinutes) || 15,
                    degradedIntervalMinutes: parseTimerValue(timerConfig.degradedIntervalMinutes) || 15,
                    unhealthyIntervalMinutes: parseTimerValue(timerConfig.unhealthyIntervalMinutes) || 60,
                    healthyModelsIntervalMinutes: parseTimerValue(timerConfig.healthyModelsIntervalMinutes) || 240,
                    unhealthyModelsIntervalMinutes: parseTimerValue(timerConfig.unhealthyModelsIntervalMinutes) || 15,
                    retentionIntervalMinutes: parseTimerValue(timerConfig.retentionIntervalMinutes) || 60
                  };
                  void saveConfig(payload);
                }}
              >
                Save Runtime Timers
              </Button>
            </div>
          </div>
        </div>
        <div style={sectionCard}>
          <div style={sectionHeader}><div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#c2410c' }}>hourglass_top</span></div><div><div style={{ font: '600 15px/20px Inter', color: '#191c1e' }}>Health Check Timeout</div><div style={{ font: '400 12px/18px Inter', color: '#737781', marginTop: 2 }}>Timeout for provider and model health-check requests.</div></div></div>
          <div style={sectionBody}>
            <div style={{ maxWidth: 260 }}>
              <label style={labelStyle}>Health Check Timeout (secs)</label>
              <input style={inputStyle} inputMode="numeric" value={timerConfig.healthCheckTimeoutSeconds} onChange={(event) => setTimerConfig((current) => ({ ...current, healthCheckTimeoutSeconds: event.target.value }))} />
            </div>
            <div style={{ marginTop: 14, font: '400 12px/18px Inter', color: '#737781' }}>
              Value is in seconds and must be a positive integer. Default is 60 seconds.
            </div>
            <div style={{ marginTop: 16 }}>
              <Button
                icon="save"
                disabled={parseTimerValue(timerConfig.healthCheckTimeoutSeconds) === null}
                onClick={() => {
                  void saveConfig({
                    healthCheckTimeoutSeconds: parseTimerValue(timerConfig.healthCheckTimeoutSeconds) || 60
                  });
                }}
              >
                Save Health Timeout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function healthLabel(health: HealthState) {
  return health === 'healthy' ? 'Normal' : health === 'failed' ? 'Failed' : health === 'degraded' ? 'Degraded' : 'Unknown';
}

function providerHealthLabel(provider: Provider) {
  return provider.enabled ? healthLabel(provider.health) : 'Disabled';
}

function ProviderModal({ pool, initial, onClose, onSave }: { pool: ProviderPool; initial?: Provider; onClose: () => void; onSave: (provider: Provider) => void }) {
  const empty: Provider = {
    uuid: genId('provider'),
    name: '',
    customName: '',
    family: pool.family,
    enabled: true,
    health: 'healthy',
    usageCount: 0,
    errorCount: 0,
    lastUsed: 'Never',
    lastCheck: 'Never',
    checkModelName: '',
    baseUrl: '',
    apiKey: '',
    apiKeyMasked: '',
    manualModels: [],
    models: []
  };
  const [form, setForm] = useState<Provider>(initial || empty);
  const [modelText, setModelText] = useState((initial?.manualModels || []).join('\n'));
  const [providerApiKeyVisible, setProviderApiKeyVisible] = useState(false);
  const [error, setError] = useState('');
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #c2c6d1', background: '#fff', font: '400 13px/20px Inter', color: '#191c1e', outline: 'none' };
  const labelStyle = { font: '500 12px/16px Inter', color: '#424750', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 };

  useEffect(() => {
    setForm(initial || empty);
    setModelText((initial?.manualModels || []).join('\n'));
    setProviderApiKeyVisible(false);
    setError('');
  }, [initial, pool.family]);

  function save() {
    if (!form.customName.trim()) {
      setError('Custom Name is required.');
      return;
    }
    if (!form.checkModelName.trim()) {
      setError('Health Check Model is required.');
      return;
    }
    if (!form.baseUrl.trim()) {
      setError('Base URL is required.');
      return;
    }
    if (!form.apiKey?.trim()) {
      setError('API Key is required.');
      return;
    }
    const manualModels = modelText.split('\n').map((value) => value.trim()).filter(Boolean);
    onSave({
      ...form,
      name: form.name || form.customName,
      customName: form.customName.trim(),
      manualModels,
      models: [...form.models.filter((model) => model.source !== 'manual'), ...manualModels.map((name) => ({ name, source: 'manual' as const }))]
    });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(25,28,30,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 780, boxShadow: '0 20px 60px rgba(0,0,0,.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e6e8ea' }}><div style={{ font: '600 18px/24px Inter', color: '#191c1e' }}>{initial ? 'Edit Provider Config' : 'Add New Provider Config'}</div><div style={{ font: '400 13px/18px Inter', color: '#737781', marginTop: 3 }}>Pool: <strong style={{ color: '#424750' }}>{pool.label}</strong></div></div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div><div style={labelStyle}>Custom Name</div><input style={inputStyle} placeholder="Custom Name" value={form.customName} onChange={(event) => setForm({ ...form, customName: event.target.value })} /></div>
            <div><div style={labelStyle}>Health Check Model</div><input style={inputStyle} placeholder="Model used for health checks" value={form.checkModelName} onChange={(event) => setForm({ ...form, checkModelName: event.target.value })} /></div>
            <div>
              <div style={labelStyle}>Health Check</div>
              <div style={{ position: 'relative' }}>
                <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', paddingRight: 36 }} value={form.enabled ? 'Enabled' : 'Disabled'} onChange={(event) => setForm({ ...form, enabled: event.target.value === 'Enabled' })}>
                  <option>Enabled</option>
                  <option>Disabled</option>
                </select>
                <span className="material-symbols-outlined" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 18, color: '#424750' }}>expand_more</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>API Key</div>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #c2c6d1', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                <input style={{ ...inputStyle, border: 0, borderRadius: 0 }} placeholder="sk-..." type={providerApiKeyVisible ? 'text' : 'password'} value={form.apiKey || ''} onChange={(event) => setForm({ ...form, apiKey: event.target.value, apiKeyMasked: event.target.value ? event.target.value.replace(/.(?=.{4})/g, '•') : '' })} />
                <button type="button" onClick={() => setProviderApiKeyVisible((value) => !value)} aria-label={providerApiKeyVisible ? 'Hide provider API key' : 'Reveal provider API key'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#737781', padding: '0 10px', display: 'inline-flex', alignItems: 'center', height: 38 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>{providerApiKeyVisible ? 'visibility_off' : 'visibility'}</span></button>
              </div>
            </div>
            <div><div style={labelStyle}>{pool.family === 'anthropic-custom' ? 'Anthropic Base URL' : 'OpenAI Base URL'}</div><input style={inputStyle} value={form.baseUrl} placeholder={pool.family === 'anthropic-custom' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} /></div>
          </div>
          <div>
            <div style={labelStyle}>Manual Provider Models</div>
            <textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical', fontFamily: 'Space Grotesk' }} value={modelText} onChange={(event) => setModelText(event.target.value)} placeholder={'One model per line\nexample-model-name'} />
          </div>
          {error && <div style={{ font: '500 13px/18px Inter', color: '#991b1b', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '9px 12px' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e6e8ea', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" icon="close" onClick={onClose}>Cancel</Button>
          <Button icon="save" disabled={!form.customName.trim() || !form.checkModelName.trim() || !form.baseUrl.trim() || !form.apiKey?.trim()} onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  checking,
  onEdit,
  onDelete,
  onToggle,
  onCheck
}: {
  provider: Provider;
  checking: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onCheck: () => void;
}) {
  const rowBg: Record<string, string> = { healthy: '#fafbfc', degraded: '#fffbeb', failed: '#fff5f5', unhealthy: '#fff5f5', unknown: '#fafbfc' };
  const rowBorder: Record<string, string> = { healthy: '#dde1e7', degraded: '#fcd34d', failed: '#fca5a5', unhealthy: '#fca5a5', unknown: '#dde1e7' };
  const rowAccent: Record<string, string> = { healthy: '#10b981', degraded: '#f59e0b', failed: '#ef4444', unhealthy: '#ef4444', unknown: '#9aa0ab' };
  const visualHealth = provider.enabled ? provider.health : 'unknown';
  const shouldShowError =
    provider.enabled &&
    (provider.health === 'unhealthy' || provider.health === 'failed' || provider.health === 'degraded') &&
    Boolean(provider.lastError?.trim());
  const [copied, setCopied] = useState<'customName' | 'uuid' | null>(null);

  function copyValue(key: 'customName' | 'uuid', value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1200);
    }).catch(() => null);
  }

  const copyButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#737781',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center'
  };

  return (
    <div style={{ background: provider.enabled ? rowBg[visualHealth] : '#f1f3f5', border: `1px solid ${provider.enabled ? rowBorder[visualHealth] : '#c2c6d1'}`, borderLeft: `3px solid ${provider.enabled ? rowAccent[visualHealth] : '#9aa0ab'}`, borderRadius: 8, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, opacity: provider.enabled ? 1 : .78 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ font: '600 14px/20px Inter', color: '#191c1e' }}>{provider.name}</span>
          <span style={{ font: '400 12px/16px "Space Grotesk"', color: '#737781', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Custom Name: {provider.customName}
            <button type="button" style={copyButtonStyle} onClick={() => copyValue('customName', provider.customName)} title={copied === 'customName' ? 'Copied' : 'Copy custom name'}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'customName' ? 'check' : 'content_copy'}</span>
            </button>
          </span>
          <span style={{ font: '400 11px/16px "Space Grotesk"', color: '#737781', fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            UUID: {provider.uuid}
            <button type="button" style={copyButtonStyle} onClick={() => copyValue('uuid', provider.uuid)} title={copied === 'uuid' ? 'Copied' : 'Copy UUID'}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'uuid' ? 'check' : 'content_copy'}</span>
            </button>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          <Button variant="ghost" icon={provider.enabled ? 'toggle_on' : 'toggle_off'} onClick={onToggle}>{provider.enabled ? 'Enabled' : 'Disabled'}</Button>
          <Button
            variant="secondary"
            icon="verified"
            onClick={onCheck}
            disabled={checking}
            iconStyle={{ animation: checking ? 'spin 0.8s linear infinite' : 'none' }}
          >
            Check
          </Button>
          <Button variant="secondary" icon="edit" onClick={onEdit}>Edit</Button>
          <Button variant="danger" icon="delete" onClick={onDelete}>Delete</Button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, rowGap: 4 }}>
        <span style={{ font: '400 12px/16px Inter', color: '#737781' }}>Health Check: <span style={{ color: '#424750' }}>{providerHealthLabel(provider)}</span></span>
        <span style={{ color: '#c2c6d1' }}>|</span>
        <span style={{ font: '400 12px/16px Inter', color: '#737781' }}>Usage Count: <span style={{ color: '#191c1e', fontWeight: 500 }}>{provider.usageCount.toLocaleString()}</span></span>
        <span style={{ color: '#c2c6d1' }}>|</span>
        <span style={{ font: '400 12px/16px Inter', color: '#737781' }}>Error Count: <span style={{ color: provider.errorCount > 0 ? '#dc2626' : '#191c1e', fontWeight: 500 }}>{provider.errorCount}</span></span>
        <span style={{ color: '#c2c6d1' }}>|</span>
        <span style={{ font: '400 12px/16px Inter', color: '#737781' }}>Manual Models: <span style={{ color: '#424750' }}>{provider.manualModels.length}</span></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ font: '400 12px/16px Inter', color: '#737781' }}>Last Check: <span style={{ color: '#424750' }}>{provider.lastCheck}</span></span>
        <span style={{ font: '400 12px/16px Inter', color: '#737781' }}>Check Model: <span style={{ color: '#424750' }}>{provider.checkModelName}</span></span>
      </div>
      {shouldShowError && (
        <div style={{ font: '400 12px/16px Inter', color: '#93000a' }}>
          Error: {provider.lastError}
        </div>
      )}
    </div>
  );
}

export function ProviderPoolsPage() {
  const [pools, setPools] = useState<ProviderPool[]>([]);
  const [modal, setModal] = useState<{ pool: ProviderPool; provider?: Provider } | null>(null);
  const [checkingProviders, setCheckingProviders] = useState<Record<string, boolean>>({});
  const [checkingUnhealthy, setCheckingUnhealthy] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; tone: 'success' | 'error' | 'warning'; title: string; message?: string }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ family: ProviderFamily; uuid: string; customName: string } | null>(null);
  const toastTimeoutsRef = useRef<number[]>([]);
  const accents = ['#0f457c', '#7c3aed'];

  function pushToast(toast: { tone: 'success' | 'error' | 'warning'; title: string; message?: string }) {
    const id = genId('toast');
    setToasts((current) => [...current, { id, ...toast }]);
    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      toastTimeoutsRef.current = toastTimeoutsRef.current.filter((item) => item !== timeoutId);
    }, 2800);
    toastTimeoutsRef.current.push(timeoutId);
  }

  useEffect(() => {
    adminApi.providerPools().then((response) => response.ok && setPools(response.data));
  }, []);

  useEffect(() => () => {
    for (const timeoutId of toastTimeoutsRef.current) window.clearTimeout(timeoutId);
    toastTimeoutsRef.current = [];
  }, []);

  function updatePool(family: ProviderFamily, update: (providers: Provider[]) => Provider[]) {
    setPools((current) => current.map((pool) => pool.family === family ? { ...pool, providers: update(pool.providers) } : pool));
  }

  async function saveProvider(pool: ProviderPool, provider: Provider) {
    const isEdit = pool.providers.some((existing) => existing.uuid === provider.uuid);
    const nextPools = pools.map((item) => item.family === pool.family ? {
      ...item,
      providers: item.providers.some((existing) => existing.uuid === provider.uuid)
        ? item.providers.map((existing) => existing.uuid === provider.uuid ? provider : existing)
        : [...item.providers, provider]
    } : item);
    setPools(nextPools);
    setModal(null);
    const saved = await adminApi.saveProviderPools(nextPools);
    if (saved.ok) {
      setPools(saved.data);
      pushToast({ tone: 'success', title: isEdit ? 'Provider updated' : 'Provider added' });
    } else {
      pushToast({ tone: 'error', title: 'Failed to save provider', message: saved.error.message });
      const reloaded = await adminApi.providerPools();
      if (reloaded.ok) setPools(reloaded.data);
      return;
    }
    if (provider.enabled && saved.ok) {
      const checked = await adminApi.checkHealth(provider.uuid);
      if (checked.ok) setPools(checked.data.pools);
    }
  }

  async function persistProviderPools(nextPools: ProviderPool[]) {
    setPools(nextPools);
    const saved = await adminApi.saveProviderPools(nextPools);
    if (saved.ok) {
      setPools(saved.data);
      return true;
    }
    pushToast({ tone: 'error', title: 'Failed to save provider pools', message: saved.error.message });
    return false;
  }

  async function deleteProvider() {
    if (!deleteConfirm) return;
    const nextPools = pools.map((item) => item.family === deleteConfirm.family ? {
      ...item,
      providers: item.providers.filter((existing) => existing.uuid !== deleteConfirm.uuid)
    } : item);
    setDeleteConfirm(null);
    const ok = await persistProviderPools(nextPools);
    if (ok) {
      pushToast({ tone: 'warning', title: `Provider deleted: ${deleteConfirm.customName}` });
    }
  }

  async function checkProvider(provider: Provider) {
    setCheckingProviders((current) => ({ ...current, [provider.uuid]: true }));
    try {
      const response = await adminApi.checkHealth(provider.uuid);
      if (response.ok) setPools(response.data.pools);
    } finally {
      setCheckingProviders((current) => ({ ...current, [provider.uuid]: false }));
    }
  }

  async function checkUnhealthyProviders() {
    const targets = pools
      .flatMap((pool) => pool.providers)
      .filter((provider) => provider.enabled && provider.health !== 'healthy' && provider.health !== 'unknown')
      .map((provider) => provider.uuid);
    if (!targets.length) return;
    setCheckingUnhealthy(true);
    setCheckingProviders((current) => {
      const next = { ...current };
      for (const id of targets) next[id] = true;
      return next;
    });
    try {
      const response = await adminApi.checkHealth('unhealthy');
      if (response.ok) setPools(response.data.pools);
    } finally {
      setCheckingProviders((current) => {
        const next = { ...current };
        for (const id of targets) next[id] = false;
        return next;
      });
      setCheckingUnhealthy(false);
    }
  }

  async function toggleProvider(pool: ProviderPool, provider: Provider) {
    const nextEnabled = !provider.enabled;
    const nextPools = pools.map((item) => item.family === pool.family ? {
      ...item,
      providers: item.providers.map((existing) => existing.uuid === provider.uuid ? { ...existing, enabled: nextEnabled, health: nextEnabled ? 'healthy' as HealthState : 'unknown' as HealthState } : existing)
    } : item);
    setPools(nextPools);
    const saved = await adminApi.saveProviderPools(nextPools);
    if (saved.ok) setPools(saved.data);
    if (nextEnabled) {
      const checked = await adminApi.checkHealth(provider.uuid);
      if (checked.ok) setPools(checked.data.pools);
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <AlertToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
      <PageTitle actions={<Button variant="secondary" icon="health_and_safety" onClick={() => void checkUnhealthyProviders()} disabled={checkingUnhealthy}>Check Unhealthy</Button>}>Provider Pools</PageTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {pools.map((pool, poolIndex) => {
          const accent = accents[poolIndex % accents.length];
          return (
            <section key={pool.family} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: '8px 8px 0 0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 10, height: 10, borderRadius: 999, background: accent }} /><span style={{ font: '600 15px/20px Inter', color: '#191c1e' }}>{pool.label}</span><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.05em', textTransform: 'uppercase', color: '#fff', background: accent, padding: '2px 8px', borderRadius: 4 }}>{pool.providers.length} providers</span></div>
                <Button variant="secondary" icon="add" onClick={() => setModal({ pool })}>Add Provider</Button>
              </div>
              <div style={{ border: '1px solid #c2c6d1', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16, background: '#f7f9fb', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pool.providers.map((provider) => (
                  <ProviderRow
                    key={provider.uuid}
                    provider={provider}
                    checking={Boolean(checkingProviders[provider.uuid])}
                    onEdit={() => setModal({ pool, provider })}
                    onDelete={() => setDeleteConfirm({ family: pool.family, uuid: provider.uuid, customName: provider.customName })}
                    onToggle={() => toggleProvider(pool, provider)}
                    onCheck={() => void checkProvider(provider)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {modal && <ProviderModal pool={modal.pool} initial={modal.provider} onClose={() => setModal(null)} onSave={(provider) => saveProvider(modal.pool, provider)} />}
      {deleteConfirm && (
        <Modal title="Delete Provider" onClose={() => setDeleteConfirm(null)}>
          <p style={{ font: '400 14px/22px Inter', color: '#424750' }}>
            Delete provider <strong style={{ color: '#191c1e' }}>{deleteConfirm.customName}</strong>? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" icon="delete" onClick={() => void deleteProvider()}>Delete Provider</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const strategyOptions: Array<{ label: string; value: RoutingStrategy }> = [
  { label: 'Round Robin', value: 'round_robin' },
  { label: 'Ordered', value: 'ordered' }
];

function LightSelect({ value, onChange, options, disabled = false }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} style={{ width: '100%', appearance: 'none', background: disabled ? '#f7f9fb' : '#fff', border: '1px solid #c2c6d1', borderRadius: 5, color: value ? '#191c1e' : '#737781', font: '400 13px/18px Inter', padding: '7px 32px 7px 10px', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none', minHeight: 34 }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="material-symbols-outlined" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#737781', pointerEvents: 'none' }}>expand_more</span>
    </div>
  );
}

function SearchableSelect({ value, onChange, options, disabled = false, placeholder = 'Search...' }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => window.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery('');
        }}
        style={{
          width: '100%',
          minHeight: 34,
          background: disabled ? '#f7f9fb' : '#fff',
          border: '1px solid #c2c6d1',
          borderRadius: 5,
          color: selected?.value ? '#191c1e' : '#737781',
          font: '400 13px/18px Inter',
          padding: '7px 32px 7px 10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {selected?.label || options[0]?.label || 'No options'}
      </button>
      <span className="material-symbols-outlined" style={{ position: 'absolute', right: 8, top: 17, transform: 'translateY(-50%)', fontSize: 16, color: '#737781', pointerEvents: 'none' }}>expand_more</span>
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: '#fff', border: '1px solid #c2c6d1', borderRadius: 6, boxShadow: '0 12px 28px rgba(15, 23, 42, .14)', padding: 8 }}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            style={{ width: '100%', border: '1px solid #0f62fe', outline: '2px solid rgba(15, 98, 254, .18)', borderRadius: 5, padding: '8px 10px', font: '400 13px/18px Inter', color: '#191c1e', marginBottom: 6 }}
          />
          <div style={{ maxHeight: 240, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filteredOptions.length ? filteredOptions.map((option) => {
              const selectable = Boolean(option.value);
              return (
                <button
                  type="button"
                  key={`${option.value}-${option.label}`}
                  disabled={!selectable}
                  onClick={() => {
                    if (!selectable) return;
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={{
                    border: 'none',
                    background: option.value === value ? '#eef3fb' : 'transparent',
                    color: selectable ? '#191c1e' : '#737781',
                    cursor: selectable ? 'pointer' : 'default',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 4,
                    font: '400 13px/18px Inter'
                  }}
                >
                  {option.label}
                </button>
              );
            }) : (
              <div style={{ padding: '8px 10px', font: '400 13px/18px Inter', color: '#737781' }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ModelMappingsPage() {
  const [mappings, setMappings] = useState<ModelMapping[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviderModels, setLoadingProviderModels] = useState<Record<string, boolean>>({});
  const [checkingRows, setCheckingRows] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<{ mappingId: string; rowId: string } | null>(null);
  const [healthInfoRow, setHealthInfoRow] = useState<ModelMapping['rows'][number] | null>(null);
  const [deleteMappingConfirm, setDeleteMappingConfirm] = useState<{ id: string; publicModelName: string } | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; tone: 'success' | 'error' | 'warning'; title: string; message?: string }>>([]);
  const attemptedProviderLoads = useRef<Set<string>>(new Set());
  const toastTimeoutsRef = useRef<number[]>([]);
  const mappingsRef = useRef<ModelMapping[]>([]);
  const persistedMappingsRef = useRef<ModelMapping[]>([]);
  const providerOptions = providers.map((provider) => ({ value: provider.uuid, label: `${provider.family} · ${provider.customName}` }));
  const mappingRowGridTemplate = '28px minmax(220px, 1fr) minmax(220px, 1fr) 172px';

  function pushToast(toast: { tone: 'success' | 'error' | 'warning'; title: string; message?: string }) {
    const id = genId('toast');
    setToasts((current) => [...current, { id, ...toast }]);
    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      toastTimeoutsRef.current = toastTimeoutsRef.current.filter((item) => item !== timeoutId);
    }, 2800);
    toastTimeoutsRef.current.push(timeoutId);
  }

  function providerModels(provider?: Provider | null): ProviderModel[] {
    if (!provider) return [];
    const manual = provider.manualModels.map((name) => ({ name, source: 'manual' as const }));
    return Array.from(new Map([...provider.models, ...manual].filter((model) => model.name).map((model) => [model.name, model])).values());
  }

  function hasApiLoadedModels(provider?: Provider | null) {
    return Boolean(provider?.models.some((model) => model.source === 'api'));
  }

  function modelOptions(provider?: Provider | null, fallbackModelName?: string) {
    const models = providerModels(provider);
    if (models.length) {
      const options = models.map((model) => ({ value: model.name, label: `${model.name}${model.source === 'manual' ? ' · manual' : ''}` }));
      if (fallbackModelName && !options.some((option) => option.value === fallbackModelName)) {
        options.unshift({ value: fallbackModelName, label: `${fallbackModelName} · configured` });
      }
      return options;
    }
    if (provider && fallbackModelName) return [{ value: fallbackModelName, label: `${fallbackModelName} · configured` }];
    if (provider && loadingProviderModels[provider.uuid]) return [{ value: '', label: 'Loading models...' }];
    if (provider) return [{ value: '', label: 'No models loaded' }];
    return [{ value: '', label: 'Select provider first' }];
  }

  useEffect(() => {
    adminApi.modelMappings().then((response) => {
      if (!response.ok) return;
      setMappings(response.data);
      mappingsRef.current = response.data;
      persistedMappingsRef.current = response.data;
    });
    adminApi.providerPools().then((response) => response.ok && setProviders(response.data.flatMap((pool) => pool.providers)));
  }, []);

  useEffect(() => {
    mappingsRef.current = mappings;
  }, [mappings]);

  useEffect(() => () => {
    for (const timeoutId of toastTimeoutsRef.current) window.clearTimeout(timeoutId);
    toastTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    const providerIdsNeedingModels = new Set(
      mappings
        .flatMap((mapping) => mapping.rows)
        .map((row) => row.providerUuid)
        .filter(Boolean)
    );
    providerIdsNeedingModels.forEach((providerUuid) => {
      const provider = providers.find((item) => item.uuid === providerUuid);
      if (!provider) return;
      if (hasApiLoadedModels(provider)) return;
      if (attemptedProviderLoads.current.has(providerUuid)) return;
      attemptedProviderLoads.current.add(providerUuid);
      void loadProviderModels(providerUuid);
    });
  }, [mappings, providers]);

  function updateMapping(id: string, patch: Partial<ModelMapping>) {
    setMappings((current) => current.map((mapping) => mapping.id === id ? { ...mapping, ...patch } : mapping));
  }

  function updateRowById(mappingId: string, rowId: string, patch: Partial<ModelMapping['rows'][number]>) {
    setMappings((current) => current.map((mapping) => mapping.id === mappingId ? { ...mapping, rows: mapping.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row) } : mapping));
  }

  function updateRow(mapping: ModelMapping, rowId: string, patch: Partial<ModelMapping['rows'][number]>) {
    updateRowById(mapping.id, rowId, patch);
  }

  function saveMappingsSnapshot(next: ModelMapping[]) {
    mappingsRef.current = next;
    setMappings(next);
    void adminApi.saveModelMappings(next);
  }

  function rowIsPersisted(mappingId: string, rowId: string) {
    return persistedMappingsRef.current.some((mapping) => mapping.id === mappingId && mapping.rows.some((row) => row.id === rowId));
  }

  function applyHealthPatchToAllMatchingRows(
    source: ModelMapping[],
    providerUuid: string,
    upstreamModelName: string,
    patch: Partial<ModelMapping['rows'][number]>
  ) {
    return source.map((mapping) => ({
      ...mapping,
      rows: mapping.rows.map((row) => (
        row.providerUuid === providerUuid && row.upstreamModelName === upstreamModelName
          ? { ...row, ...patch }
          : row
      ))
    }));
  }

  async function loadProviderModels(providerUuid: string) {
    if (!providerUuid || loadingProviderModels[providerUuid]) return [];
    setLoadingProviderModels((current) => ({ ...current, [providerUuid]: true }));
    try {
      const response = await adminApi.providerModels(providerUuid);
      if (!response.ok) return [];
      setProviders((current) => current.map((provider) => provider.uuid === providerUuid ? { ...provider, models: response.data.models } : provider));
      return response.data.models;
    } finally {
      setLoadingProviderModels((current) => ({ ...current, [providerUuid]: false }));
    }
  }

  async function applyProviderToRow(mappingId: string, rowId: string, provider: Provider) {
    const localModels = providerModels(provider);
    const firstLocalModel = localModels[0]?.name || '';
    const shouldFetchProviderModels = !hasApiLoadedModels(provider);
    updateRowById(mappingId, rowId, {
      providerUuid: provider.uuid,
      providerFamily: provider.family,
      providerCustomName: provider.customName,
      upstreamModelName: firstLocalModel
    });

    if (shouldFetchProviderModels) {
      const fetchedModels = await loadProviderModels(provider.uuid);
      updateRowById(mappingId, rowId, {
        upstreamModelName: fetchedModels[0]?.name || firstLocalModel
      });
    }
  }

  async function addRow(mapping: ModelMapping) {
    const provider = providers[0];
    const rowId = genId('row');
    const firstModel = providerModels(provider)[0]?.name || '';
    const shouldFetchProviderModels = Boolean(provider && !hasApiLoadedModels(provider));
    updateMapping(mapping.id, {
      rows: [...mapping.rows, {
        id: rowId,
        providerFamily: provider?.family || 'openai-custom',
        providerUuid: provider?.uuid || '',
        providerCustomName: provider?.customName || '',
        upstreamModelName: firstModel,
        health: 'unknown'
      }]
    });
    if (provider && shouldFetchProviderModels) {
      const fetchedModels = await loadProviderModels(provider.uuid);
      updateRowById(mapping.id, rowId, { upstreamModelName: fetchedModels[0]?.name || firstModel });
    }
  }

  async function checkRowModel(mappingId: string, rowId: string, persistOnSuccess?: boolean) {
    const mapping = mappingsRef.current.find((item) => item.id === mappingId);
    const row = mapping?.rows.find((item) => item.id === rowId);
    if (!row?.providerUuid || !row.upstreamModelName) return;
    const provider = providers.find((item) => item.uuid === row.providerUuid);
    if (provider && !provider.enabled) return;

    const shouldPersist = persistOnSuccess ?? rowIsPersisted(mappingId, rowId);
    setCheckingRows((current) => ({ ...current, [rowId]: true }));
    const loadingState = applyHealthPatchToAllMatchingRows(
      mappingsRef.current,
      row.providerUuid,
      row.upstreamModelName,
      { health: 'unknown' }
    );
    mappingsRef.current = loadingState;
    setMappings(loadingState);

    try {
      const response = await adminApi.checkModelHealth(row.providerUuid, row.upstreamModelName);
      if (!response.ok) return;
      setProviders((current) => {
        const currentByUuid = new Map(current.map((provider) => [provider.uuid, provider] as const));
        return response.data.pools
          .flatMap((pool) => pool.providers)
          .map((provider) => ({
            ...provider,
            models: currentByUuid.get(provider.uuid)?.models || [],
            manualModels: currentByUuid.get(provider.uuid)?.manualModels || provider.manualModels
          }));
      });
      const patch = {
        health: response.data.health,
        lastHealthStatus: response.data.status,
        lastHealthResponse: response.data.responseBody,
        lastHealthCheckedAt: response.data.checkedAt
      } satisfies Partial<ModelMapping['rows'][number]>;

      const nextUi = applyHealthPatchToAllMatchingRows(
        mappingsRef.current,
        row.providerUuid,
        row.upstreamModelName,
        patch
      );
      mappingsRef.current = nextUi;
      setMappings(nextUi);

      if (shouldPersist) {
        const nextPersisted = applyHealthPatchToAllMatchingRows(
          persistedMappingsRef.current,
          row.providerUuid,
          row.upstreamModelName,
          patch
        );
        const saved = await adminApi.saveModelMappings(nextPersisted);
        if (saved.ok) {
          persistedMappingsRef.current = saved.data;
        }
      }
    } finally {
      setCheckingRows((current) => ({ ...current, [rowId]: false }));
    }
  }

  async function checkModels(scope: 'all' | string) {
    const scopedRows = mappingsRef.current.flatMap((mapping) =>
      mapping.rows
        .filter((row) => scope === 'all' || mapping.id === scope)
        .map((row) => ({
          mappingId: mapping.id,
          rowId: row.id,
          providerUuid: row.providerUuid,
          upstreamModelName: row.upstreamModelName
        }))
    );

    const uniqueByProviderModel = new Map<string, { mappingId: string; rowId: string; providerUuid: string; upstreamModelName: string }>();
    for (const row of scopedRows) {
      if (!row.providerUuid || !row.upstreamModelName) continue;
      const key = `${row.providerUuid}::${row.upstreamModelName}`;
      if (!uniqueByProviderModel.has(key)) uniqueByProviderModel.set(key, row);
    }

    for (const row of uniqueByProviderModel.values()) {
      const persist = scope === 'all' || rowIsPersisted(row.mappingId, row.rowId);
      await checkRowModel(row.mappingId, row.rowId, persist);
    }
  }

  async function refreshProviders() {
    const pools = await adminApi.providerPools();
    if (!pools.ok) {
      pushToast({ tone: 'error', title: 'Failed to refresh providers', message: pools.error.message });
      return;
    }
    const nextProviders = pools.data.flatMap((pool) => pool.providers);
    setProviders(nextProviders);
    const providerIdsToLoad = Array.from(
      new Set(
        mappingsRef.current
          .flatMap((mapping) => mapping.rows)
          .map((row) => row.providerUuid)
          .filter(Boolean)
      )
    );
    for (const providerUuid of providerIdsToLoad) {
      attemptedProviderLoads.current.delete(providerUuid);
      await loadProviderModels(providerUuid);
    }
    pushToast({ tone: 'success', title: 'Providers refreshed' });
  }

  function moveRow(mapping: ModelMapping, fromRowId: string, toRowId: string) {
    if (fromRowId === toRowId) return;
    const fromIndex = mapping.rows.findIndex((row) => row.id === fromRowId);
    const toIndex = mapping.rows.findIndex((row) => row.id === toRowId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextRows = [...mapping.rows];
    const [moved] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, moved);
    updateMapping(mapping.id, { rows: nextRows });
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <AlertToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><h1 style={{ font: '600 22px/28px Inter', color: '#191c1e', margin: '0 0 4px' }}>Model Mappings</h1><p style={{ font: '400 13px/18px Inter', color: '#737781', margin: 0 }}>Map custom model names to provider instances with ordered or round-robin routing.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="verified" onClick={() => void checkModels('all')}>Check all models</Button>
          <Button variant="secondary" icon="refresh" onClick={() => void refreshProviders()}>Refresh</Button>
          <Button icon="add" onClick={() => setMappings((current) => [...current, { id: genId('mapping'), publicModelName: 'ai-new-model', strategy: 'round_robin', rows: [] }])}>Add Mapping</Button>
        </div>
      </div>
      {mappings.map((mapping) => (
        <div key={mapping.id} style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, overflow: 'visible', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <div style={{ padding: '18px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}><label style={{ display: 'block', font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 6 }}>Custom Model Name</label><input value={mapping.publicModelName} onChange={(event) => updateMapping(mapping.id, { publicModelName: event.target.value })} style={{ width: '100%', background: '#fff', border: '1px solid #c2c6d1', borderRadius: 5, color: '#191c1e', font: '400 14px/20px Inter', padding: '8px 12px', outline: 'none' }} /></div>
              <div style={{ width: 180 }}><label style={{ display: 'block', font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#737781', marginBottom: 6 }}>Routing Strategy</label><LightSelect value={mapping.strategy} onChange={(value) => updateMapping(mapping.id, { strategy: value as RoutingStrategy })} options={strategyOptions} /></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mappingRowGridTemplate, gap: 8, padding: '6px 16px', background: '#f7f9fb', borderTop: '1px solid #e6e8ea', borderBottom: '1px solid #e6e8ea' }}><div /><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa0ab' }}>Provider Instance</span><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa0ab' }}>Model Name</span><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa0ab', textAlign: 'right' }}>Actions</span></div>
          {mapping.rows.map((row, index) => {
            const selectedProvider = providers.find((provider) => provider.uuid === row.providerUuid);
            const providerDisabled = Boolean(selectedProvider && !selectedProvider.enabled);
            const selectedModelOptions = modelOptions(selectedProvider, row.upstreamModelName);
            const selectedModelValue = selectedModelOptions.some((option) => option.value === row.upstreamModelName) ? row.upstreamModelName : '';
            const healthDotColor = providerDisabled ? '#9aa0ab' : row.health === 'healthy' ? '#10b981' : row.health === 'unhealthy' || row.health === 'failed' ? '#ef4444' : '#f59e0b';
            return (
              <div
                key={row.id}
                onDragOver={(event) => {
                  if (dragging?.mappingId === mapping.id && dragging.rowId !== row.id) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging?.mappingId === mapping.id) {
                    moveRow(mapping, dragging.rowId, row.id);
                  }
                  setDragging(null);
                }}
                style={{ display: 'grid', gridTemplateColumns: mappingRowGridTemplate, alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f2f4', background: dragging?.rowId === row.id ? '#f2f7ff' : providerDisabled ? '#f7f9fb' : '#fff', transition: 'background .2s ease', opacity: providerDisabled ? 0.72 : 1 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button disabled={index === 0} onClick={() => updateMapping(mapping.id, { rows: mapping.rows.map((item, i, arr) => i === index - 1 ? row : i === index ? arr[index - 1] : item) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0ab' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_drop_up</span></button>
                  <span
                    className="material-symbols-outlined"
                    draggable
                    onDragStart={() => setDragging({ mappingId: mapping.id, rowId: row.id })}
                    onDragEnd={() => setDragging(null)}
                    style={{ fontSize: 16, color: '#c2c6d1', cursor: 'grab', userSelect: 'none' }}
                    title="Drag row"
                  >
                    drag_indicator
                  </span>
                  <button disabled={index === mapping.rows.length - 1} onClick={() => updateMapping(mapping.id, { rows: mapping.rows.map((item, i, arr) => i === index ? arr[index + 1] : i === index + 1 ? row : item) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0ab' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_drop_down</span></button>
                </div>
                <SearchableSelect value={row.providerUuid} options={providerOptions.length ? providerOptions : [{ value: '', label: 'No providers available' }]} disabled={!providerOptions.length || providerDisabled} placeholder="Search providers" onChange={(uuid) => { const provider = providers.find((item) => item.uuid === uuid); if (provider) applyProviderToRow(mapping.id, row.id, provider); }} />
                <SearchableSelect value={selectedModelValue} options={selectedModelOptions} disabled={providerDisabled || !selectedProvider || !selectedModelOptions.some((option) => option.value)} placeholder="Search models" onChange={(value) => updateRow(mapping, row.id, { upstreamModelName: value })} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <Button variant="ghost" icon="info" title="Last health response" onClick={() => setHealthInfoRow(row)} />
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: healthDotColor, display: 'inline-block', flexShrink: 0 }} />
                  <button
                    type="button"
                    title={providerDisabled ? 'Provider is disabled' : 'Check health'}
                    onClick={() => checkRowModel(mapping.id, row.id)}
                    disabled={checkingRows[row.id] || providerDisabled}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: providerDisabled ? '#9aa0ab' : '#424750',
                      width: 34,
                      height: 34,
                      borderRadius: 4,
                      cursor: checkingRows[row.id] || providerDisabled ? 'not-allowed' : 'pointer',
                      opacity: checkingRows[row.id] || providerDisabled ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 18,
                        animation: checkingRows[row.id] ? 'spin 0.8s linear infinite' : 'none'
                      }}
                    >
                      refresh
                    </span>
                  </button>
                  <Button variant="danger" icon="delete" title="Delete row" onClick={() => updateMapping(mapping.id, { rows: mapping.rows.filter((item) => item.id !== row.id) })} />
                </div>
              </div>
            );
          })}
          <div style={{ padding: '10px 16px', background: '#fff' }}><button onClick={() => addRow(mapping)} style={{ width: '100%', background: 'transparent', border: '1px dashed #c2c6d1', borderRadius: 5, color: '#737781', font: '500 13px/18px Inter', padding: '9px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Add Row</button></div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e6e8ea', background: '#f7f9fb', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon="verified" onClick={() => void checkModels(mapping.id)}>Check card models</Button>
            <Button
              icon="save"
              onClick={async () => {
                const saved = await adminApi.saveModelMappings(mappingsRef.current);
                if (saved.ok) {
                  setMappings(saved.data);
                  mappingsRef.current = saved.data;
                  persistedMappingsRef.current = saved.data;
                  pushToast({ tone: 'success', title: 'Model mapping saved' });
                } else {
                  pushToast({ tone: 'error', title: 'Failed to save model mapping', message: saved.error.message });
                }
              }}
            >
              Save Mapping
            </Button>
            <Button variant="danger" icon="delete" onClick={() => setDeleteMappingConfirm({ id: mapping.id, publicModelName: mapping.publicModelName })}>Delete Mapping</Button>
          </div>
        </div>
      ))}
      {deleteMappingConfirm && (
        <Modal title="Delete Model Mapping" onClose={() => setDeleteMappingConfirm(null)}>
          <p style={{ font: '400 14px/22px Inter', color: '#424750' }}>
            Delete model mapping card <strong style={{ color: '#191c1e' }}>{deleteMappingConfirm.publicModelName || 'Unnamed Mapping'}</strong>? This removes it from the page until you save changes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="ghost" onClick={() => setDeleteMappingConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              icon="delete"
              onClick={() => {
                setMappings((current) => current.filter((item) => item.id !== deleteMappingConfirm.id));
                setDeleteMappingConfirm(null);
                pushToast({ tone: 'warning', title: 'Model mapping card removed' });
              }}
            >
              Delete Mapping
            </Button>
          </div>
        </Modal>
      )}
      {healthInfoRow && (
        <Modal title="Model Health Info" onClose={() => setHealthInfoRow(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ font: '500 12px/16px Inter', color: '#424750' }}>Model: <span style={{ color: '#191c1e' }}>{healthInfoRow.upstreamModelName || 'N/A'}</span></div>
            <div style={{ font: '500 12px/16px Inter', color: '#424750' }}>Last Check: <span style={{ color: '#191c1e' }}>{healthInfoRow.lastHealthCheckedAt || 'Never'}</span></div>
            <div style={{ font: '500 12px/16px Inter', color: '#424750' }}>Status: <span style={{ color: '#191c1e' }}>{healthInfoRow.lastHealthStatus ?? 'N/A'}</span></div>
            <pre style={{ margin: 0, background: '#f7f9fb', border: '1px solid #c2c6d1', borderRadius: 4, padding: '12px 14px', fontFamily: 'Space Grotesk', fontSize: 12, color: '#191c1e', lineHeight: 1.6, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{healthInfoRow.lastHealthResponse || 'No health response captured yet.'}</pre>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" onClick={() => setHealthInfoRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CredentialFilesPage() {
  const [files, setFiles] = useState<CredentialFile[]>([]);
  const [viewFile, setViewFile] = useState<CredentialFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CredentialFile | null>(null);

  useEffect(() => {
    adminApi.credentialFiles().then((response) => response.ok && setFiles(response.data));
  }, []);

  function download(name: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cols = [
    { key: 'name', label: 'File', render: (file: CredentialFile) => <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0f457c', flexShrink: 0 }}>description</span><span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#191c1e' }}>{file.name}</span></span><span style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: '#737781', paddingLeft: 26, letterSpacing: '.02em' }}>{file.path}</span></span> },
    { key: 'added', label: 'Added', mono: true },
    { key: 'updated', label: 'Last Updated', mono: true },
    { key: 'actions', label: 'Actions', render: (file: CredentialFile) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Button variant="ghost" icon="visibility" title="View" onClick={() => setViewFile(file)} /><Button variant="ghost" icon="download" title="Download" onClick={() => download(file.name, file.content)} /><Button variant="danger" icon="delete" title="Delete" onClick={() => setDeleteConfirm(file)} /></span> }
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <PageTitle actions={<Button variant="secondary" icon="folder_zip" onClick={() => download('config.zip.txt', files.map((file) => `--- ${file.path} ---\n${file.content}`).join('\n\n'))}>Download All</Button>}>Credential Files</PageTitle>
      <div className="desktop-only-table"><DataTable columns={cols} rows={files} /></div>
      <div className="mobile-only-cards" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
        {files.map((file) => <div key={file.name} style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><strong style={{ fontFamily: 'Space Grotesk' }}>{file.name}</strong><span style={{ font: '400 12px/16px "Space Grotesk"', color: '#737781' }}>{file.path}</span><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Button variant="ghost" icon="visibility" onClick={() => setViewFile(file)}>View</Button><Button variant="ghost" icon="download" onClick={() => download(file.name, file.content)}>Download</Button><Button variant="danger" icon="delete" onClick={() => setDeleteConfirm(file)}>Delete</Button></div></div>)}
      </div>
      {viewFile && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(25,28,30,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewFile(null);
          }}
        >
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #c2c6d1', boxShadow: '0 8px 32px rgba(15,23,42,.14)', width: 'min(96vw, 1600px)', height: 'min(92vh, 1100px)', display: 'flex', flexDirection: 'column', animation: 'fadeInUp .18s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e6e8ea' }}>
              <div>
                <div style={{ font: '600 16px/22px Inter', color: '#191c1e' }}>{viewFile.name}</div>
                <div style={{ font: '400 12px/18px "Space Grotesk"', color: '#737781' }}>{viewFile.path}</div>
              </div>
              <button type="button" aria-label="Close modal" onClick={() => setViewFile(null)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#737781', display: 'inline-flex', padding: 4, borderRadius: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
              <pre style={{ margin: 0, background: '#f7f9fb', border: '1px solid #c2c6d1', borderRadius: 4, padding: '14px 16px', fontFamily: 'Space Grotesk', fontSize: 12, color: '#191c1e', lineHeight: 1.7, whiteSpace: 'pre-wrap', minHeight: '100%' }}>{viewFile.content}</pre>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e6e8ea' }}>
              <Button variant="secondary" icon="download" onClick={() => download(viewFile.name, viewFile.content)}>Download</Button>
              <Button variant="ghost" onClick={() => setViewFile(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && <Modal title="Delete File" onClose={() => setDeleteConfirm(null)}><p style={{ font: '400 14px/22px Inter', color: '#424750' }}>Are you sure you want to delete <strong style={{ fontFamily: 'Space Grotesk', color: '#191c1e' }}>{deleteConfirm.name}</strong>? This action cannot be undone.</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}><Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button><Button variant="danger" icon="delete" onClick={() => { setFiles((current) => current.filter((file) => file.name !== deleteConfirm.name)); adminApi.deleteCredentialFile(deleteConfirm.name); setDeleteConfirm(null); }}>Delete</Button></div></Modal>}
    </div>
  );
}

export function RealtimeLogsPage() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [unmasked, setUnmasked] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    adminApi.logsToday().then((response) => response.ok && setLogs(response.data));
    setUnmasked(sessionStorage.getItem('aglias_logs_unmask') === '1');
  }, []);

  useEffect(() => {
    sessionStorage.setItem('aglias_logs_unmask', unmasked ? '1' : '0');
  }, [unmasked]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      adminApi.logsToday().then((response) => response.ok && setLogs(response.data));
    }, 5000);
    return () => window.clearInterval(id);
  }, [paused]);

  function handleDownload() {
    const text = logs.map((log) => `${log.t}  ${log.lvl.padEnd(5)}  ${log.msg}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lvlStyle = {
    INFO: { color: '#1d6fa4', background: '#e8f3fb', border: '1px solid #bee3f8' },
    WARN: { color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d' },
    ERROR: { color: '#991b1b', background: '#fff5f5', border: '1px solid #fca5a5' }
  };

  function parseEncodedLogBodies(message: string) {
    const headersMatch = message.match(/\srequestHeadersEncoded=([^ ]+)/);
    const requestMatch = message.match(/\srequestBodyEncoded=([^ ]+)/);
    const responseMatch = message.match(/\sresponseBodyEncoded=([^ ]+)/);
    const cleanMessage = message
      .replace(/\srequestHeadersEncoded=[^ ]+/, '')
      .replace(/\srequestBodyEncoded=[^ ]+/, '')
      .replace(/\sresponseBodyEncoded=[^ ]+/, '')
      .trim();
    const decode = (value?: string) => {
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    };
    return {
      message: cleanMessage,
      requestHeaders: decode(headersMatch?.[1]),
      requestBody: decode(requestMatch?.[1]),
      responseBody: decode(responseMatch?.[1])
    };
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><h1 style={{ font: '600 22px/28px Inter', color: '#191c1e', margin: '0 0 4px' }}>Real-time Logs</h1><p style={{ font: '400 13px/18px Inter', color: '#737781', margin: 0 }}>Live stream of routing, upstream, health, and error events.</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={unmasked ? 'visibility_off' : 'visibility'} onClick={() => setUnmasked((value) => !value)}>{unmasked ? 'Mask' : 'Unmask'}</Button>
          <Button variant="secondary" icon={paused ? 'play_arrow' : 'pause'} onClick={() => setPaused((value) => !value)}>{paused ? 'Resume' : 'Pause'}</Button>
          <Button variant="secondary" icon="delete_sweep" onClick={() => setClearConfirm(true)}>Clear</Button>
          <Button variant="secondary" icon="download" onClick={handleDownload}>Download</Button>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #c2c6d1', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 68px 1fr', gap: 0, padding: '6px 16px', background: '#f7f9fb', borderBottom: '1px solid #e6e8ea' }}><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa0ab' }}>Timestamp</span><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa0ab' }}>Level</span><span style={{ font: '500 11px/16px "Space Grotesk"', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa0ab' }}>Message</span></div>
        {logs.length === 0 ? <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9aa0ab', font: '400 13px/18px Inter' }}>No log entries. Waiting for events...</div> : logs.map((log, index) => {
          const parsed = parseEncodedLogBodies(log.msg);
          const rowKey = `${log.t}-${index}`;
          const expanded = expandedRows[rowKey] || false;
          return (
            <div key={rowKey} style={{ display: 'grid', gridTemplateColumns: '130px 68px minmax(0,1fr)', gap: 0, padding: '9px 16px', borderBottom: index < logs.length - 1 ? '1px solid #f0f2f4' : 'none', background: index % 2 === 0 ? '#fff' : '#fafbfc' }}>
              <span style={{ font: '400 12px/20px "Space Grotesk", ui-monospace, monospace', color: '#737781' }}>{log.t}</span>
              <span><span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, font: '600 11px/18px "Space Grotesk"', letterSpacing: '.04em', ...lvlStyle[log.lvl] }}>{log.lvl}</span></span>
              <span style={{ font: '400 13px/20px "Space Grotesk", ui-monospace, monospace', color: '#191c1e', overflowWrap: 'anywhere' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <span>{parsed.message}</span>
                  <button
                    type="button"
                    onClick={() => setExpandedRows((current) => ({ ...current, [rowKey]: !expanded }))}
                    style={{ border: '1px solid #c2c6d1', background: '#fff', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    title="Toggle details"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0f457c' }}>{expanded ? 'expand_less' : 'expand_more'}</span>
                  </button>
                </div>
                {expanded && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ font: '600 12px/16px Inter', color: '#0f457c' }}>Request headers</div>
                      <pre style={{ margin: '4px 0 0', padding: '10px 12px', borderRadius: 4, border: '1px solid #d6d9de', background: '#f7f9fb', whiteSpace: 'pre-wrap' }}>{parsed.requestHeaders ? (unmasked ? parsed.requestHeaders : '[masked]') : 'No request headers captured.'}</pre>
                    </div>
                    <div>
                      <div style={{ font: '600 12px/16px Inter', color: '#0f457c' }}>Request body</div>
                      <pre style={{ margin: '4px 0 0', padding: '10px 12px', borderRadius: 4, border: '1px solid #d6d9de', background: '#f7f9fb', whiteSpace: 'pre-wrap' }}>{parsed.requestBody ? (unmasked ? parsed.requestBody : '[masked]') : 'No request body captured.'}</pre>
                    </div>
                    <div>
                      <div style={{ font: '600 12px/16px Inter', color: '#0f457c' }}>Response body</div>
                      <pre style={{ margin: '4px 0 0', padding: '10px 12px', borderRadius: 4, border: '1px solid #d6d9de', background: '#f7f9fb', whiteSpace: 'pre-wrap' }}>{parsed.responseBody ? (unmasked ? parsed.responseBody : '[masked]') : 'No response body captured.'}</pre>
                    </div>
                    {!unmasked && <div style={{ font: '400 12px/16px Inter', color: '#737781' }}>Click "Unmask" to reveal captured payload details.</div>}
                  </div>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {clearConfirm && (
        <Modal title="Clear Logs" onClose={() => setClearConfirm(false)}>
          <p style={{ font: '400 14px/22px Inter', color: '#424750' }}>
            Clear all currently loaded log entries from this screen?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="ghost" onClick={() => setClearConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              icon="delete_sweep"
              onClick={() => {
                setLogs([]);
                setExpandedRows({});
                setClearConfirm(false);
              }}
            >
              Clear Logs
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
