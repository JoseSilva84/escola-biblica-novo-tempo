'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  ArrowRight,
  BadgePlus,
  Bell,
  Building2,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Church,
  ClipboardList,
  Crown,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  UsersRound,
  WandSparkles,
  X
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import DashboardClient from './DashboardClient';

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500';
const primaryButtonClass = 'primary-button-glow group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_52%,#0f172a_100%)] px-4 text-sm font-bold text-white shadow-[0_18px_46px_rgba(37,99,235,0.34)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_24px_70px_rgba(37,99,235,0.30)] focus:outline-none focus:ring-4 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-70';
const ghostButtonClass = 'group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-900/10 bg-white/60 px-4 text-sm font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_28px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-slate-900/20 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-400/15';
const panelClass = 'premium-panel rounded-2xl border border-white/[0.08] bg-slate-950/60 shadow-[0_28px_90px_rgba(0,0,0,0.34)] ring-1 ring-white/[0.035] backdrop-blur-2xl';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
const GEOCODE_CHURCHES_VALUE = '__churches__';
const adminNavItems = [
  ['admin', 'Dashboard', LayoutDashboard],
  ['associations', 'Associa\u00e7\u00f5es', Building2],
  ['leads', 'Leads', ClipboardList],
  ['campaigns', 'Campanhas', Radio],
  ['automations', 'WhatsApp', MessageCircle],
  ['conversations', 'Conversas', MessageCircle],
  ['ai-agent', 'Agente IA', WandSparkles],
  ['reports', 'Relat\u00f3rios', PieChart],
  ['settings', 'Configura\u00e7\u00f5es', Settings]
];
const associationNavItems = [
  ['associations', 'Associa\u00e7\u00e3o', Building2],
  ['leads', 'Leads', ClipboardList],
  ['campaigns', 'Campanhas', Radio],
  ['automations', 'WhatsApp', MessageCircle],
  ['reports', 'Relat\u00f3rios', PieChart]
];
const crmPriorityLabels = {
  Hot: 'Quente',
  Warm: 'Potencial',
  Cool: 'Morno',
  Cold: 'Frio'
};

function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('sevenflow_token') : '';
  return fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...options,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

function isAdminUser(user) {
  return user?.role === 'ADMIN_GERAL'
    && !user?.associationId
    && !user?.associationName
    && !/associa/i.test(String(user?.name || ''));
}

function navigationItemsForUser(user) {
  return isAdminUser(user) ? adminNavItems : associationNavItems;
}

function defaultViewForUser(user) {
  return isAdminUser(user) ? 'admin' : 'associations';
}

function accessLabelForUser(user) {
  if (isAdminUser(user)) return 'Admin Geral';
  return user?.associationName || user?.name || 'Associacao';
}

function allowedViewsForUser(user) {
  const menuViews = navigationItemsForUser(user).map(([id]) => id);
  return new Set(isAdminUser(user)
    ? [...menuViews, 'association', 'details', 'district-interest', 'dataset-history', 'geolocation', 'general-admin', 'users']
    : [...menuViews, 'association', 'details', 'district-interest']);
}

function canOpenView(user, view) {
  return allowedViewsForUser(user).has(view);
}

function associationSlugForUser(user = {}) {
  user = user || {};
  return String(user.associationSlug || user.associationName || user.name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/associacao/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'paulistana';
}

function slugifyDistrictName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function AppToaster({ theme = 'light' }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Toaster
      closeButton
      expand
      offset="84px"
      position="top-right"
      richColors
      style={{ position: 'fixed', zIndex: 2147483647 }}
      theme={theme}
      toastOptions={{
        style: { zIndex: 2147483647 },
        classNames: {
          toast: 'leads-toast',
          title: 'leads-toast-title',
          description: 'leads-toast-description',
          actionButton: 'leads-toast-action',
          closeButton: 'leads-toast-close'
        }
      }}
    />,
    document.body
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatDatasetDate(value) {
  if (!value) return 'sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(date);
}

function formatBrDateOnly(value) {
  const text = String(value || '').trim();
  return /^\d{2}\/\d{2}\/\d{4}$/.test(text) ? text : 'data nao informada';
}

function formatElapsedContactTime(days) {
  const totalDays = Number(days);
  if (!Number.isFinite(totalDays)) return 'tempo nao informado';
  if (totalDays < 30) return `${formatNumber(totalDays)} dia${totalDays === 1 ? '' : 's'}`;
  if (totalDays < 365) {
    const months = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;
    return remainingDays
      ? `${formatNumber(months)} mes${months === 1 ? '' : 'es'} e ${formatNumber(remainingDays)} dia${remainingDays === 1 ? '' : 's'}`
      : `${formatNumber(months)} mes${months === 1 ? '' : 'es'}`;
  }
  const years = Math.floor(totalDays / 365);
  const remainingMonths = Math.floor((totalDays % 365) / 30);
  return remainingMonths
    ? `${formatNumber(years)} ano${years === 1 ? '' : 's'} e ${formatNumber(remainingMonths)} mes${remainingMonths === 1 ? '' : 'es'}`
    : `${formatNumber(years)} ano${years === 1 ? '' : 's'}`;
}

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatMlDelta(summary, key, fallbackValue) {
  const delta = summary?.[key] || {};
  const before = delta.antes;
  const after = delta.depois;
  const diff = delta.diferenca;
  if (hasNumber(before) || hasNumber(after) || hasNumber(diff)) {
    return `${hasNumber(before) ? formatNumber(before) : 'sem base anterior'} para ${hasNumber(after) ? formatNumber(after) : 'sem dado'} (${hasNumber(diff) ? formatNumber(diff) : 'sem diferenca'})`;
  }
  return hasNumber(fallbackValue) ? `total ${formatNumber(fallbackValue)}` : 'sem dado salvo';
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function contactInitials(name, phone) {
  const cleanName = String(name || '').trim();
  if (cleanName && !/^\d+$/.test(cleanName)) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase() || 'NT';
  }
  const digits = phoneDigits(phone);
  return digits ? digits.slice(-2) : 'NT';
}

function ContactAvatar({ name, phone, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'h-16 w-16 text-lg' : 'h-12 w-12 text-sm';
  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center rounded-2xl border border-white/70 bg-[linear-gradient(135deg,#e0f2fe_0%,#2563eb_48%,#0f172a_100%)] font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.20)] ring-1 ring-blue-200/70`}>
      {contactInitials(name, phone)}
    </span>
  );
}

function deliveryState(message = {}, deliveredByReply = false) {
  if (deliveredByReply) {
    return { label: 'Entregue', Icon: CheckCheck, className: 'text-blue-100' };
  }
  const raw = `${message.providerStatus || ''} ${message.metadata?.status || ''} ${message.metadata?.ack || ''}`.toLowerCase();
  if (raw.includes('read') || raw.includes('played') || raw.includes('ack:3') || raw.includes('ack 3') || raw.trim() === '3') {
    return { label: 'Lida', Icon: CheckCheck, className: 'text-sky-200' };
  }
  if (raw.includes('delivered') || raw.includes('delivery') || raw.includes('delivered_by_reply') || raw.includes('ack:2') || raw.includes('ack 2') || raw.trim() === '2' || message.metadata?.deliveredByReply) {
    return { label: 'Entregue', Icon: CheckCheck, className: 'text-blue-100' };
  }
  return { label: 'Enviada, aguardando entrega', Icon: Check, className: 'text-blue-100' };
}

function DeliveryReceipt({ message, deliveredByReply = false }) {
  const state = deliveryState(message, deliveredByReply);
  const Icon = state.Icon;
  return (
    <span className={`inline-flex items-center gap-1 ${state.className}`} title={state.label}>
      <Icon size={15} strokeWidth={2.8} />
      <span className="sr-only">{state.label}</span>
    </span>
  );
}

function buildAssociationData(records) {
  const total = records.length;
  const phone = records.filter((row) => row.t).length;
  const hot = records.filter((row) => row.p === 'Hot').length;
  const vip = records.filter((row) => row.v).length;
  const studies = records.filter((row) => row.e).length;
  const districts = new Set(records.map((row) => row.d)).size;

  const topDistricts = Array.from(
    records.reduce((map, row) => {
      const current = map.get(row.d) || { name: row.d, interessados: 0, quentes: 0 };
      current.interessados += 1;
      current.quentes += row.p === 'Hot' ? 1 : 0;
      map.set(row.d, current);
      return map;
    }, new Map()).values()
  )
    .sort((a, b) => b.interessados - a.interessados)
    .slice(0, 6);

  return {
    total,
    phone,
    hot,
    vip,
    studies,
    districts,
    topDistricts,
    conversion: pct(studies, total),
    campaignTrend: [
      { etapa: 'Base', leads: total },
      { etapa: 'WhatsApp', leads: phone },
      { etapa: 'Quentes', leads: hot },
      { etapa: 'VIPs', leads: vip },
      { etapa: 'Estudos', leads: studies }
    ]
  };
}

function buildInitialAssociations(records) {
  const data = buildAssociationData(records);
  return [
    {
      id: 'paulistana',
      name: 'Associação Paulistana',
      region: 'São Paulo Capital',
      status: 'Ativa',
      campaigns: 0,
      leads: data.total,
      hot: data.hot,
      studies: data.studies,
      districts: data.districts,
      conversion: data.conversion,
      featured: true
    }

  ];
}

function buildAdminUsers() {
  return [];
}

function buildAdminCampaigns() {
  return [];
}

function scopedAssociationsForUser(associations, user) {
  if (isAdminUser(user)) return associations;
  const slug = associationSlugForUser(user);
  const association = associations.find((item) => item.id === slug)
    || associations.find((item) => item.name === user?.associationName)
    || {
      id: slug,
      name: user?.associationName || user?.name || 'Associacao',
      region: 'Territorio da associacao',
      status: 'Ativa',
      campaigns: 0,
      leads: 0,
      hot: 0,
      studies: 0,
      districts: 0,
      conversion: 0,
      featured: true
    };
  return [association];
}

function scopedRecordsForUser(records, user) {
  if (isAdminUser(user)) return records;
  return associationSlugForUser(user) === 'paulistana' ? records : [];
}

function BibleStudyAnimation() {
  return (
    <div className="bible-study-scene" aria-label="Duas pessoas conversando em um estudo biblico" role="img">
      <div className="study-window">
        <div className="window-sun" />
        <div className="window-line window-line-one" />
        <div className="window-line window-line-two" />
      </div>
      <div className="study-table">
        <div className="bible-book">
          <div className="bible-page bible-page-left">
            <span />
            <span />
            <span />
          </div>
          <div className="bible-center" />
          <div className="bible-page bible-page-right">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="study-light" />
      </div>
      <div className="teacher-person">
        <div className="person-head" />
        <div className="person-body" />
        <div className="person-arm teacher-arm" />
      </div>
      <div className="student-person">
        <div className="person-head" />
        <div className="person-body" />
        <div className="person-arm student-arm" />
      </div>
      <div className="speech-bubble teacher-bubble">
        <span />
        <span />
      </div>
      <div className="speech-bubble student-bubble">
        <span />
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [splashState, setSplashState] = useState('visible');

  useEffect(() => {
    const timer1 = setTimeout(() => setSplashState('fading'), 1500);
    const timer2 = setTimeout(() => setSplashState('hidden'), 2200);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);

    const form = new FormData(event.currentTarget);
    let response;

    try {
      [response] = await Promise.all([
        apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.get('email'),
            password: form.get('password')
          })
        }),
        new Promise((resolve) => setTimeout(resolve, 900))
      ]);
    } catch {
      setLoading(false);
      toast.error('Nao foi possivel conectar', {
        description: 'A API nao respondeu. Verifique a conexao e tente novamente.'
      });
      return;
    }

    if (!response.ok) {
      setLoading(false);
      toast.error('Não foi possível entrar', {
        description: 'Confira o email e a senha informados.'
      });
      return;
    }

    const loginPayload = await response.json();
    if (loginPayload.token) {
      window.localStorage.setItem('sevenflow_token', loginPayload.token);
    }

    try {
      await onLogin(loginPayload.user || loginPayload);
      setLoading(false);
      toast.success('Bem-vindo ao Amigos NT', {
        description: 'Dashboard admin carregado com sucesso.'
      });
    } catch {
      window.localStorage.removeItem('sevenflow_token');
      setLoading(false);
      toast.error('Backend nao foi lido', {
        description: 'A autenticacao funcionou, mas os dados do dashboard nao foram carregados.'
      });
    }
  }

  return (
    <main className="silver-stage app-light grid min-h-screen place-items-center overflow-hidden px-5 py-10 text-slate-100">
      <AppToaster />
      {loading ? (
        <div className="login-loading-overlay" role="status" aria-live="polite">
          <div className="login-loading-card">
            <div className="login-loading-spinner">
              <Lock size={24} />
            </div>
            <strong>Entrando no sistema</strong>
            <span>Aguarde um instante...</span>
          </div>
        </div>
      ) : null}
      
      {splashState !== 'hidden' ? (
        <div className={`!fixed inset-0 z-[100] flex items-center justify-center bg-slate-50 transition-opacity duration-700 ease-in-out ${splashState === 'fading' ? 'opacity-0' : 'opacity-100'}`}>
          <img src="/logo.png" alt="Logo Novo Tempo" className="h-64 object-contain splash-logo-anim" />
        </div>
      ) : null}

      <div className={`relative grid w-full max-w-6xl gap-4 ${splashState === 'visible' ? 'opacity-0' : 'stagger-in'}`}>
        <section className="grid grid-cols-[1.1fr_0.9fr] gap-5 max-lg:grid-cols-1">
        <div className={`${panelClass} flex min-h-[34rem] flex-col justify-between p-8 max-sm:p-5`}>
          <div>

            <h1 className="silver-title max-w-2xl text-6xl font-black leading-tight tracking-normal max-md:text-4xl text-center">
              Amigos NT
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400 text-center">
              Administre Campanhas, Automações e Leads da Novo Tempo.
            </p>
          </div>

          <BibleStudyAnimation />

          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {[
              ['Associações', 'Gestão por território', Building2],
              ['Campanhas', 'Funis independentes', Radio],
              ['WhatsApp', 'Aquecimento inteligente', MessageCircle]
            ].map(([title, detail, Icon], index) => (
              <div className="interactive-card login-feature-card rounded-xl border border-white/[0.07] bg-slate-950/50 p-4" key={title} style={{ '--card-delay': `${index * 0.55}s` }}>
                <Icon className="mb-3 text-slate-200 drop-shadow-[0_0_16px_rgba(226,232,240,0.20)]" size={22} />
                <strong className="block text-sm text-slate-100">{title}</strong>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        <form className={`${panelClass} grid content-center gap-5 p-8 max-sm:p-5`} onSubmit={submitLogin}>
          <div className="flex flex-col items-center justify-center">
            <img src="/logo.png" alt="Novo Tempo" className="animate-logo-float mb-4 h-28 object-contain drop-shadow-md" />
            <h2 className="mt-2 text-2xl font-black text-slate-50 text-center">Acesso aos Amigos NT</h2>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-300 text-center">
            Email
            <input autoComplete="email" className="h-12 rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 text-slate-100 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10 text-center" name="email" type="email" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-300 text-center">
            Senha
            <span className="password-field">
              <input autoComplete="current-password" className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 pr-12 text-center text-slate-100 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" name="password" type={showPassword ? 'text' : 'password'} />
              <button
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          <button className={primaryButtonClass} disabled={loading} type="submit">
            <Lock size={18} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        </section>

        <p className="mt-8 text-center text-[11px] font-medium text-slate-500/85">
          Sistema desenvolvido por{' '}
          <span className="font-bold text-slate-700">@Seven Flow Tecnologia</span>
        </p>
      </div>
    </main>
  );
}

function Sidebar({ compact, current, onNavigate, onLogout, onToggleCompact, user }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const items = navigationItemsForUser(user);

  const bottomNavItems = isAdminUser(user)
    ? [
      ['admin', 'Dashboard', LayoutDashboard],
      ['leads', 'Leads', ClipboardList]
    ]
    : [
      ['associations', 'Associa\u00e7\u00f5es', Building2],
      ['leads', 'Leads', ClipboardList]
    ];

  return (
    <>
      {/* --- Desktop Sidebar --- */}
      <aside className={`sidebar-shell sticky top-4 z-40 hidden h-[calc(100vh-2rem)] min-h-0 shrink-0 flex-col rounded-[1.75rem] border p-4 text-slate-100 backdrop-blur-2xl transition-all duration-300 lg:flex ${compact ? 'w-24' : 'w-72'}`}>
        <div className={`mb-5 flex shrink-0 items-center gap-3 ${compact ? 'justify-center' : ''}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(226,232,240,0.12)]">
            <img src="/novo-tempo.jpg" alt="Logo Novo Tempo" className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-normal" />
          </div>
          <div className={compact ? 'hidden' : 'block'}>
            <strong className="silver-title block text-xl font-black">Amigos NT</strong>
            <span className="text-xs font-bold text-slate-500">{accessLabelForUser(user)}</span>
          </div>
        </div>

        <button
          className="sidebar-toggle mb-4 inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border text-sm font-black transition duration-300"
          onClick={onToggleCompact}
          type="button"
        >
          {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className={compact ? 'hidden' : 'inline'}>Recolher menu</span>
        </button>

        <nav className="sidebar-nav-scroll grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1">
          {items.map(([id, label, Icon]) => (
            <button
              className={`sidebar-nav-item group flex h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-black transition-colors duration-200 ${compact ? 'justify-center' : ''} ${current === id ? 'nav-active' : 'nav-idle'}`}
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
              title={compact ? label : undefined}
            >
              <Icon size={19} />
              <span className={compact ? 'hidden' : 'inline'}>{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-3 grid shrink-0 gap-3 border-t border-slate-900/10 pt-3">
          <button className={`${ghostButtonClass} group h-10 transition-colors duration-200 ${compact ? 'px-0' : ''}`} onClick={onLogout} type="button" title={compact ? 'Sair' : undefined}>
            <LogOut size={18} />
            <span className={compact ? 'hidden' : 'inline'}>Sair</span>
          </button>
        </div>
      </aside>

      {/* --- Mobile Bottom Navigation --- */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-20 items-center justify-around border-t border-white/[0.07] bg-slate-950/80 pb-2 pt-2 backdrop-blur-2xl lg:hidden">
        {bottomNavItems.map(([id, label, Icon]) => (
          <button
            key={id}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-all ${current === id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => onNavigate(id)}
            type="button"
          >
            <Icon size={20} className={current === id ? 'scale-110' : ''} />
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
        
        <button
          className={`flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-all ${mobileMenuOpen ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
          onClick={() => setMobileMenuOpen(true)}
          type="button"
        >
          <Menu size={20} className={mobileMenuOpen ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold">Mais</span>
        </button>
      </nav>

      {/* --- Mobile Sidebar Drawer --- */}
      {/* Overlay */}
      <div 
        className={`fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      
      {/* Drawer */}
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-white/[0.07] bg-slate-900 p-4 shadow-2xl transition-transform duration-300 lg:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(226,232,240,0.12)]">
              <img src="/novo-tempo.jpg" alt="Logo Novo Tempo" className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-normal" />
            </div>
            <div>
              <strong className="silver-title block text-lg font-black">Amigos NT</strong>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="grid gap-2 overflow-y-auto pb-4">
          {items.map(([id, label, Icon]) => (
            <button
              className={`sidebar-nav-item group flex h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-black transition-all duration-300 ${current === id ? 'nav-active' : 'nav-idle'}`}
              key={id}
              onClick={() => {
                onNavigate(id);
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto grid gap-3 pt-4 border-t border-white/5">
          <button 
            className={`${ghostButtonClass} group transition-all duration-300`} 
            onClick={() => {
              onLogout();
              setMobileMenuOpen(false);
            }} 
            type="button"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'silver' }) {
  const tones = {
    silver: {
      card: 'color-panel color-panel-blue text-white',
      icon: 'text-white bg-white/18 border-white/30'
    },
    green: {
      card: 'color-panel color-panel-green text-white',
      icon: 'text-white bg-white/18 border-white/30'
    },
    orange: {
      card: 'color-panel color-panel-orange text-white',
      icon: 'text-white bg-white/18 border-white/30'
    },
    violet: {
      card: 'color-panel color-panel-violet text-white',
      icon: 'text-white bg-white/18 border-white/30'
    }
  };
  const toneStyle = tones[tone] || tones.silver;

  return (
    <article className={`${panelClass} interactive-card p-5 shadow-[0_20px_52px_rgba(15,23,42,0.16)] ${toneStyle.card}`}>
      <span className={`mb-5 grid h-12 w-12 place-items-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${toneStyle.icon}`}>
        <Icon size={22} />
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">{label}</span>
      <strong className="mt-2 block text-3xl font-extrabold text-white">{value}</strong>
      <span className="mt-2 block text-sm font-normal text-white/82">{detail}</span>
    </article>
  );
}

function whatsappHistoryForLead(lead) {
  const history = [];
  if (lead.desc && lead.desc !== 'N/I') {
    history.push({
      title: 'Conversa registrada',
      detail: lead.desc,
      tone: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-100'
    });
  }
  if (lead.c !== null && lead.c !== undefined) {
    history.push({
      title: 'Ultimo contato',
      detail: `Contato em ${formatBrDateOnly(lead.lastContactDate)}. Decorrido ate hoje: ${formatElapsedContactTime(lead.c)} (${formatNumber(lead.c)} dias).`,
      tone: 'bg-blue-500/10 border-blue-400/20 text-blue-100'
    });
  }
  if (lead.e) {
    history.push({
      title: 'Estudo em andamento',
      detail: 'O material aparece como em andamento e deve continuar no acompanhamento.',
      tone: 'bg-violet-500/10 border-violet-400/20 text-violet-100'
    });
  }
  if (!history.length) {
    history.push({
      title: 'Sem conversa importada',
      detail: 'Este lead ainda nao possui texto de conversa do WhatsApp nos dados carregados.',
      tone: 'bg-slate-500/10 border-slate-400/20 text-slate-200'
    });
  }
  return history;
}

function priorityBadgeClasses(priority) {
  const tones = {
    Hot: 'bg-orange-600 text-white border-orange-700 shadow-[0_10px_24px_rgba(234,88,12,0.25)]',
    Warm: 'bg-blue-600 text-white border-blue-700 shadow-[0_10px_24px_rgba(37,99,235,0.22)]',
    Cool: 'bg-slate-700 text-white border-slate-800 shadow-[0_10px_24px_rgba(51,65,85,0.18)]',
    Cold: 'bg-zinc-800 text-white border-zinc-900 shadow-[0_10px_24px_rgba(24,24,27,0.18)]'
  };
  return tones[priority] || tones.Cool;
}

function inboxPhone(item) {
  return item?.conversation?.phone || item?.tel || item?.sourceLead?.tel || item?.n || 'Numero nao informado';
}

function InboxConversationModal({ item, question, answer, onClose }) {
  if (!item) return null;

  const phone = inboxPhone(item);
  const messages = item.messages?.length
    ? item.messages
    : [
      {
        id: `${item.id}-imported`,
        direction: 'INBOUND',
        body: item.desc || item.status || 'Conversa importada sem texto detalhado.',
        createdAt: null
      }
    ];

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] grid place-items-center bg-slate-950/78 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/12 bg-slate-100 shadow-[0_34px_110px_rgba(0,0,0,0.56)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#0f172a_100%)] p-6 text-white">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">Conversa do lead</span>
            <h2 className="mt-2 break-words text-3xl font-black tracking-normal text-white max-md:text-2xl">{item.n}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-bold text-white">{phone}</span>
              <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-bold text-white">{item.d}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${priorityBadgeClasses(item.p)}`}>{item.p ? (crmPriorityLabels[item.p] || item.p) : 'Salva'}</span>
            </div>
          </div>
          <button className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white px-4 text-sm font-black text-slate-950 shadow-[0_14px_35px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-50" onClick={onClose} type="button">
            <X size={18} />
            Fechar
          </button>
        </div>
        <div className="grid max-h-[72vh] gap-5 overflow-y-auto bg-slate-100 p-6 lg:grid-cols-[1fr_0.78fr]">
          <section className="grid content-start gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Mensagens salvas</span>
            {messages.map((message, index) => {
              const outbound = message.direction === 'OUTBOUND';
              return (
                <article className={`rounded-2xl border p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)] ${outbound ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-white'}`} key={message.id || `${message.direction}-${index}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-black text-slate-950">{outbound ? `Enviada para ${phone}` : `Recebida de ${phone}`}</strong>
                    <span className="text-xs font-bold text-slate-500">{message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR') : item.when}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-relaxed text-slate-700">{message.body}</p>
                </article>
              );
            })}
          </section>
          <section className="grid content-start gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Pergunta e resposta</span>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Pergunta</span>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">{question?.body || item.desc || item.status}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Resposta ligada</span>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
                {answer?.body || 'Ainda nao ha resposta salva para esta pergunta. Ao responder pela tela Conversas, ela ficara gravada no historico deste numero.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LeadDetailModal({ lead, onClose }) {
  if (!lead) return null;

  const fields = [
    ['Nome', lead.n],
    ['WhatsApp', lead.tel || 'Nao informado'],
    ['E-mail', lead.em || 'Nao informado'],
    ['Distrito', lead.d],
    ['Endereco', lead.end],
    ['Idade', lead.a || 'Nao informada'],
    ['Data de aniversario', lead.birthDate || 'Nao informada'],
    ['Genero', lead.g === 'M' ? 'Masculino' : lead.g === 'F' ? 'Feminino' : 'Nao informado'],
    ['Religiao', lead.r],
    ['VIP', lead.v ? 'Sim' : 'Nao'],
    ['Estudo ativo', lead.e ? 'Sim' : 'Nao'],
    ['Material principal', lead.tm],
    ['Material recebido', lead.materialName || 'Nao informado'],
    ['Materiais recebidos', formatNumber(lead.m)],
    ['Descricao', lead.desc && lead.desc !== 'N/I' ? lead.desc : 'Nao informada'],
    ['Prioridade ML', crmPriorityLabels[lead.p] || lead.p],
    ['Score operacional', lead.s],
    ['Similaridade VIP', `${Math.round((lead.sim || 0) * 100)}%`],
    ['Faixa', lead.faixa || 'Nao informada']
  ];

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] grid place-items-center bg-slate-950/78 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/12 bg-slate-100 shadow-[0_34px_110px_rgba(0,0,0,0.56)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#0f172a_100%)] p-6 text-white">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">Detalhes do lead</span>
            <h2 className="mt-2 break-words text-3xl font-black tracking-normal text-white max-md:text-2xl">{lead.n}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${priorityBadgeClasses(lead.p)}`}>{crmPriorityLabels[lead.p] || lead.p}</span>
              <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-bold text-white">{lead.d}</span>
              <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-bold text-white">Score {lead.s}</span>
              {lead.v ? <span className="rounded-full border border-fuchsia-200/40 bg-fuchsia-500 px-3 py-1 text-xs font-black text-white">VIP</span> : null}
              {lead.e ? <span className="rounded-full border border-emerald-200/40 bg-emerald-600 px-3 py-1 text-xs font-black text-white">Estudo ativo</span> : null}
            </div>
          </div>
          <button className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white px-4 text-sm font-black text-slate-950 shadow-[0_14px_35px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-50" onClick={onClose} type="button">Fechar</button>
        </div>
        <div className="grid max-h-[72vh] gap-5 overflow-y-auto bg-slate-100 p-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="grid gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Todos os dados</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]" key={label}>
                  <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  <strong className="mt-1 block break-words text-sm leading-relaxed text-slate-950">{String(value ?? 'Nao informado')}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="grid content-start gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">WhatsApp e acompanhamento</span>
            {whatsappHistoryForLead(lead).map((item) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]" key={item.title}>
                <strong className="block text-sm text-slate-950">{item.title}</strong>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{item.detail}</p>
              </article>
            ))}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-[0_10px_28px_rgba(37,99,235,0.08)]">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">Resumo operacional</span>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {lead.t ? 'Contato apto para WhatsApp.' : 'Contato sem WhatsApp valido.'} {lead.v ? 'Marcado como VIP. ' : ''}{lead.e ? 'Possui estudo ativo para acompanhamento.' : 'Sem estudo ativo registrado.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AssociationLeadExplorer({ association, records }) {
  const [district, setDistrict] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const availableRecords = association?.id === 'paulistana' ? records : [];
  const districts = useMemo(
    () => Array.from(new Set(availableRecords.map((row) => row.d))).sort((a, b) => a.localeCompare(b)),
    [availableRecords]
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableRecords
      .filter((row) => {
        if (district !== 'all' && row.d !== district) return false;
        if (term) {
          const haystack = `${row.n || ''} ${row.tel || ''} ${row.em || ''} ${row.d || ''}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.s || 0) - (a.s || 0));
  }, [availableRecords, district, search]);
  const visible = filtered.slice(0, 120);
  const phoneCount = filtered.filter((row) => row.t).length;

  return (
    <section className={`${panelClass} p-6`}>
      <div className="mb-5 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Leads da associacao selecionada</span>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-slate-950">Buscar leads por distrito</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Clique em qualquer lead para abrir todos os dados cadastrados e o historico de WhatsApp importado.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-right max-sm:w-full max-sm:text-left">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-[0_12px_30px_rgba(37,99,235,0.08)]">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">Encontrados</span>
            <strong className="block text-xl text-slate-950">{formatNumber(filtered.length)}</strong>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 shadow-[0_12px_30px_rgba(16,185,129,0.08)]">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-800">WhatsApp</span>
            <strong className="block text-xl text-slate-950">{formatNumber(phoneCount)}</strong>
          </div>
        </div>
      </div>
      <div className="mb-5 grid gap-3 lg:grid-cols-[260px_1fr]">
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Distrito
          <select className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-[0_10px_28px_rgba(15,23,42,0.06)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" onChange={(event) => setDistrict(event.target.value)} value={district}>
            <option value="all">Todos os distritos</option>
            {districts.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Buscar lead
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-950 shadow-[0_10px_28px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, e-mail ou distrito" value={search} />
          </div>
        </label>
      </div>
      {availableRecords.length ? (
        <div className="grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
          {visible.map((lead) => (
            <button className="interactive-card grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_18px_44px_rgba(37,99,235,0.12)] max-sm:grid-cols-1" key={lead.id} onClick={() => setSelectedLead(lead)} type="button">
              <span className="min-w-0">
                <strong className="block truncate text-base font-black text-slate-950">{lead.n}</strong>
                <span className="mt-1 block truncate text-sm font-medium text-slate-600">{lead.d} · {lead.tel || 'sem telefone'} · {lead.em || 'sem e-mail'}</span>
              </span>
              <span className="flex items-center justify-end gap-3 max-sm:justify-between">
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${priorityBadgeClasses(lead.p)}`}>{crmPriorityLabels[lead.p] || lead.p}</span>
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                  <ChevronRight size={18} />
                </span>
              </span>
            </button>
          ))}
          {filtered.length > visible.length ? (
            <p className="pt-2 text-center text-sm font-semibold text-slate-500">Exibindo {formatNumber(visible.length)} de {formatNumber(filtered.length)} leads. Use a busca ou escolha um distrito para refinar.</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5 text-sm text-slate-400">
          Os leads completos ainda estao carregados apenas para a Associacao Paulistana.
        </div>
      )}
      <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </section>
  );
}

function AddAssociationForm({ onAdd }) {
  const [open, setOpen] = useState(false);

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const region = String(form.get('region') || '').trim();
    if (!name) return;
    onAdd({
      id: `assoc-${Date.now()}`,
      name,
      region: region || 'Região a definir',
      status: 'Planejada',
      campaigns: 0,
      leads: 0,
      hot: 0,
      studies: 0,
      districts: 0,
      conversion: 0
    });
    toast.success('Associação criada', {
      description: `${name} foi adicionada ao dashboard administrativo.`
    });
    event.currentTarget.reset();
    setOpen(false);
  }

  return (
    <div className={`${panelClass} p-5`}>
      <button className={`${primaryButtonClass} w-full`} onClick={() => setOpen((value) => !value)} type="button">
        <BadgePlus size={18} />
        Inserir nova associação
      </button>
      {open ? (
        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Nome da associação
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" name="name" placeholder="Ex.: Associação Paulista Oeste" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Região
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" name="region" placeholder="Ex.: Interior de São Paulo" />
          </label>
          <div className="flex gap-2">
            <button className={ghostButtonClass} onClick={() => setOpen(false)} type="button">Cancelar</button>
            <button className={primaryButtonClass} type="submit">
              <Plus size={18} />
              Criar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function AdminDashboard({ associations, data, canManageAdmin = false, isAssociationsView = false, onOpenAdminGeneral, onOpenAssociations, onOpenAssociation, onOpenLeads, onOpenUsers, onAddAssociation }) {
  const totals = associations.reduce((acc, association) => ({
    leads: acc.leads + association.leads,
    campaigns: acc.campaigns + association.campaigns,
    hot: acc.hot + association.hot,
    studies: acc.studies + association.studies
  }), { leads: 0, campaigns: 0, hot: 0, studies: 0 });

  const chartData = associations.map((association) => ({
    name: association.name.replace('Associação ', ''),
    leads: association.leads,
    quentes: association.hot
  }));

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6 stagger-in`} style={{ animationDelay: '0ms' }}>
        <div className="grid grid-cols-[1.05fr_0.95fr] gap-6 max-xl:grid-cols-1">
          <div>
            <span className={labelClass}>{canManageAdmin ? 'Painel admin' : 'Acesso por associação'}</span>
            <h1 className="silver-title mt-2 text-5xl font-black leading-tight tracking-normal max-md:text-4xl">
              {canManageAdmin ? 'Dashboard das associações' : associations[0]?.name || 'Associação'}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              {canManageAdmin
                ? 'Gerencie territórios, campanhas e performance dos leads em um painel central com navegação limpa e efeitos sutis de interação.'
                : 'Acesse somente os dados, leads, campanhas, WhatsApp e relatórios vinculados a esta associação.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className={primaryButtonClass} onClick={onOpenLeads} type="button">
                <ClipboardList size={18} />
                Leads
              </button>
              {canManageAdmin && !isAssociationsView ? (
                <button className={primaryButtonClass} onClick={onOpenAssociations} type="button">
                  Associações
                  <ArrowRight size={18} />
                </button>
              ) : null}
              {canManageAdmin ? (
                <>
                  <button
                    className={ghostButtonClass}
                    onClick={() => toast.info('Fila de automações', {
                      description: 'Em breve você poderá revisar mensagens, etapas e métricas de resposta aqui.'
                    })}
                    type="button"
                  >
                    <WandSparkles size={18} />
                    Revisar automações
                  </button>
                  <button className={ghostButtonClass} onClick={onOpenAdminGeneral} type="button">
                    <ShieldCheck size={18} />
                    Gestao geral
                  </button>
                  <button className={ghostButtonClass} onClick={onOpenUsers} type="button">
                    <UsersRound size={18} />
                    Acessos
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="interactive-card min-h-72 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-4 transition duration-300 hover:border-slate-200/25">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={data.campaignTrend}>
                <defs>
                  <linearGradient id="silverLeadGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.62} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                <XAxis dataKey="etapa" stroke="#94a3b8" tickLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatNumber} tickLine={false} width={70} />
                <Tooltip cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '4 4' }} contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} itemStyle={{ color: '#fff' }} formatter={(value) => formatNumber(value)} />
                <Area dataKey="leads" fill="url(#silverLeadGradient)" stroke="#e2e8f0" strokeWidth={3} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1 stagger-in" style={{ animationDelay: '100ms' }}>
        <MetricCard
          detail={canManageAdmin ? `${associations.length} territórios cadastrados` : 'território vinculado'}
          icon={Building2}
          label={canManageAdmin ? 'Associações' : 'Associação'}
          value={formatNumber(associations.length)}
        />
        <MetricCard detail="campanhas mapeadas" icon={Radio} label="Campanhas" tone="green" value={formatNumber(totals.campaigns)} />
        <MetricCard detail="com prioridade alta" icon={Sparkles} label="Leads quentes" tone="orange" value={formatNumber(totals.hot)} />
        <MetricCard detail="em acompanhamento" icon={ClipboardList} label="Estudos ativos" tone="violet" value={formatNumber(totals.studies)} />
      </section>

      <section className="grid grid-cols-[1fr_24rem] gap-4 max-xl:grid-cols-1 stagger-in" style={{ animationDelay: '200ms' }}>
        <article className={`${panelClass} p-6`}>
          <div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
            <div>
              <span className={labelClass}>{canManageAdmin ? 'Associações' : 'Associação'}</span>
              <h2 className="mt-1 text-2xl font-black text-slate-50">{canManageAdmin ? 'Territórios cadastrados' : 'Território vinculado'}</h2>
            </div>
            {canManageAdmin ? (
              <div className="relative w-80 max-md:w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                <input className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 pl-10 pr-3 text-sm font-bold text-slate-200 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" placeholder="Buscar associação..." />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3">
            {associations.map((association) => (
              <button
                className="interactive-card group grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-5 text-left"
                key={association.id}
                onClick={() => onOpenAssociation(association.id)}
                type="button"
              >
                <span>
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-xl font-black text-slate-50">{association.name}</strong>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${association.status === 'Ativa' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>{association.status}</span>
                  </span>
                  <span className="mt-2 block text-sm text-slate-500">{association.region} · {formatNumber(association.leads)} leads · {association.campaigns} campanhas</span>
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200/15 bg-white/[0.055] text-slate-200 transition group-hover:translate-x-1 group-hover:border-slate-200/30">
                  <ChevronRight size={22} />
                </span>
              </button>
            ))}
          </div>
        </article>

        <aside className="grid gap-4">
          {canManageAdmin ? <AddAssociationForm onAdd={onAddAssociation} /> : null}
          <div className={`${panelClass} interactive-card p-5`}>
            <span className={labelClass}>Governança</span>
            <h3 className="mt-2 text-xl font-black text-slate-50">Acesso por nível</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {canManageAdmin
                ? 'Admin geral vê todas as associações. Gestores e voluntários entram apenas nos territórios e leads permitidos.'
                : 'Este acesso mostra apenas a associação vinculada ao usuário e os dados pertencentes a ela.'}
            </p>
          </div>
          <div className={`${panelClass} interactive-card p-5`}>
            <span className={labelClass}>Comparativo</span>
            <div className="mt-4 h-60">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={false} contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} itemStyle={{ color: '#fff' }} formatter={(value) => formatNumber(value)} />
                  <Bar dataKey="leads" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="quentes" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function DatasetUploadPanel({ association, onUpdated, user }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const canUpdate = user?.role === 'ADMIN_GERAL';

  async function submitUpload(event) {
    event.preventDefault();
    if (!canUpdate || uploading || !files.length) return;

    const form = event.currentTarget;
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    setUploading(true);
    setProgress(8);
    setProgressLabel('Enviando arquivos para o backend...');
    setLastResult(null);

    let result = null;
    try {
      setProgress(22);
      const response = await apiFetch('/api/dataset/upload', {
        method: 'POST',
        body: formData
      });
      setProgress(68);
      setProgressLabel('Consolidando Excel, JSON e ranking ML...');
      result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Nao foi possivel atualizar a base.');
      }
      setProgress(82);
      setProgressLabel('Atualizacao concluida. Recarregando painel...');
      setLastResult(result);
      setFiles([]);
      form.reset();
      const novos = result?.result?.consolidacao?.alunos_novos ?? 0;
      toast.success('Base atualizada', {
        description: `${formatNumber(novos)} aluno(s) novo(s) inseridos e ML recalculado.`
      });
      if (result?.historyWarning) {
        toast.warning('Historico pendente', {
          description: 'A base foi atualizada, mas o historico no banco precisa ser verificado.'
        });
      }
    } catch (error) {
      setProgress(0);
      setProgressLabel('');
      toast.error('Atualizacao falhou', {
        description: error.message || 'Confira os arquivos e tente novamente.'
      });
      setUploading(false);
      return;
    }

    try {
      await onUpdated?.();
      setProgress(100);
      setProgressLabel('Painel atualizado.');
    } catch {
      toast.warning('Base atualizada', {
        description: 'Os arquivos foram processados. Recarregue a pagina se os numeros nao mudarem de imediato.'
      });
    } finally {
      window.setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setProgressLabel('');
      }, 500);
    }
  }

  const consolidation = lastResult?.result?.consolidacao;
  const ml = lastResult?.result?.ml;
  const lastHistoryEntry = lastResult?.history;

  return (
    <section className={`${panelClass} p-6`}>
      <div className="mb-5 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <span className={labelClass}>Base de dados</span>
          <h2 className="mt-1 text-xl font-black text-slate-50">Atualizar interessados de {association.name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Envie um ou mais Excels. O sistema compara com a base atual, adiciona apenas alunos novos e recalcula a priorizacao ML.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
          <Database size={14} />
          Admin
        </span>
      </div>

      <form className="grid gap-4" onSubmit={submitUpload}>
        <label className={`interactive-card flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center transition ${canUpdate ? 'border-blue-400/35 bg-blue-100/70 hover:border-blue-400' : 'border-slate-400/20 bg-slate-500/[0.04] opacity-70'}`}>
          <UploadCloud className="text-blue-400" size={28} />
          <span className="text-sm font-bold !text-slate-950">
            {files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Selecionar arquivos Excel'}
          </span>
          <span className="text-xs font-semibold !text-slate-700">Aceita varios arquivos .xlsx da listagem completa</span>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={!canUpdate || uploading}
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
            type="file"
          />
        </label>

        {files.length > 0 && (
          <div className="grid gap-2">
            {files.map((file) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/75 px-4 py-3" key={`${file.name}-${file.size}`}>
                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold !text-slate-950">
                  <FileSpreadsheet className="shrink-0 text-emerald-400" size={17} />
                  <span className="truncate">{file.name}</span>
                </span>
                <span className="text-xs font-bold !text-slate-700">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button className={primaryButtonClass} disabled={!canUpdate || uploading || !files.length} type="submit">
            <Database size={17} />
            {uploading ? 'Atualizando...' : 'Atualizar base e recalcular ML'}
          </button>
          {!canUpdate && <span className="text-sm text-slate-400">Disponivel apenas para Admin Geral.</span>}
          {uploading && <span className="text-sm font-semibold !text-slate-900">{progressLabel || 'Processando Excel, JSON e ranking ML...'}</span>}
        </div>
        {uploading && (
          <div className="grid gap-2 rounded-2xl border border-blue-200 bg-blue-50/80 p-3">
            <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-700 via-emerald-500 to-blue-500 transition-all duration-500" style={{ width: `${Math.max(8, Math.min(progress, 100))}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide !text-slate-800">
              <span>Progresso</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}
      </form>

      {consolidation && (
        <>
          <div className="mt-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <MetricCard detail="antes do upload" icon={UsersRound} label="Base anterior" value={formatNumber(consolidation.linhas_antes)} />
            <MetricCard detail="inseridos agora" icon={BadgePlus} label="Novos alunos" tone="green" value={formatNumber(consolidation.alunos_novos)} />
            <MetricCard detail="apos consolidar" icon={CheckCircle2} label="Base final" value={formatNumber(consolidation.linhas_depois)} />
            <MetricCard detail={`${formatNumber(ml?.vips || 0)} VIPs historicos`} icon={Sparkles} label="ML registros" tone="orange" value={formatNumber(ml?.registros || 0)} />
          </div>
          <div className="mt-5">
            <LastDatasetUpdateCard update={lastHistoryEntry || {
              atualizado_em: new Date().toISOString(),
              consolidacao: consolidation,
              ml
            }} />
          </div>
        </>
      )}
    </section>
  );
}

function LastDatasetUpdateCard({ update }) {
  const consolidation = update?.consolidacao;
  const hasUpdate = Boolean(consolidation);
  const districts = consolidation?.distritos_novos || [];
  const duplicateAlerts = consolidation?.alertas_duplicidade || {};
  const duplicateCount = [
    duplicateAlerts.ids_repetidos_upload,
    duplicateAlerts.emails_repetidos_upload,
    duplicateAlerts.nomes_repetidos_upload
  ].reduce((total, items) => total + (items?.length || 0), 0);
  const date = formatDatasetDate(update?.atualizado_em);

  return (
    <section className={`${panelClass} overflow-hidden p-6`}>
      <div className="grid grid-cols-[0.9fr_1.1fr] gap-6 max-xl:grid-cols-1">
        <div>
          <span className={labelClass}>Ultima entrada na base</span>
          <h2 className="mt-2 text-3xl font-black text-slate-50">
            {hasUpdate ? `${formatNumber(consolidation.alunos_novos)} novos alunos` : 'Nenhum upload registrado'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {hasUpdate
              ? `Processado em ${date}. A base foi de ${formatNumber(consolidation.linhas_antes)} para ${formatNumber(consolidation.linhas_depois)} registros.`
              : 'Quando um Excel for enviado pelo painel, este card mostrara o resumo da entrada mais recente.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(consolidation?.arquivos || []).map((file) => (
              <span className="rounded-full border border-slate-300 bg-slate-200 px-3 py-1 text-xs font-bold text-slate-950" key={file.arquivo}>
                {file.arquivo}: {formatNumber(file.novos)} novos
              </span>
            ))}
            {hasUpdate && consolidation.alunos_novos === 0 ? (
              <span className="rounded-full border border-amber-300/30 bg-amber-500/[0.08] px-3 py-1 text-xs font-bold text-amber-300">
                Nenhum novo lead neste upload
              </span>
            ) : null}
            {duplicateCount ? (
              <span className="rounded-full border border-red-300/30 bg-red-500/[0.08] px-3 py-1 text-xs font-bold text-red-300">
                {formatNumber(duplicateCount)} alerta(s) de duplicidade
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className={labelClass}>Distritos dos novos alunos</span>
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
              {formatNumber(districts.length)} distritos
            </span>
          </div>
          <div className="grid max-h-72 gap-2 overflow-auto pr-1">
            {districts.length ? districts.slice(0, 12).map((item) => (
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-slate-950/42 px-4 py-3" key={item.distrito}>
                <span className="min-w-0 truncate text-sm font-bold text-slate-100">{item.distrito}</span>
                <strong className="rounded-full bg-white/90 px-3 py-1 text-sm font-black tabular-nums text-slate-950">
                  {formatNumber(item.quantidade)}
                </strong>
              </div>
            )) : (
              <div className="rounded-xl border border-white/[0.07] bg-slate-950/42 px-4 py-3 text-sm font-semibold text-slate-400">
                Nenhum distrito novo registrado nesta atualizacao.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DatasetHistoryView({ history = [], onBack }) {
  const [dbHistory, setDbHistory] = useState(Array.isArray(history) ? history : []);
  const [loading, setLoading] = useState(false);
  const [openDistricts, setOpenDistricts] = useState(() => new Set());
  const safeHistory = dbHistory.length ? dbHistory : (Array.isArray(history) ? history : []);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setLoading(true);
      try {
        const response = await apiFetch('/api/dataset/history');
        const payload = await response.json().catch(() => ({}));
        if (active && response.ok && Array.isArray(payload.history)) {
          setDbHistory(payload.history);
        }
      } catch {
        if (active) {
          toast.warning('Historico indisponivel', {
            description: 'Nao foi possivel consultar o historico no banco agora.'
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadHistory();
    return () => { active = false; };
  }, []);

  function toggleDistrict(key) {
    setOpenDistricts((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={labelClass}>Historico do dataset</span>
            <h1 className="silver-title mt-2 text-4xl font-extrabold leading-tight tracking-normal max-md:text-3xl">Excels processados</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
              Cada atualizacao manual fica registrada aqui com arquivos enviados, novos leads, duplicidades e resumo por distrito.
            </p>
          </div>
          <button className={ghostButtonClass} onClick={onBack} type="button">
            <ArrowRight className="rotate-180" size={18} />
            Voltar para Leads
          </button>
        </div>
      </section>

      <section className="history-dark-surface grid gap-4">
        {loading ? (
          <div className={`${panelClass} p-6 text-sm font-semibold text-slate-400`}>Carregando historico salvo no banco...</div>
        ) : null}
        {safeHistory.length ? (
          safeHistory.map((entry, index) => {
            const consolidation = entry.consolidacao || {};
            const alerts = consolidation.alertas_duplicidade || {};
            const alertCount = (alerts.ids_repetidos_upload?.length || 0)
              + (alerts.emails_repetidos_upload?.length || 0)
              + (alerts.nomes_repetidos_upload?.length || 0);
            const date = formatDatasetDate(entry.atualizado_em);
            const files = consolidation.arquivos || entry.uploadedFiles || [];
            const newLeads = consolidation.alunos_novos_detalhes || [];
            const mlStatus = entry.ml_status || {};
            const mlSummary = mlStatus.resumo || {};
            const mlDate = formatDatasetDate(mlStatus.atualizado_em_brasil || mlStatus.atualizado_em || entry.atualizado_em);
            const mlMetrics = entry.ml || {};
            return (
              <article className="history-dark-surface rounded-2xl border border-white/[0.10] bg-slate-950 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.32)]" key={entry.id || `${entry.atualizado_em}-${index}`}>
                <div className="mb-5 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
                  <div className="rounded-2xl bg-blue-600 p-4">
                    <span className="text-[10px] font-black uppercase tracking-wide text-white/75">Novos leads</span>
                    <strong className="mt-2 block text-3xl font-black text-white">{formatNumber(consolidation.alunos_novos || 0)}</strong>
                  </div>
                  <div className="rounded-2xl bg-emerald-600 p-4">
                    <span className="text-[10px] font-black uppercase tracking-wide text-white/75">Distritos</span>
                    <strong className="mt-2 block text-3xl font-black text-white">{formatNumber((consolidation.distritos_novos || []).length)}</strong>
                  </div>
                  <div className="rounded-2xl bg-orange-600 p-4">
                    <span className="text-[10px] font-black uppercase tracking-wide text-white/75">ML registros</span>
                    <strong className="mt-2 block text-3xl font-black text-white">{formatNumber(mlSummary.registros?.depois ?? mlMetrics.registros ?? 0)}</strong>
                  </div>
                  <div className="rounded-2xl bg-slate-800 p-4">
                    <span className="text-[10px] font-black uppercase tracking-wide text-white/75">ML atualizado</span>
                    <strong className="mt-2 block text-sm font-black text-white">{mlDate}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] !text-slate-300">{date}</span>
                    <h2 className="mt-2 text-2xl font-black !text-white">
                      {formatNumber(consolidation.alunos_novos || 0)} novos leads
                    </h2>
                    <p className="mt-2 text-sm font-semibold !text-slate-300">
                      Base {formatNumber(consolidation.linhas_antes || 0)} para {formatNumber(consolidation.linhas_depois || 0)} registros.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${consolidation.alunos_novos ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {consolidation.alunos_novos ? 'Com novos leads' : 'Sem novos leads'}
                    </span>
                    {alertCount ? (
                      <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                        {formatNumber(alertCount)} alerta(s)
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                        Sem duplicidade relevante
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] !text-slate-300">Arquivos enviados</span>
                    <div className="mt-3 grid gap-2">
                      {files.length ? files.map((file, fileIndex) => (
                        <div className="rounded-xl bg-white/[0.06] px-3 py-2" key={file.arquivo || file.name || fileIndex}>
                          <strong className="block text-sm !text-white">{file.arquivo || file.name}</strong>
                          {'lidos' in file ? (
                            <span className="text-xs font-semibold !text-slate-300">
                              {formatNumber(file.lidos)} lidos | {formatNumber(file.novos)} novos | {formatNumber(file.ja_existiam)} ja existiam | {formatNumber(file.duplicados_upload)} duplicados no upload
                            </span>
                          ) : (
                            <span className="text-xs font-semibold !text-slate-300">{file.size ? `${(Number(file.size) / 1024 / 1024).toFixed(1)} MB` : 'Arquivo registrado'}</span>
                          )}
                        </div>
                      )) : (
                        <p className="text-sm font-semibold !text-slate-300">Nenhum arquivo listado neste registro.</p>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] !text-slate-300">Machine Learning atualizado</span>
                      <div className="mt-3 grid gap-2 text-xs font-semibold !text-slate-300">
                        <span>Horario Brasil: {mlDate}</span>
                        <span>Registros: {formatMlDelta(mlSummary, 'registros', mlMetrics.registros)}</span>
                        <span>VIPs historicos: {formatMlDelta(mlSummary, 'vips', mlMetrics.vips)}</span>
                        <span>Ranking nao VIP: {formatMlDelta(mlSummary, 'ranking_nao_vip', mlMetrics.ranking_nao_vip)}</span>
                        <span>Arquivos: {(mlStatus.arquivos_atualizados || []).join(', ') || 'metricas e rankings atualizados'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] !text-slate-300">Distritos dos novos leads</span>
                      <div className="mt-3 grid gap-2">
                        {(consolidation.distritos_novos || []).length ? consolidation.distritos_novos.slice(0, 14).map((item) => {
                          const districtKey = `${entry.id || index}-${item.distrito}`;
                          const districtOpen = openDistricts.has(districtKey);
                          const districtLeads = newLeads.filter((lead) => lead.distrito === item.distrito);
                          return (
                            <div className="rounded-xl bg-white/[0.06] p-2" key={item.distrito}>
                              <button className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.08]" onClick={() => toggleDistrict(districtKey)} type="button">
                                <span className="text-xs font-black !text-blue-100">{item.distrito}: {formatNumber(item.quantidade)}</span>
                                <ChevronRight className={`text-blue-100 transition ${districtOpen ? 'rotate-90' : ''}`} size={16} />
                              </button>
                              {districtOpen ? (
                                <div className="mt-2 grid gap-2">
                                  {districtLeads.length ? districtLeads.map((lead) => (
                                    <div className="rounded-lg bg-slate-950/70 px-3 py-2" key={`${lead.id}-${lead.email}-${lead.nome}`}>
                                      <strong className="block text-sm !text-white">{lead.nome}</strong>
                                      <span className="block text-xs font-semibold !text-slate-300">ID {lead.id || 'sem ID'} | {lead.telefone || 'sem telefone'} | {lead.email || 'sem email'}</span>
                                      <span className="block text-xs font-semibold !text-slate-400">{lead.cidade || 'cidade nao informada'} | {lead.bairro || 'bairro nao informado'} | {lead.arquivo}</span>
                                    </div>
                                  )) : (
                                    <span className="block px-2 pb-2 text-xs font-semibold !text-slate-300">Este upload antigo nao tem a lista nominal salva.</span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        }) : (
                          <span className="text-sm font-semibold !text-slate-300">Nenhum distrito novo registrado neste upload.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] !text-slate-300">Duplicidades detectadas</span>
                      <div className="mt-3 grid gap-2">
                        {[
                          ['IDs repetidos', alerts.ids_repetidos_upload],
                          ['Emails repetidos', alerts.emails_repetidos_upload],
                          ['Nomes repetidos', alerts.nomes_repetidos_upload]
                        ].map(([label, items]) => (
                          <div className="rounded-xl bg-white/[0.06] px-3 py-2" key={label}>
                            <strong className="block text-xs uppercase tracking-wide !text-white">{label}</strong>
                            <span className="text-xs font-semibold !text-slate-300">
                              {items?.length ? items.slice(0, 4).map((item) => `${item.valor} (${item.quantidade})`).join(', ') : 'Nenhum alerta'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-white/[0.10] bg-slate-950 p-8 text-center text-sm font-semibold !text-white">
            Nenhum upload de Excel registrado ainda.
          </div>
        )}
      </section>
    </div>
  );
}

function DatasetHistoryModal({ history = [], onClose }) {
  const safeHistory = Array.isArray(history) ? history : [];

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.10] bg-slate-950 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-6">
          <div>
            <span className={labelClass}>Historico do dataset</span>
            <h2 className="mt-1 text-2xl font-black">Excels processados</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/10 text-white" onClick={onClose} type="button" aria-label="Fechar historico">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-6">
          {safeHistory.length ? (
            <div className="grid gap-4">
              {safeHistory.map((entry, index) => {
                const consolidation = entry.consolidacao || {};
                const alerts = consolidation.alertas_duplicidade || {};
                const alertCount = (alerts.ids_repetidos_upload?.length || 0)
                  + (alerts.emails_repetidos_upload?.length || 0)
                  + (alerts.nomes_repetidos_upload?.length || 0);
                const date = formatDatasetDate(entry.atualizado_em);
                return (
                  <article className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5" key={`${entry.atualizado_em}-${index}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong className="text-xl font-black">{formatNumber(consolidation.alunos_novos || 0)} novos leads</strong>
                        <p className="mt-1 text-sm text-slate-400">
                          {date} · base {formatNumber(consolidation.linhas_antes || 0)} → {formatNumber(consolidation.linhas_depois || 0)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${consolidation.alunos_novos ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {consolidation.alunos_novos ? 'Com novos leads' : 'Sem novos leads'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div>
                        <span className={labelClass}>Arquivos</span>
                        <div className="mt-2 grid gap-2">
                          {(consolidation.arquivos || []).map((file) => (
                            <div className="rounded-xl bg-slate-900/70 px-3 py-2 text-sm" key={file.arquivo}>
                              <strong>{file.arquivo}</strong>
                              <span className="block text-xs text-slate-400">
                                {formatNumber(file.lidos)} lidos · {formatNumber(file.novos)} novos · {formatNumber(file.ja_existiam)} ja existiam · {formatNumber(file.duplicados_upload)} duplicados no upload
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className={labelClass}>Distritos e alertas</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(consolidation.distritos_novos || []).slice(0, 10).map((item) => (
                            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200" key={item.distrito}>
                              {item.distrito}: {formatNumber(item.quantidade)}
                            </span>
                          ))}
                          {alertCount ? (
                            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-200">
                              {formatNumber(alertCount)} alerta(s) de ID/email/nome repetido
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-8 text-center text-slate-400">
              Nenhum upload de Excel registrado ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyticsRankingModal({ ranking, onClose }) {
  const [contactFilter, setContactFilter] = useState('');
  const [contactFilterUnit, setContactFilterUnit] = useState('day');
  const [visibleLimit, setVisibleLimit] = useState(80);
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    setContactFilter('');
    setContactFilterUnit('day');
    setVisibleLimit(80);
    setExpandedGroup(null);
  }, [ranking]);

  useEffect(() => {
    setVisibleLimit(80);
  }, [contactFilter, contactFilterUnit]);

  const filteredRows = useMemo(() => {
    const rows = ranking?.rows || [];
    if (ranking?.type !== 'recentContacts') return rows;
    const value = Number(contactFilter);
    if (!Number.isFinite(value) || value <= 0) return rows;
    const multiplier = contactFilterUnit === 'year' ? 365 : contactFilterUnit === 'month' ? 30 : 1;
    const maxDays = value * multiplier;
    return rows.filter((row) => Number(row.rawDays ?? row.c) <= maxDays);
  }, [contactFilter, contactFilterUnit, ranking]);

  if (!ranking) return null;

  const showContactFilter = ranking.type === 'recentContacts';
  const visibleRows = filteredRows.slice(0, visibleLimit);
  const hasMoreRows = filteredRows.length > visibleRows.length;
  const expandedNames = expandedGroup?.leadRows?.map((lead) => ({
    name: lead.n || lead.name || 'Lead sem nome',
    detail: `${lead.bairro || lead.d || 'Local não informado'} · ${lead.tel || 'sem telefone'} · ${lead.em || 'sem e-mail'}`
  })) || expandedGroup?.details?.map((name) => ({ name, detail: null })) || [];

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/78 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-blue-600/24 via-slate-900 to-emerald-500/16 p-6">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.22em] text-blue-100">{ranking.kicker}</span>
            <h2 className="mt-2 text-2xl font-black text-white">{ranking.title}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-300">{ranking.subtitle}</p>
          </div>
          <button
            aria-label="Fechar modal"
            className="group grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/18 bg-white/8 text-white shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:rotate-3 hover:border-red-200/60 hover:bg-red-500/18 hover:shadow-[0_22px_46px_rgba(248,113,113,0.18)] focus:outline-none focus:ring-4 focus:ring-red-400/20"
            onClick={onClose}
            type="button"
          >
            <X className="transition duration-300 group-hover:rotate-90 group-hover:scale-110 group-hover:text-red-100" size={20} />
          </button>
        </div>
        {showContactFilter ? (
          <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Pesquisar até</span>
                <input
                  className="h-11 w-32 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-black text-white outline-none transition placeholder:text-slate-600 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/15"
                  min="1"
                  onChange={(event) => setContactFilter(event.target.value)}
                  placeholder="Número"
                  type="number"
                  value={contactFilter}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Período</span>
                <select
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-black text-white outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/15"
                  onChange={(event) => setContactFilterUnit(event.target.value)}
                  value={contactFilterUnit}
                >
                  <option value="day">Dia</option>
                  <option value="month">Mês</option>
                  <option value="year">Ano</option>
                </select>
              </label>
              <span className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-bold text-slate-300">
                {formatNumber(filteredRows.length)} de {formatNumber(ranking.rows.length)} leads
              </span>
            </div>
          </div>
        ) : null}
        <div className="max-h-[calc(88vh-150px)] overflow-y-auto p-6">
          <div className="grid gap-3">
            {filteredRows.length ? visibleRows.map((row, index) => {
              const title = row.title || row.address || row.name || row.n || 'Lead sem nome';
              const subtitle = row.subtitle
                || (ranking.type === 'addresses' ? (row.names || []).join(', ') || 'Sem nomes vinculados' : null)
                || (ranking.type === 'materials' ? `${formatNumber(row.leads || 0)} leads vinculados` : null)
                || (ranking.type === 'birthdays' ? `${row.month || 'Mês'} · ${row.date}` : null)
                || (ranking.type === 'leadList' ? `${row.d || 'Distrito não informado'} · ${row.tel || 'sem telefone'} · ${row.em || 'sem e-mail'}` : null)
                || (ranking.type === 'recentContacts' ? `${row.d || 'Distrito não informado'} · ${row.tel || 'sem telefone'}` : null);
              const metric = row.metric
                || (ranking.type === 'addresses' ? `${formatNumber(row.leads || 0)} leads` : null)
                || (ranking.type === 'materials' ? formatNumber(row.recebidos || 0) : null)
                || (ranking.type === 'birthdays' ? row.date : null)
                || (ranking.type === 'leadList' ? (row.t ? 'WhatsApp' : 'Sem WhatsApp') : null)
                || (ranking.type === 'recentContacts' ? `${formatNumber(row.c)} dias` : null);
              const details = row.details
                || (ranking.type === 'materials' ? row.names : null)
                || (ranking.type === 'leadList' ? [
                  row.em ? `E-mail: ${row.em}` : 'E-mail não informado',
                  row.tel ? `Telefone: ${row.tel}` : 'Telefone não informado',
                  (row.materialName || row.materialPrincipal) && (row.materialName || row.materialPrincipal) !== 'N/I' ? `Material: ${row.materialName || row.materialPrincipal}` : 'Material não informado'
                ] : null)
                || (ranking.type === 'recentContacts' ? [
                  row.birthDate && row.birthDate !== 'N/I' ? `Aniversário: ${row.birthDate}` : 'Aniversário não informado',
                  (row.materialName || row.materialPrincipal) && (row.materialName || row.materialPrincipal) !== 'N/I' ? `Material: ${row.materialName || row.materialPrincipal}` : 'Material não informado'
                ] : []);
              return (
                <button className="group relative overflow-hidden grid w-full grid-cols-[auto_1fr_auto] items-start gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-blue-500/[0.035] p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition duration-300 hover:-translate-y-1 hover:border-blue-300/45 hover:bg-white/[0.075] hover:shadow-[0_26px_62px_rgba(37,99,235,0.20)] focus:outline-none focus:ring-4 focus:ring-blue-500/15 max-md:grid-cols-1" key={`${ranking.title}-${title}-${index}`} onClick={() => {
                  if (row.leadRows?.length || details?.length) {
                    setExpandedGroup({ title, subtitle, metric, details, leadRows: row.leadRows || [] });
                  }
                }} type="button">
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/85 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.18)] transition duration-300 group-hover:scale-105 group-hover:bg-blue-50 group-hover:shadow-[0_16px_34px_rgba(147,197,253,0.22)]">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block break-words text-base font-black text-white transition duration-300 group-hover:text-blue-50">{title}</strong>
                    {subtitle ? <span className="mt-1 block break-words text-sm font-semibold text-slate-400 transition duration-300 group-hover:text-slate-300">{subtitle}</span> : null}
                    {details?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {details.map((detail) => (
                          <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300 transition duration-300 group-hover:border-blue-200/25 group-hover:bg-blue-950/45 group-hover:text-blue-100" key={detail}>{detail}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {metric ? <strong className="rounded-2xl bg-blue-600 px-4 py-2 text-lg font-black text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)] transition duration-300 group-hover:scale-105 group-hover:bg-blue-500 group-hover:shadow-[0_18px_38px_rgba(37,99,235,0.38)]">{metric}</strong> : null}
                </button>
              );
            }) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-center text-sm font-semibold text-slate-400">
                Nenhum dado real encontrado para este ranking.
              </div>
            )}
            {hasMoreRows ? (
              <button
                className="mx-auto mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-slate-950 shadow-[0_16px_34px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5 hover:bg-blue-50"
                onClick={() => setVisibleLimit((current) => current + 80)}
                type="button"
              >
                Carregar mais {formatNumber(Math.min(80, filteredRows.length - visibleRows.length))}
              </button>
            ) : null}
          </div>
        </div>
        {expandedGroup ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/78 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-slate-950 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-blue-600/22 via-slate-900 to-slate-950 p-5">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Leads vinculados</span>
                  <h3 className="mt-2 text-2xl font-black text-white">{expandedGroup.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-300">{expandedGroup.subtitle || `${formatNumber(expandedNames.length)} nomes encontrados`}</p>
                </div>
                <button
                  aria-label="Fechar lista de nomes"
                  className="group grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/18 bg-white/8 text-white transition duration-300 hover:-translate-y-0.5 hover:border-red-200/60 hover:bg-red-500/18 focus:outline-none focus:ring-4 focus:ring-red-400/20"
                  onClick={() => setExpandedGroup(null)}
                  type="button"
                >
                  <X className="transition duration-300 group-hover:rotate-90 group-hover:text-red-100" size={18} />
                </button>
              </div>
              <div className="max-h-[58vh] overflow-y-auto p-5">
                <div className="grid gap-2">
                  {expandedNames.length ? expandedNames.map((item, index) => (
                    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3 transition hover:border-blue-300/45 hover:bg-white/[0.08]" key={`${expandedGroup.title}-${item.name}-${index}`}>
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-xs font-black text-slate-950">#{index + 1}</span>
                      <div className="min-w-0">
                        <strong className="block break-words text-sm font-black text-white">{item.name}</strong>
                        {item.detail ? <span className="mt-1 block break-words text-xs font-semibold text-slate-400">{item.detail}</span> : null}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-center text-sm font-semibold text-slate-400">
                      Nenhum nome encontrado neste grupo.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function LeadAnalyticsSection({ data, records = [], interestRecords = [], onlyPilot = false }) {
  const [selectedRanking, setSelectedRanking] = useState(null);
  const analytics = useMemo(() => {
    const total = data?.total || records.length || 0;
    const priorityLabels = { Hot: 'Quentes', Warm: 'Potenciais', Cool: 'Frios' };
    const priorityCounts = records.reduce((acc, lead) => {
      const key = lead.p && priorityLabels[lead.p] ? lead.p : 'none';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const districtMap = records.reduce((map, lead) => {
      const name = lead.d || 'Sem distrito';
      const current = map.get(name) || { name, interessados: 0, whatsapp: 0, quentes: 0, estudos: 0 };
      current.interessados += 1;
      current.whatsapp += lead.t ? 1 : 0;
      current.quentes += lead.p === 'Hot' ? 1 : 0;
      current.estudos += lead.e ? 1 : 0;
      map.set(name, current);
      return map;
    }, new Map());
    const districtMix = Array.from(districtMap.values())
      .sort((a, b) => b.interessados - a.interessados)
      .slice(0, 7);
    const recency = records.reduce((acc, lead) => {
      const days = Number(lead.c);
      if (!Number.isFinite(days)) acc.semInfo += 1;
      else if (days > 365) acc.antigos += 1;
      else acc.recentes += 1;
      return acc;
    }, { recentes: 0, antigos: 0, semInfo: 0 });
    const ageBuckets = records.reduce((acc, lead) => {
      const age = Number(lead.a);
      if (!Number.isFinite(age) || age <= 0) acc.semInfo += 1;
      else if (age <= 17) acc.ate17 += 1;
      else if (age <= 24) acc.de18a24 += 1;
      else if (age <= 34) acc.de25a34 += 1;
      else if (age <= 44) acc.de35a44 += 1;
      else if (age <= 59) acc.de45a59 += 1;
      else acc.acima60 += 1;
      return acc;
    }, { ate17: 0, de18a24: 0, de25a34: 0, de35a44: 0, de45a59: 0, acima60: 0, semInfo: 0 });
    const genderCounts = records.reduce((acc, lead) => {
      if (lead.g === 'M') acc.masculino += 1;
      else if (lead.g === 'F') acc.feminino += 1;
      else acc.naoInformado += 1;
      return acc;
    }, { masculino: 0, feminino: 0, naoInformado: 0 });
    const materialTypeCounts = records.reduce((acc, lead) => {
      const name = lead.tm && lead.tm !== 'N/I' ? lead.tm : 'Não informado';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const materialNameMap = records.reduce((map, lead) => {
      const name = lead.materialName && lead.materialName !== 'N/I' ? lead.materialName : 'Não informado';
      const current = map.get(name) || { name, leads: 0, recebidos: 0, names: [] };
      current.leads += 1;
      current.recebidos += Number(lead.m) || 0;
      if (lead.n && current.names.length < 8) current.names.push(lead.n);
      map.set(name, current);
      return map;
    }, new Map());
    const addressMap = records.reduce((map, lead) => {
      const address = lead.end && lead.end !== 'N/I' ? lead.end : 'Endereço não informado';
      const current = map.get(address) || { address, leads: 0, names: [] };
      current.leads += 1;
      if (lead.n && current.names.length < 4) current.names.push(lead.n);
      map.set(address, current);
      return map;
    }, new Map());
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const birthdaysByMonth = monthNames.map((month, index) => ({
      month,
      leads: records
        .map((lead) => {
          const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(lead.birthDate || '').trim());
          if (!match || Number(match[2]) !== index + 1) return null;
          return { id: lead.id, name: lead.n || 'Lead sem nome', date: lead.birthDate, day: Number(match[1]) };
        })
        .filter(Boolean)
        .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))
    }));
    const emailGroups = [
      {
        name: 'Com e-mail',
        value: records.filter((lead) => Boolean(lead.em)).length,
        rows: records.filter((lead) => Boolean(lead.em))
      },
      {
        name: 'Sem e-mail',
        value: records.filter((lead) => !lead.em).length,
        rows: records.filter((lead) => !lead.em)
      }
    ];
    const emailWhatsappGroups = [
      {
        name: 'E-mail e WhatsApp',
        value: records.filter((lead) => Boolean(lead.em) && lead.t).length,
        rows: records.filter((lead) => Boolean(lead.em) && lead.t)
      },
      {
        name: 'Sem e-mail, com WhatsApp',
        value: records.filter((lead) => !lead.em && lead.t).length,
        rows: records.filter((lead) => !lead.em && lead.t)
      },
      {
        name: 'Sem e-mail e sem WhatsApp',
        value: records.filter((lead) => !lead.em && !lead.t).length,
        rows: records.filter((lead) => !lead.em && !lead.t)
      }
    ];
    const countBy = (rows, getKey, labelKey = 'name') => Array.from(rows.reduce((map, lead) => {
      const key = getKey(lead) || 'Não informado';
      const current = map.get(key) || { [labelKey]: key, name: key, value: 0, rows: [] };
      current.value += 1;
      current.rows.push(lead);
      map.set(key, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    const leadGroup = (name, rows) => ({ name, value: rows.length, rows });
    const boolRows = (field, expected) => interestRecords.filter((lead) => lead[field] === expected);
    const withValidPhone = interestRecords.filter((lead) => lead.temTelefone && lead.telefoneValido);
    const withInvalidPhone = interestRecords.filter((lead) => lead.temTelefone && !lead.telefoneValido);
    const withoutPhone = interestRecords.filter((lead) => !lead.temTelefone);
    const withValidEmail = interestRecords.filter((lead) => lead.temEmail && lead.emailValido);
    const withInvalidEmail = interestRecords.filter((lead) => lead.temEmail && !lead.emailValido);
    const withoutEmail = interestRecords.filter((lead) => !lead.temEmail);
    const pilotChannelRanking = countBy(interestRecords, (lead) => lead.canal || 'Sem canal registrado');
    const pilotCityRanking = countBy(interestRecords, (lead) => lead.cidade || 'Não informado');
    const pilotNeighborhoodRanking = countBy(interestRecords, (lead) => lead.bairro || 'Não informado');
    const pilotMaterialRanking = countBy(interestRecords, (lead) => lead.materialPrincipal || 'Não informado');
    const pilotMaterialQuantity = [
      leadGroup('1 material', interestRecords.filter((lead) => Number(lead.materiaisQuantidade) === 1)),
      leadGroup('2 materiais', interestRecords.filter((lead) => Number(lead.materiaisQuantidade) === 2)),
      leadGroup('3 ou mais', interestRecords.filter((lead) => Number(lead.materiaisQuantidade) >= 3)),
      leadGroup('Sem material', interestRecords.filter((lead) => !Number(lead.materiaisQuantidade)))
    ];
    const pilotValidContactGroups = [
      leadGroup('Telefone e e-mail válidos', interestRecords.filter((lead) => lead.telefoneValido && lead.emailValido)),
      leadGroup('Só telefone válido', interestRecords.filter((lead) => lead.telefoneValido && !lead.emailValido)),
      leadGroup('Só e-mail válido', interestRecords.filter((lead) => !lead.telefoneValido && lead.emailValido)),
      leadGroup('Sem contato válido', interestRecords.filter((lead) => !lead.telefoneValido && !lead.emailValido))
    ];

    return {
      funnel: (data?.campaignTrend || []).map((item) => ({ ...item, taxa: pct(item.leads, total) })),
      whatsapp: [
        { name: 'Com WhatsApp', value: data?.phone || 0 },
        { name: 'Sem WhatsApp', value: Math.max(total - (data?.phone || 0), 0) }
      ],
      emailGroups,
      emailWhatsappGroups,
      ageGroups: [
        { name: 'Até 17', value: ageBuckets.ate17 },
        { name: '18-24', value: ageBuckets.de18a24 },
        { name: '25-34', value: ageBuckets.de25a34 },
        { name: '35-44', value: ageBuckets.de35a44 },
        { name: '45-59', value: ageBuckets.de45a59 },
        { name: '60+', value: ageBuckets.acima60 },
        { name: 'Sem idade', value: ageBuckets.semInfo }
      ],
      genders: [
        { name: 'Homens', value: genderCounts.masculino },
        { name: 'Mulheres', value: genderCounts.feminino },
        { name: 'Não informado', value: genderCounts.naoInformado }
      ],
      materialTypes: Object.entries(materialTypeCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      composition: [
        { name: 'Com WhatsApp', value: data?.phone || 0 },
        { name: 'Sem WhatsApp', value: Math.max(total - (data?.phone || 0), 0) },
        { name: 'VIPs', value: data?.vip || 0 },
        { name: 'Estudos', value: data?.studies || 0 }
      ],
      priorities: [
        { name: 'Quentes', value: priorityCounts.Hot || 0 },
        { name: 'Potenciais', value: priorityCounts.Warm || 0 },
        { name: 'Frios', value: priorityCounts.Cool || 0 },
        { name: 'Sem prioridade', value: priorityCounts.none || 0 }
      ],
      districtMix,
      recency: [
        { name: 'Contato recente', value: recency.recentes },
        { name: 'Acima de 1 ano', value: recency.antigos },
        { name: 'Sem informação', value: recency.semInfo }
      ],
      addressRankingAll: Array.from(addressMap.values())
        .filter((item) => item.leads > 1)
        .sort((a, b) => b.leads - a.leads || a.address.localeCompare(b.address)),
      materialRankingAll: Array.from(materialNameMap.values())
        .sort((a, b) => b.recebidos - a.recebidos || b.leads - a.leads || a.name.localeCompare(b.name)),
      birthdaysByMonth,
      recentContactsAll: records
        .filter((lead) => Number.isFinite(Number(lead.c)))
        .sort((a, b) => Number(a.c) - Number(b.c)),
      conversion: [
        { name: 'WhatsApp', value: pct(data?.phone || 0, total) },
        { name: 'Quentes', value: pct(data?.hot || 0, total) },
        { name: 'VIPs', value: pct(data?.vip || 0, total) },
        { name: 'Estudos', value: pct(data?.studies || 0, total) }
      ],
      pilot: {
        total: interestRecords.length,
        resultFunnel: [
          { name: 'Base', value: interestRecords.length },
          { name: 'Tentativa', value: boolRows('tentativaContato', true).length },
          { name: 'Respondeu', value: boolRows('respondeu', true).length },
          { name: 'Interesse', value: boolRows('demonstrouInteresse', true).length },
          { name: 'Aceitou visita', value: boolRows('aceitouVisita', true).length },
          { name: 'Participou', value: boolRows('participou', true).length }
        ],
        phoneQuality: [
          leadGroup('Telefone válido', withValidPhone),
          leadGroup('Telefone inválido', withInvalidPhone),
          leadGroup('Sem telefone', withoutPhone)
        ],
        emailQuality: [
          leadGroup('E-mail válido', withValidEmail),
          leadGroup('E-mail inválido', withInvalidEmail),
          leadGroup('Sem e-mail', withoutEmail)
        ],
        contactQuality: pilotValidContactGroups,
        description: [
          leadGroup('Com descrição', interestRecords.filter((lead) => lead.temDescricao)),
          leadGroup('Sem descrição', interestRecords.filter((lead) => !lead.temDescricao))
        ],
        vipHistory: [
          leadGroup('VIP histórico', interestRecords.filter((lead) => lead.vipHistorico)),
          leadGroup('Não VIP', interestRecords.filter((lead) => !lead.vipHistorico))
        ],
        attempts: [
          leadGroup('Tentativa registrada', boolRows('tentativaContato', true)),
          leadGroup('Sem tentativa', interestRecords.filter((lead) => lead.tentativaContato !== true))
        ],
        responses: [
          leadGroup('Respondeu', boolRows('respondeu', true)),
          leadGroup('Não respondeu', boolRows('respondeu', false)),
          leadGroup('Sem informação', interestRecords.filter((lead) => lead.respondeu === null || lead.respondeu === undefined))
        ],
        interest: [
          leadGroup('Demonstrou interesse', boolRows('demonstrouInteresse', true)),
          leadGroup('Não demonstrou', boolRows('demonstrouInteresse', false)),
          leadGroup('Sem informação', interestRecords.filter((lead) => lead.demonstrouInteresse === null || lead.demonstrouInteresse === undefined))
        ],
        visits: [
          leadGroup('Aceitou visita', boolRows('aceitouVisita', true)),
          leadGroup('Não aceitou', boolRows('aceitouVisita', false)),
          leadGroup('Sem informação', interestRecords.filter((lead) => lead.aceitouVisita === null || lead.aceitouVisita === undefined))
        ],
        participation: [
          leadGroup('Participou', boolRows('participou', true)),
          leadGroup('Não participou', boolRows('participou', false)),
          leadGroup('Sem informação', interestRecords.filter((lead) => lead.participou === null || lead.participou === undefined))
        ],
        channels: pilotChannelRanking,
        cities: pilotCityRanking,
        neighborhoods: pilotNeighborhoodRanking,
        materials: pilotMaterialRanking,
        materialQuantity: pilotMaterialQuantity
      }
    };
  }, [data, records, interestRecords]);

  const chartTooltip = {
    background: '#020617',
    border: '1px solid rgba(226,232,240,0.16)',
    borderRadius: 12,
    color: '#e2e8f0'
  };
  const emptyData = !records.length && !(data?.total || 0);
  const addressRanking = analytics.addressRankingAll.slice(0, 8);
  const materialRanking = analytics.materialRankingAll.slice(0, 8);
  const recentContacts = analytics.recentContactsAll.slice(0, 10);
  const rankingButtonClass = 'group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-950/72 via-slate-900/46 to-white/[0.035] p-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition duration-300 hover:-translate-y-1 hover:border-blue-300/45 hover:shadow-[0_24px_60px_rgba(37,99,235,0.18)] focus:outline-none focus:ring-4 focus:ring-blue-500/18';
  const rankingNumberClass = 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.24)] ring-1 ring-slate-900/5';
  const seeAllButtonClass = 'inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-xs font-black uppercase tracking-wide text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15';
  const openRanking = (ranking) => setSelectedRanking(ranking);
  const openAddressRanking = () => openRanking({
    type: 'addresses',
    kicker: 'Ranking de endereços',
    title: 'Todos os endereços repetidos',
    subtitle: 'Sequência completa dos endereços com mais de um lead vinculado.',
    rows: analytics.addressRankingAll
  });
  const openMaterialRanking = () => openRanking({
    type: 'materials',
    kicker: 'Ranking de materiais',
    title: 'Todos os materiais recebidos',
    subtitle: 'Sequência completa dos materiais, ordenada pela quantidade recebida.',
    rows: analytics.materialRankingAll
  });
  const openBirthdayRanking = () => openRanking({
    type: 'birthdays',
    kicker: 'Aniversariantes',
    title: 'Todos os aniversariantes',
    subtitle: 'Sequência completa por mês, com nome e data completa de aniversário.',
    rows: analytics.birthdaysByMonth.flatMap((month) => month.leads.map((lead) => ({ ...lead, month })))
  });
  const openRecentContactRanking = () => openRanking({
    type: 'recentContacts',
    kicker: 'Ranking de contato',
    title: 'Leads por contato recente',
    subtitle: 'Lista completa do contato mais recente para o mais distante. Use a pesquisa para limitar por dia, mês ou ano.',
    rows: analytics.recentContactsAll
  });
  const openLeadGroup = (kicker, group) => openRanking({
    type: 'leadList',
    kicker,
    title: group.name,
    subtitle: `${formatNumber(group.value)} leads encontrados neste grupo.`,
    rows: group.rows
  });
  const openPilotRanking = (kicker, title, rows) => openRanking({
    kicker,
    title,
    subtitle: 'Ranking calculado diretamente do arquivo de interessados de Alphaville.',
    rows: rows.map((item) => ({
      title: item.name,
      subtitle: `${formatNumber(item.value)} leads vinculados`,
      metric: formatNumber(item.value),
      details: item.rows.slice(0, 8).map((lead) => lead.n).filter(Boolean),
      leadRows: item.rows
    }))
  });

  function ContactSegmentCard({ kicker, title, groups, tone = 'blue' }) {
    const total = groups.reduce((sum, group) => sum + group.value, 0);
    const tones = {
      blue: ['bg-blue-600', 'hover:border-blue-300/55'],
      emerald: ['bg-emerald-600', 'hover:border-emerald-300/55'],
      violet: ['bg-violet-600', 'hover:border-violet-300/55']
    };
    const [barTone, hoverTone] = tones[tone] || tones.blue;

    return (
      <article className={`${panelClass} p-5`}>
        <span className={labelClass}>{kicker}</span>
        <h3 className="mt-1 text-lg font-black text-slate-50">{title}</h3>
        <div className="mt-5 grid gap-3">
          {groups.map((group) => {
            const percent = pct(group.value, total);
            return (
              <button
                className={`group rounded-2xl border border-white/[0.08] bg-slate-950/42 p-4 text-left transition duration-300 hover:-translate-y-0.5 ${hoverTone} hover:shadow-[0_18px_42px_rgba(37,99,235,0.16)]`}
                key={group.name}
                onClick={() => openLeadGroup(kicker, group)}
                type="button"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <strong className="block text-sm font-black text-slate-50">{group.name}</strong>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">{percent}% da base analisada</span>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-950 shadow-[0_12px_26px_rgba(255,255,255,0.16)]">{formatNumber(group.value)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${barTone} shadow-[0_0_24px_rgba(37,99,235,0.28)] transition-all duration-500`} style={{ width: `${Math.max(percent, group.value ? 3 : 0)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </article>
    );
  }

  function InsightRankingCard({ kicker, title, rows, tone = 'blue' }) {
    const colors = {
      blue: 'via-blue-300/75 bg-blue-600',
      emerald: 'via-emerald-300/75 bg-emerald-600',
      amber: 'via-amber-300/75 bg-amber-500',
      violet: 'via-violet-300/75 bg-violet-600'
    };
    const [lineTone, badgeTone] = (colors[tone] || colors.blue).split(' ');
    const topRows = rows.slice(0, 5);

    return (
      <article className={`${panelClass} p-6`}>
        <div className="flex items-start justify-between gap-4 max-sm:flex-col">
          <div>
            <span className={labelClass}>{kicker}</span>
            <h3 className="mt-1 text-xl font-black text-slate-50">{title}</h3>
          </div>
          <button className={seeAllButtonClass} onClick={() => openPilotRanking(kicker, title, rows)} type="button">Ver todos</button>
        </div>
        <div className="mt-5 grid gap-3">
          {topRows.length ? topRows.map((item, index) => (
            <button
              className={rankingButtonClass}
              key={`${title}-${item.name}`}
              onClick={() => openPilotRanking(kicker, title, rows)}
              type="button"
            >
              <span className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${lineTone} to-transparent opacity-0 transition group-hover:opacity-100`} />
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                <span className={rankingNumberClass}>#{index + 1}</span>
                <div className="min-w-0">
                  <strong className="block truncate text-base font-black text-slate-50">{item.name}</strong>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-400">
                    {item.rows.slice(0, 3).map((lead) => lead.n).join(', ') || 'Sem nomes vinculados'}
                  </span>
                </div>
                <span className={`rounded-full ${badgeTone} px-3 py-1 text-xs font-black text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)]`}>{formatNumber(item.value)}</span>
              </div>
            </button>
          )) : (
            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5 text-sm font-semibold text-slate-400">
              Nenhum dado real encontrado nesta dimensão.
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="grid gap-4">
      {!onlyPilot ? (
        <>
      <div className="flex items-end justify-between gap-4 max-md:flex-col max-md:items-start">
        <div>
          <span className={labelClass}>Análise dos leads</span>
          <h2 className="mt-1 text-2xl font-black text-slate-50">Leitura operacional da base</h2>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-300">
          {emptyData ? 'Sem dados reais' : `${formatNumber(data.total)} registros reais`}
        </span>
      </div>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-4 max-xl:grid-cols-1">
        <article className={`${panelClass} p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <span className={labelClass}>Funil</span>
              <h3 className="mt-1 text-xl font-black text-slate-50">Aquecimento dos interessados</h3>
            </div>
            <Gauge className="text-blue-300" size={22} />
          </div>
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={analytics.funnel}>
                <defs>
                  <linearGradient id="leadAnalyticsFunnel" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                <XAxis dataKey="etapa" stroke="#94a3b8" tickLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatNumber} tickLine={false} width={70} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Area dataKey="leads" fill="url(#leadAnalyticsFunnel)" stroke="#60a5fa" strokeWidth={3} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${panelClass} p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <span className={labelClass}>Cobertura</span>
              <h3 className="mt-1 text-xl font-black text-slate-50">Taxas por etapa</h3>
            </div>
            <CheckCircle2 className="text-emerald-300" size={22} />
          </div>
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.conversion}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" tickFormatter={(value) => `${value}%`} tickLine={false} width={48} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => `${value}%`} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#22c55e" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Composição</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Base por situação</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.composition} layout="vertical" margin={{ left: 6, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={98} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#38bdf8" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Prioridade</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Classificação ML</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.priorities} layout="vertical" margin={{ left: 6, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={102} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#f97316" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Distritos</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Concentração operacional</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.districtMix} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={92} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="interessados" fill="#2563eb" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Recência</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Tempo desde contato</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.recency} layout="vertical" margin={{ left: 6, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={108} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#a855f7" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>WhatsApp</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Registrados e pendentes</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.whatsapp} layout="vertical" margin={{ left: 6, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={104} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <ContactSegmentCard
          groups={analytics.emailGroups}
          kicker="E-mail"
          title="Registrados e pendentes"
          tone="blue"
        />

        <ContactSegmentCard
          groups={analytics.emailWhatsappGroups}
          kicker="Contato completo"
          title="E-mail e WhatsApp"
          tone="emerald"
        />

        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Idade</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Faixas etárias</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.ageGroups}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                <XAxis dataKey="name" interval={0} stroke="#94a3b8" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatNumber} tickLine={false} width={48} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Perfil</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Homens versus mulheres</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.genders} layout="vertical" margin={{ left: 6, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={104} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${panelClass} p-5`}>
          <span className={labelClass}>Materiais</span>
          <h3 className="mt-1 text-lg font-black text-slate-50">Tipos de estudos bíblicos</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={analytics.materialTypes} layout="vertical" margin={{ left: 6, right: 8 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} type="category" width={98} />
                <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
        </>
      ) : null}

      {analytics.pilot.total ? (
        <div className="grid gap-4">
          <div className="flex items-end justify-between gap-4 max-md:flex-col max-md:items-start">
            <div>
              <span className={labelClass}>Base piloto Alphaville</span>
              <h2 className="mt-1 text-2xl font-black text-slate-50">Inteligência dos campos ainda não explorados</h2>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950">
              {formatNumber(analytics.pilot.total)} registros reais
            </span>
          </div>

          <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 max-xl:grid-cols-1">
            <article className={`${panelClass} p-6`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <span className={labelClass}>Resultados</span>
                  <h3 className="mt-1 text-xl font-black text-slate-50">Funil operacional do acompanhamento</h3>
                </div>
                <ClipboardList className="text-blue-300" size={22} />
              </div>
              <div className="h-72">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={analytics.pilot.resultFunnel}>
                    <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                    <XAxis dataKey="name" interval={0} stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis stroke="#94a3b8" tickFormatter={formatNumber} tickLine={false} width={48} />
                    <Tooltip contentStyle={chartTooltip} formatter={(value) => formatNumber(value)} itemStyle={{ color: '#fff' }} />
                    <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <ContactSegmentCard
              groups={analytics.pilot.contactQuality}
              kicker="Contato válido"
              title="Canais realmente aproveitáveis"
              tone="emerald"
            />
          </div>

          <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
            <ContactSegmentCard groups={analytics.pilot.phoneQuality} kicker="Telefone" title="Qualidade do telefone" tone="blue" />
            <ContactSegmentCard groups={analytics.pilot.emailQuality} kicker="E-mail" title="Qualidade do e-mail" tone="emerald" />
            <ContactSegmentCard groups={analytics.pilot.description} kicker="Descrição" title="Com e sem descrição" tone="violet" />
            <ContactSegmentCard groups={analytics.pilot.vipHistory} kicker="Histórico VIP" title="Marcadores históricos" tone="blue" />
          </div>

          <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
            <ContactSegmentCard groups={analytics.pilot.attempts} kicker="Tentativas" title="Contato iniciado" tone="blue" />
            <ContactSegmentCard groups={analytics.pilot.responses} kicker="Respostas" title="Resposta do lead" tone="emerald" />
            <ContactSegmentCard groups={analytics.pilot.interest} kicker="Interesse" title="Sinal de interesse" tone="violet" />
            <ContactSegmentCard groups={analytics.pilot.visits} kicker="Visitas" title="Aceite de visita" tone="blue" />
          </div>

          <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
            <ContactSegmentCard groups={analytics.pilot.participation} kicker="Participação" title="Presença registrada" tone="emerald" />
            <ContactSegmentCard groups={analytics.pilot.materialQuantity} kicker="Materiais" title="Quantidade por lead" tone="violet" />
            <InsightRankingCard kicker="Canais" title="Canais de tentativa" rows={analytics.pilot.channels} tone="blue" />
            <InsightRankingCard kicker="Material principal" title="Interesse por material" rows={analytics.pilot.materials} tone="amber" />
          </div>

          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
            <InsightRankingCard kicker="Cidades" title="Concentração por cidade" rows={analytics.pilot.cities} tone="emerald" />
            <InsightRankingCard kicker="Bairros" title="Concentração por bairro" rows={analytics.pilot.neighborhoods} tone="blue" />
            <InsightRankingCard kicker="Materiais" title="Materiais principais" rows={analytics.pilot.materials} tone="violet" />
          </div>
        </div>
      ) : null}

      {!onlyPilot ? (
        <>
      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <article className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div>
              <span className={labelClass}>Ranking de endereços</span>
              <h3 className="mt-1 text-xl font-black text-slate-50">Leads com o mesmo endereço</h3>
            </div>
            <button className={seeAllButtonClass} onClick={openAddressRanking} type="button">Ver todos</button>
          </div>
          <div className="mt-5 grid gap-3">
            {addressRanking.length ? addressRanking.map((item, index) => (
              <button
                className={rankingButtonClass}
                key={item.address}
                onClick={openAddressRanking}
                type="button"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4">
                  <span className={rankingNumberClass}>#{index + 1}</span>
                  <div className="min-w-0">
                    <strong className="block break-words text-base font-black text-slate-50">{item.address}</strong>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-400">{item.names.join(', ') || 'Sem nomes vinculados'}</span>
                  </div>
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white shadow-[0_12px_28px_rgba(37,99,235,0.26)]">{formatNumber(item.leads)}</span>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5 text-sm font-semibold text-slate-400">
                Nenhum endereço repetido encontrado na base atual.
              </div>
            )}
          </div>
        </article>

        <article className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div>
              <span className={labelClass}>Ranking de materiais</span>
              <h3 className="mt-1 text-xl font-black text-slate-50">Materiais recebidos</h3>
            </div>
            <button className={seeAllButtonClass} onClick={openMaterialRanking} type="button">Ver todos</button>
          </div>
          <div className="mt-5 grid gap-3">
            {materialRanking.length ? materialRanking.map((item, index) => (
              <button
                className={rankingButtonClass}
                key={item.name}
                onClick={openMaterialRanking}
                type="button"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/75 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                  <span className={rankingNumberClass}>#{index + 1}</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-base font-black text-slate-50">{item.name}</strong>
                    <span className="mt-1 block text-xs font-semibold text-slate-400">{formatNumber(item.leads)} leads vinculados</span>
                  </div>
                  <strong className="rounded-2xl bg-slate-950 px-4 py-2 text-2xl font-black text-amber-200 shadow-[0_14px_30px_rgba(15,23,42,0.22)]">{formatNumber(item.recebidos)}</strong>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5 text-sm font-semibold text-slate-400">
                Nenhum material recebido registrado na base atual.
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 max-xl:grid-cols-1">
        <article className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div>
              <span className={labelClass}>Aniversariantes</span>
              <h3 className="mt-1 text-xl font-black text-slate-50">Leads por mês do ano</h3>
            </div>
            <button className={seeAllButtonClass} onClick={openBirthdayRanking} type="button">Ver todos</button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 max-2xl:grid-cols-2 max-md:grid-cols-1">
            {analytics.birthdaysByMonth.map((month) => (
              <button
                className={rankingButtonClass}
                key={month.month}
                onClick={() => openRanking({
                  kicker: 'Aniversariantes',
                  title: month.month,
                  subtitle: `${formatNumber(month.leads.length)} aniversariantes registrados em ${month.month}.`,
                  rows: month.leads.map((lead) => ({
                    title: lead.name,
                    subtitle: lead.date,
                    metric: `${String(lead.day).padStart(2, '0')}/${String(analytics.birthdaysByMonth.findIndex((item) => item.month === month.month) + 1).padStart(2, '0')}`
                  }))
                })}
                type="button"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/75 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-black text-slate-50">{month.month}</strong>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.18)]">{formatNumber(month.leads.length)}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {month.leads.slice(0, 5).map((lead) => (
                    <div className="rounded-xl bg-white/[0.045] px-3 py-2" key={`${month.month}-${lead.id}-${lead.date}`}>
                      <span className="block truncate text-xs font-black text-slate-100">{lead.name}</span>
                      <span className="block text-[11px] font-semibold text-slate-500">{lead.date}</span>
                    </div>
                  ))}
                  {!month.leads.length ? <span className="text-xs font-semibold text-slate-500">Sem aniversariantes registrados.</span> : null}
                  {month.leads.length > 5 ? <span className="text-[11px] font-bold text-slate-500">+{formatNumber(month.leads.length - 5)} outros</span> : null}
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div>
              <span className={labelClass}>Ranking de contato</span>
              <h3 className="mt-1 text-xl font-black text-slate-50">Leads por contato recente</h3>
            </div>
            <button className={seeAllButtonClass} onClick={openRecentContactRanking} type="button">Ver todos</button>
          </div>
          <div className="mt-5 grid gap-3">
            {recentContacts.length ? recentContacts.map((lead, index) => (
              <button
                className={rankingButtonClass}
                key={`${lead.id}-${lead.c}`}
                onClick={openRecentContactRanking}
                type="button"
              >
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span className={rankingNumberClass}>#{index + 1}</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-black text-slate-50">{lead.n || 'Lead sem nome'}</strong>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-400">{lead.d || 'Distrito não informado'} · {lead.tel || 'sem telefone'}</span>
                  </div>
                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)]">{formatNumber(lead.c)} dias</span>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5 text-sm font-semibold text-slate-400">
                Nenhum contato com data registrada na base atual.
              </div>
            )}
          </div>
        </article>
      </div>
        </>
      ) : null}
      <AnalyticsRankingModal ranking={selectedRanking} onClose={() => setSelectedRanking(null)} />
    </section>
  );
}

function AssociationDashboard({ association, data, records = [], interestRecords = [], onDatasetUpdated, onOpenDetails, onOpenHistory, user }) {
  const automations = [];

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="grid grid-cols-[1.1fr_0.9fr] gap-6 max-xl:grid-cols-1">
          <div>
            <span className={labelClass}>Visão executiva</span>
            <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-normal text-slate-50 max-md:text-3xl">Central de aquecimento dos interessados</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
              {association.name} concentra campanhas, automações de WhatsApp, prioridades por distrito e acompanhamento de visitas em um fluxo único.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className={primaryButtonClass} onClick={onOpenDetails} type="button">
                Análise dos Potenciais
                <ArrowRight size={18} />
              </button>
              <button
                className={ghostButtonClass}
                onClick={() => toast.success('Sequência preparada', {
                  description: 'A criação de fluxos WhatsApp será ligada aos templates aprovados da campanha.'
                })}
                type="button"
              >
                <Send size={18} />
                Nova sequência WhatsApp
              </button>
              <button className={ghostButtonClass} onClick={onOpenHistory} type="button">
                <ClipboardList size={18} />
                Historico das atualizacoes
              </button>
            </div>
          </div>
          <div className="interactive-card min-h-64 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-4 transition duration-300 hover:border-slate-200/25">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={data.campaignTrend}>
                <defs>
                  <linearGradient id="associationLeadGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                <XAxis dataKey="etapa" stroke="#94a3b8" tickLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatNumber} tickLine={false} width={70} />
                <Tooltip cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '4 4' }} contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} itemStyle={{ color: '#fff' }} formatter={(value) => formatNumber(value)} />
                <Area dataKey="leads" fill="url(#associationLeadGradient)" stroke="#93c5fd" strokeWidth={3} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard detail={`em ${data.districts} distritos`} icon={UsersRound} label="Interessados" value={formatNumber(data.total)} />
        <MetricCard detail={`${pct(data.phone, data.total)}% com telefone`} icon={MessageCircle} label="Com WhatsApp" tone="green" value={formatNumber(data.phone)} />
        <MetricCard detail={`${pct(data.hot, data.total)}% para ação rápida`} icon={Sparkles} label="Quentes" tone="orange" value={formatNumber(data.hot)} />
        <MetricCard detail={`${pct(data.vip, data.total)}% da base`} icon={CheckCircle2} label="VIPs" tone="violet" value={formatNumber(data.vip)} />
        <MetricCard detail={`${pct(data.studies, data.total)}% em andamento`} icon={ClipboardList} label="Estudos ativos" value={formatNumber(data.studies)} />
      </section>

      <DatasetUploadPanel association={association} onUpdated={onDatasetUpdated} user={user} />

      <LeadAnalyticsSection data={data} records={records} interestRecords={interestRecords} />

      <section className="grid grid-cols-[1.15fr_0.85fr] gap-4 max-xl:grid-cols-1">
        <article className={`${panelClass} p-6`}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <span className={labelClass}>Campanhas</span>
              <h2 className="mt-1 text-xl font-black text-slate-50">Ambientes de captação</h2>
            </div>
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">{association.name}</span>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5">
            <span className={labelClass}>Campanhas cadastradas</span>
            <strong className="mt-2 block text-3xl font-black text-slate-50">0</strong>
            <span className="mt-2 block text-sm leading-relaxed text-slate-400">Nenhuma campanha real cadastrada para esta associacao.</span>
          </div>
        </article>

        <article className={`${panelClass} p-6`}>
          <span className={labelClass}>Top distritos</span>
          <h2 className="mt-1 text-xl font-black text-slate-50">Volume de interessados</h2>
          <div className="mt-5 h-80">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data.topDistricts} layout="vertical" margin={{ left: 12, right: 16 }}>
                <CartesianGrid stroke="rgba(226,232,240,0.08)" horizontal={false} />
                <XAxis hide type="number" />
                <YAxis dataKey="name" stroke="#94a3b8" tickLine={false} type="category" width={115} />
                <Tooltip cursor={false} contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} itemStyle={{ color: '#fff' }} formatter={(value) => formatNumber(value)} />
                <Bar activeBar={false} className="transition duration-300" dataKey="interessados" fill="#cbd5e1" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className={`${panelClass} p-6`}>
        <div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
          <div>
            <span className={labelClass}>WhatsApp CRM</span>
            <h2 className="mt-1 text-xl font-black text-slate-50">Automações de aquecimento</h2>
          </div>
          <button
            className={ghostButtonClass}
            onClick={() => toast.info('Configuração do funil', {
              description: 'A próxima etapa conectará gatilhos, templates e regras de resposta por campanha.'
            })}
            type="button"
          >
            <LayoutDashboard size={17} />
            Configurar funil
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          {automations.length ? automations.map((automation) => (
            <div className={`interactive-card rounded-2xl border ${automation.color} p-5`} key={automation.name}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <strong className="text-slate-100">{automation.name}</strong>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${automation.status === 'Ativa' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>{automation.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={labelClass}>Enviadas</span>
                  <strong className="mt-1 block text-2xl font-black text-slate-50">{formatNumber(automation.sent)}</strong>
                </div>
                <div>
                  <span className={labelClass}>Resposta</span>
                  <strong className="mt-1 block text-2xl font-black text-slate-50">{automation.response}</strong>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5 text-sm font-semibold text-slate-400 max-lg:col-span-1 lg:col-span-3">
              Nenhuma automacao real cadastrada ainda.
            </div>
          )}
        </div>
      </section>

      <AssociationLeadExplorer association={association} records={records} />
    </div>
  );
}

function leadNeighborhood(lead) {
  const parts = String(lead?.end || '').split(' - ').map((part) => part.trim()).filter(Boolean);
  return parts[1] || 'Nao informado';
}

function leadMaterial(lead) {
  return lead?.materialName || lead?.tm || 'Nao informado';
}

function leadAgeGroup(lead) {
  const age = Number(lead?.a);
  if (!Number.isFinite(age) || age <= 0) return 'Sem idade';
  if (age <= 17) return 'Ate 17';
  if (age <= 29) return '18 a 29';
  if (age <= 44) return '30 a 44';
  if (age <= 59) return '45 a 59';
  return '60+';
}

function leadGenderLabel(value) {
  if (value === 'F') return 'Feminino';
  if (value === 'M') return 'Masculino';
  return 'Nao informado';
}

function escapeMapHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

const cityMapCenters = {
  'sao-paulo': [-23.55052, -46.63331],
  osasco: [-23.53288, -46.79178],
  carapicuiba: [-23.52272, -46.835],
  barueri: [-23.51056, -46.87611],
  jandira: [-23.5275, -46.9025],
  itapevi: [-23.5488, -46.9336],
  cotia: [-23.6039, -46.9192],
  ibiuna: [-23.6596, -47.222],
  mairinque: [-23.5458, -47.1833],
  'sao-roque': [-23.5292, -47.1353],
  'santana-de-parnaiba': [-23.4439, -46.9178],
  aracariguama: [-23.4366, -47.0608],
  aluminio: [-23.5306, -47.2547],
  mirandopolis: [-23.6093, -46.6413]
};

function stableHash(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function slugForMap(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cityFromAddress(lead) {
  const address = String(lead?.addr || '');
  const parts = address.split(' - ').map((part) => part.trim()).filter(Boolean);
  const stateIndex = parts.findIndex((part) => /^[A-Z]{2}$/.test(part));
  if (stateIndex > 0) return parts[stateIndex - 1];
  const compactParts = String(lead?.end || '').split(' - ').map((part) => part.trim()).filter(Boolean);
  return compactParts[0] || lead?.d || 'Sao Paulo';
}

function fullLeadAddress(lead) {
  const fullAddress = String(lead?.addr || '').trim();
  if (fullAddress && fullAddress !== 'N/I') return fullAddress;
  const compactAddress = String(lead?.end || '').trim();
  const neighborhood = leadNeighborhood(lead);
  const parts = [compactAddress, neighborhood, lead?.d, 'SP', 'Brasil']
    .filter((part, index, list) => {
      const value = String(part || '').trim();
      return value && value !== 'N/I' && list.findIndex((item) => String(item || '').trim() === value) === index;
    });
  return parts.join(' - ') || 'Endereco nao informado';
}

function approximateLeadPoint(lead) {
  if (Number.isFinite(Number(lead?.lat)) && Number.isFinite(Number(lead?.lng))) {
    const precisionText = String(lead?.geoPrecision || lead?.geoSource || '').toLowerCase();
    return {
      lat: Number(lead.lat),
      lng: Number(lead.lng),
      precision: precisionText.includes('aproximado') || precisionText.includes('fallback') ? 'Aproximado' : 'Endereco'
    };
  }
  const city = cityFromAddress(lead);
  const center = cityMapCenters[slugForMap(city)] || cityMapCenters[slugForMap(lead?.d)] || cityMapCenters['sao-paulo'];
  const hash = stableHash(`${lead?.d}|${leadNeighborhood(lead)}|${lead?.addr}|${lead?.id}`);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.004 + ((hash % 900) / 100000);
  return {
    lat: center[0] + Math.sin(angle) * radius,
    lng: center[1] + Math.cos(angle) * radius,
    precision: 'Aproximado'
  };
}

function openStreetMapSearchUrl(lead) {
  const query = [fullLeadAddress(lead), lead?.d, 'SP', 'Brasil'].filter(Boolean).join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function googleMapsSearchUrl(lead) {
  const query = [fullLeadAddress(lead), lead?.d, 'SP', 'Brasil'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function churchMapSearchUrl(church, provider = 'osm') {
  const query = [church?.address, church?.name, church?.districtName, 'SP', 'Brasil']
    .filter(Boolean)
    .join(', ');
  if (provider === 'google') return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

const leadMapPriorityStyles = {
  Hot: { label: 'Quente', color: '#dc2626' },
  Warm: { label: 'Potencial', color: '#f97316' },
  Cool: { label: 'Morno', color: '#2563eb' },
  Cold: { label: 'Frio', color: '#334155' }
};

function leadMapPriorityStyle(priority) {
  return leadMapPriorityStyles[priority] || leadMapPriorityStyles.Cold;
}

function churchMapPoint(church, districtLeadPoints = {}) {
  if (church?.lat !== null && church?.lat !== undefined && church?.lng !== null && church?.lng !== undefined && Number.isFinite(Number(church.lat)) && Number.isFinite(Number(church.lng))) {
    const precisionText = String(church?.geoPrecision || '').toLowerCase();
    return {
      lat: Number(church.lat),
      lng: Number(church.lng),
      precision: precisionText.includes('aproximado') ? 'Aproximado' : 'Endereco'
    };
  }
  const districtSlug = church?.districtSlug || slugifyDistrictName(church?.districtName);
  const districtPoints = districtLeadPoints[districtSlug] || [];
  const center = districtPoints.length
    ? [
        districtPoints.reduce((sum, point) => sum + point.lat, 0) / districtPoints.length,
        districtPoints.reduce((sum, point) => sum + point.lng, 0) / districtPoints.length
      ]
    : (cityMapCenters[slugForMap(church?.districtName)] || cityMapCenters['sao-paulo']);
  const hash = stableHash(`${church?.districtName}|${church?.name}`);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.002 + ((hash % 450) / 100000);
  return {
    lat: center[0] + Math.sin(angle) * radius,
    lng: center[1] + Math.cos(angle) * radius,
    precision: 'Aproximado'
  };
}

function LeadsOpenStreetMap({ leads = [], churches = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState('idle');
  const [activeMapPriority, setActiveMapPriority] = useState('');
  const priorityCounts = useMemo(() => leads.reduce((counts, lead) => {
    const priority = leadMapPriorityStyles[lead.p] ? lead.p : 'Cold';
    return { ...counts, [priority]: (counts[priority] || 0) + 1 };
  }, {}), [leads]);
  const mappableLeads = useMemo(() => leads
    .filter((lead) => !activeMapPriority || lead.p === activeMapPriority || (activeMapPriority === 'Cold' && !leadMapPriorityStyles[lead.p]))
    .slice(0, 300)
    .map((lead) => ({
    lead,
    point: approximateLeadPoint(lead)
  })), [activeMapPriority, leads]);
  const churchPoints = useMemo(() => {
    const districtLeadPoints = mappableLeads.reduce((map, item) => {
      const slug = slugifyDistrictName(item.lead?.d);
      if (!map[slug]) map[slug] = [];
      map[slug].push(item.point);
      return map;
    }, {});
    const visibleDistricts = new Set(mappableLeads.map((item) => slugifyDistrictName(item.lead?.d)).filter(Boolean));
    return churches
      .filter((church) => !visibleDistricts.size || visibleDistricts.has(church.districtSlug || slugifyDistrictName(church.districtName)))
      .map((church) => ({
        church,
        point: churchMapPoint(church, districtLeadPoints)
      }));
  }, [churches, mappableLeads]);
  const sampleLead = mappableLeads[0];

  useEffect(() => {
    let active = true;
    if (!mapRef.current) {
      return () => { active = false; };
    }

    async function renderMap() {
      setStatus('loading');
      try {
        const L = await import('leaflet');
        if (!active) return;

        const map = mapInstanceRef.current || L.map(mapRef.current, {
          center: cityMapCenters['sao-paulo'],
          zoom: 10,
          scrollWheelZoom: true
        });
        if (!mapInstanceRef.current) {
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);
          mapInstanceRef.current = map;
        }

        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        const bounds = L.latLngBounds([]);

        for (const { lead, point } of mappableLeads) {
          const fullAddress = fullLeadAddress(lead);
          const precisionLabel = point.precision === 'Endereco' ? 'Endereco exato' : 'Ponto aproximado';
          const needsGoogleCheck = point.precision !== 'Endereco' || lead.geoNotFound;
          const precisionWarning = lead.geoNotFound
            ? 'Coordenada nao encontrada no OSM. Conferir ou corrigir endereco pelo Google Maps.'
            : 'Coordenada aproximada. Conferir precisao no Google Maps.';
          const priorityStyle = leadMapPriorityStyle(lead.p);
          const marker = L.circleMarker([point.lat, point.lng], {
            radius: lead.p === 'Hot' ? 8 : 7,
            color: '#ffffff',
            weight: 2,
            fillColor: priorityStyle.color,
            fillOpacity: 0.94
          }).addTo(map);
          marker.bindPopup(`
            <strong>${escapeMapHtml(lead.n || 'Lead')}</strong><br>
            <strong style="color:${priorityStyle.color}">${escapeMapHtml(priorityStyle.label)}</strong><br>
            ${escapeMapHtml(lead.d || '')}<br>
            ${escapeMapHtml(leadNeighborhood(lead))}<br>
            <span>${escapeMapHtml(fullAddress)}</span><br>
            ${escapeMapHtml(lead.tel || 'sem telefone')}<br>
            <small>${escapeMapHtml(precisionLabel)}</small><br>
            ${needsGoogleCheck ? `<small style="display:block;color:#b45309;font-weight:700;max-width:260px">${escapeMapHtml(precisionWarning)}</small>` : ''}
            <a href="${openStreetMapSearchUrl(lead)}" target="_blank" rel="noreferrer">Abrir endereco no OSM</a><br>
            <a href="${googleMapsSearchUrl(lead)}" target="_blank" rel="noreferrer">Abrir endereco no Google Maps (precisao)</a>
          `);
          markersRef.current.push(marker);
          bounds.extend([point.lat, point.lng]);
        }

        for (const { church, point } of churchPoints) {
          const precisionLabel = point.precision === 'Endereco' ? 'Endereco exato' : 'Distrito aproximado';
          const churchIcon = L.divIcon({
            className: 'church-map-marker',
            html: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v4"/><path d="M10 5h4"/><path d="M5 22V10l7-4 7 4v12"/><path d="M2 22h20"/><path d="M10 22v-5a2 2 0 0 1 4 0v5"/><path d="M9 13h6"/></svg>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
          });
          const churchMarker = L.marker([point.lat, point.lng], { icon: churchIcon }).addTo(map);
          churchMarker.bindPopup(`
            <strong>${escapeMapHtml(church.name || 'Igreja Adventista')}</strong><br>
            <strong style="color:#16a34a">Igreja Adventista</strong><br>
            ${escapeMapHtml(church.districtName || '')}<br>
            ${church.address ? `${escapeMapHtml(church.address)}<br>` : ''}
            <small>${escapeMapHtml(precisionLabel)}</small><br>
            <a href="${churchMapSearchUrl(church, 'osm')}" target="_blank" rel="noreferrer">Abrir igreja no OSM</a><br>
            <a href="${churchMapSearchUrl(church, 'google')}" target="_blank" rel="noreferrer">Abrir igreja no Google Maps (precisao)</a>
          `);
          markersRef.current.push(churchMarker);
          bounds.extend([point.lat, point.lng]);
        }

        if (mappableLeads.length) {
          const leadBounds = L.latLngBounds(mappableLeads.map(({ point }) => [point.lat, point.lng]));
          map.fitBounds(leadBounds.pad(0.18), { maxZoom: 14 });
        } else if (churchPoints.length) {
          map.fitBounds(bounds.pad(0.18), { maxZoom: 14 });
        }
        else map.setView(cityMapCenters['sao-paulo'], 10);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    }

    renderMap();
    return () => { active = false; };
  }, [churchPoints, mappableLeads]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-white via-blue-50/70 to-emerald-50/70 p-5">
        <div>
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Mapa dos leads filtrados</span>
          <h3 className="mt-1 text-2xl font-black text-slate-950">Pontos com Leads</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(leadMapPriorityStyles).map(([key, item]) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeMapPriority === key}
              onClick={() => setActiveMapPriority((current) => (current === key ? '' : key))}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm transition ${
                activeMapPriority === key
                  ? 'border-slate-900 bg-slate-950 text-white'
                  : 'border-white/80 bg-white/85 text-slate-700 hover:border-blue-200 hover:bg-blue-50'
              }`}
              title={activeMapPriority === key ? 'Clique para mostrar todos' : `Mostrar somente ${item.label}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeMapPriority === key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {formatNumber(priorityCounts[key] || 0)}
              </span>
            </button>
          ))}
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 shadow-sm">
            <Church size={14} />
            Igrejas
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-emerald-700">{formatNumber(churchPoints.length)}</span>
          </span>
        </div>
        {sampleLead ? (
          <a className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800" href={openStreetMapSearchUrl(sampleLead.lead)} rel="noreferrer" target="_blank">
            <MapPin size={18} />
            Abrir no OSM
          </a>
        ) : null}
      </div>
      <div className="relative h-[28rem] bg-slate-100">
        <div className="h-full w-full" ref={mapRef} />
        {status === 'loading' ? (
          <div className="absolute inset-x-4 top-4 rounded-2xl border border-blue-200 bg-white/92 px-4 py-3 text-sm font-bold text-blue-900 shadow-lg backdrop-blur">
            Montando mapa sem custo por API...
          </div>
        ) : null}
        {status === 'error' ? (
          <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800 shadow-lg">
            Nao foi possivel carregar o mapa. Verifique a conexao com os blocos do OpenStreetMap.
          </div>
        ) : null}
        <div className="absolute bottom-4 left-4 max-w-xl rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-xs font-bold leading-relaxed text-amber-900 shadow-lg backdrop-blur">
          Sem geocodificacao paga: pontos aproximados por cidade, distrito e bairro. Quando houver latitude/longitude real importada, o mapa usa a posicao exata.
        </div>
      </div>
    </section>
  );
}

function topOptions(records, getValue, limit = null) {
  const counts = records.reduce((map, lead) => {
    const value = getValue(lead) || 'Nao informado';
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit || undefined);
}

function relatedDistrictsForNeighborhoods(records, neighborhoods) {
  if (!neighborhoods.length) return [];
  return Array.from(new Set(records
    .filter((lead) => neighborhoods.includes(leadNeighborhood(lead)))
    .map((lead) => lead.d)
    .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
}

function isApproximateGeo(item) {
  return Number.isFinite(Number(item?.lat))
    && Number.isFinite(Number(item?.lng))
    && /aproximado|fallback/i.test(String(item?.geoPrecision || item?.geoSource || ''));
}

function hasGeoPoint(item) {
  return Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng));
}

function geoStatusForItem(item) {
  if (!hasGeoPoint(item)) return item?.geoNotFound ? 'notFound' : 'pending';
  return isApproximateGeo(item) ? 'approximate' : 'exact';
}

function buildGeolocationDistricts(records = [], churchesByDistrict = {}, officialDistricts = []) {
  const districtNamesBySlug = officialDistricts.reduce((map, district) => ({
    ...map,
    [district.slug || slugifyDistrictName(district.name)]: district.name
  }), {});
  const byDistrict = new Map();
  const ensureDistrict = (name, slug = slugifyDistrictName(name)) => {
    const districtName = name || districtNamesBySlug[slug] || 'Sem distrito';
    if (!byDistrict.has(slug)) {
      byDistrict.set(slug, {
        slug,
        name: districtName,
        leads: [],
        churches: [],
        leadStats: { total: 0, exact: 0, approximate: 0, pending: 0, notFound: 0 },
        churchStats: { total: 0, exact: 0, approximate: 0, pending: 0 }
      });
    }
    return byDistrict.get(slug);
  };

  for (const district of officialDistricts || []) {
    ensureDistrict(district.name, district.slug || slugifyDistrictName(district.name));
  }

  for (const lead of records) {
    const district = ensureDistrict(lead.d);
    const status = geoStatusForItem(lead);
    district.leads.push({ ...lead, geoStatus: status });
    district.leadStats.total += 1;
    if (status === 'exact') district.leadStats.exact += 1;
    else if (status === 'approximate') district.leadStats.approximate += 1;
    else if (status === 'notFound') {
      district.leadStats.notFound += 1;
      district.leadStats.pending += 1;
    } else district.leadStats.pending += 1;
  }

  for (const [districtSlug, churches] of Object.entries(churchesByDistrict || {})) {
    const district = ensureDistrict(districtNamesBySlug[districtSlug] || districtSlug, districtSlug);
    for (const church of churches || []) {
      const status = geoStatusForItem(church);
      district.churches.push({ ...church, geoStatus: status });
      district.churchStats.total += 1;
      if (status === 'exact') district.churchStats.exact += 1;
      else if (status === 'approximate') district.churchStats.approximate += 1;
      else district.churchStats.pending += 1;
    }
  }

  return Array.from(byDistrict.values())
    .map((district) => ({
      ...district,
      leads: district.leads.sort((a, b) => String(a.n || '').localeCompare(String(b.n || ''))),
      churches: district.churches.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    }))
    .sort((a, b) => (b.leadStats.pending + b.churchStats.pending) - (a.leadStats.pending + a.churchStats.pending) || a.name.localeCompare(b.name));
}

function statusLabel(status) {
  if (status === 'exact') return 'Exato';
  if (status === 'approximate') return 'Aproximado';
  if (status === 'notFound') return 'Sem resultado';
  return 'Pendente';
}

function GeolocationView({ churchesByDistrict = {}, officialDistricts = [], onBack, onDatasetUpdated, records = [] }) {
  const [selectedSlug, setSelectedSlug] = useState('');
  const [activeStatus, setActiveStatus] = useState('needs');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingLeadId, setUpdatingLeadId] = useState(null);
  const districts = useMemo(
    () => buildGeolocationDistricts(records, churchesByDistrict, officialDistricts),
    [churchesByDistrict, officialDistricts, records]
  );
  const selectedDistrict = districts.find((district) => district.slug === selectedSlug) || districts[0] || null;
  const totals = useMemo(() => districts.reduce((sum, district) => ({
    leads: sum.leads + district.leadStats.total,
    exact: sum.exact + district.leadStats.exact,
    approximate: sum.approximate + district.leadStats.approximate,
    pending: sum.pending + district.leadStats.pending,
    notFound: sum.notFound + district.leadStats.notFound,
    churches: sum.churches + district.churchStats.total,
    churchesPending: sum.churchesPending + district.churchStats.pending
  }), { leads: 0, exact: 0, approximate: 0, pending: 0, notFound: 0, churches: 0, churchesPending: 0 }), [districts]);

  useEffect(() => {
    if (!selectedSlug && districts[0]?.slug) setSelectedSlug(districts[0].slug);
  }, [districts, selectedSlug]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleDistricts = useMemo(() => {
    if (!normalizedSearch) return districts;
    return districts.filter((district) => {
      const districtMatches = district.name.toLowerCase().includes(normalizedSearch);
      const leadMatches = district.leads.some((lead) => `${lead.n || ''} ${lead.id || ''} ${leadNeighborhood(lead)} ${lead.tel || ''}`.toLowerCase().includes(normalizedSearch));
      const churchMatches = district.churches.some((church) => `${church.name || ''} ${church.address || ''}`.toLowerCase().includes(normalizedSearch));
      return districtMatches || leadMatches || churchMatches;
    });
  }, [districts, normalizedSearch]);

  const visibleLeads = useMemo(() => {
    const leads = selectedDistrict?.leads || [];
    const statusFiltered = activeStatus === 'needs'
      ? leads.filter((lead) => ['pending', 'notFound', 'approximate'].includes(lead.geoStatus))
      : activeStatus === 'all' ? leads : leads.filter((lead) => lead.geoStatus === activeStatus);
    if (!normalizedSearch) return statusFiltered;
    return statusFiltered.filter((lead) => `${lead.n || ''} ${lead.id || ''} ${lead.d || ''} ${leadNeighborhood(lead)} ${lead.tel || ''} ${fullLeadAddress(lead)}`.toLowerCase().includes(normalizedSearch));
  }, [activeStatus, normalizedSearch, selectedDistrict]);
  const overviewCards = [
    ['Leads geocodificados', totals.exact + totals.approximate, 'com latitude e longitude', MapPin, 'border-blue-500 bg-blue-600 text-white'],
    ['Exatos', totals.exact, 'precisao de endereco', CheckCircle2, 'border-emerald-500 bg-emerald-600 text-white'],
    ['Aproximados', totals.approximate, 'usar com conferencia', Bell, 'border-orange-500 bg-orange-600 text-white'],
    ['Pendentes', totals.pending, `${formatNumber(totals.notFound)} sem resultado anterior`, X, 'border-fuchsia-500 bg-fuchsia-600 text-white']
  ];
  const detailCards = [
    ['Exatos', selectedDistrict?.leadStats.exact || 0, 'border-emerald-200 bg-emerald-50 text-emerald-700'],
    ['Aproximados', selectedDistrict?.leadStats.approximate || 0, 'border-amber-200 bg-amber-50 text-amber-700'],
    ['Pendentes', selectedDistrict?.leadStats.pending || 0, 'border-rose-200 bg-rose-50 text-rose-700'],
    ['Igrejas pendentes', selectedDistrict?.churchStats.pending || 0, 'border-sky-200 bg-sky-50 text-sky-700']
  ];

  async function updateLead(lead) {
    if (!lead?.id || updatingLeadId) return;
    setUpdatingLeadId(lead.id);
    try {
      const response = await apiFetch('/api/geocode/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, limit: 1, force: true })
      });
      if (response.ok) {
        toast.success('Geocodificacao iniciada', { description: `Atualizando ${lead.n || `lead ${lead.id}`}.` });
        window.setTimeout(() => onDatasetUpdated?.().catch(() => {}), 4500);
      } else {
        toast.info('Geocodificacao em andamento', { description: 'Aguarde a rotina atual terminar para atualizar este lead.' });
      }
    } catch {
      toast.error('Nao foi possivel iniciar a atualizacao deste lead.');
    } finally {
      setUpdatingLeadId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Geolocalizacao</span>
            <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-950">Painel de coordenadas</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
              Acompanhe por distrito quais leads e igrejas tem coordenada exata, aproximada ou ainda precisam ser atualizados.
            </p>
          </div>
          <button className={ghostButtonClass} onClick={onBack} type="button">
            <ArrowRight className="rotate-180" size={18} />
            Voltar
          </button>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {overviewCards.map(([label, value, detail, Icon, tone]) => (
          <div className={`group relative overflow-hidden rounded-2xl border p-5 shadow-[0_18px_46px_rgba(15,23,42,0.16)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.22)] ${tone}`} key={label}>
            <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.02) 46%, rgba(255,255,255,0.18))' }} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/85">{label}</span>
                <strong className="mt-2 block text-4xl font-black tracking-normal">{formatNumber(value)}</strong>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.24)] transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:shadow-[0_16px_34px_rgba(15,23,42,0.34)]">
                <Icon size={20} />
              </span>
            </div>
            <p className="mt-3 text-xs font-bold text-white/85">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[0.9fr_1.4fr] gap-5 max-2xl:grid-cols-1">
        <div className="max-h-[44rem] overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Distritos</span>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Resumo operacional</h2>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{formatNumber(visibleDistricts.length)}/{formatNumber(districts.length)}</span>
          </div>
          <label className="relative mb-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar distrito, lead, ID, telefone ou igreja"
              value={searchTerm}
            />
          </label>
          <div className="grid gap-3">
            {visibleDistricts.map((district) => {
              const active = selectedDistrict?.slug === district.slug;
              const needs = district.leadStats.pending + district.leadStats.approximate + district.churchStats.pending;
              return (
                <button
                  className={`rounded-2xl border p-4 text-left shadow-sm transition ${active ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
                  key={district.slug}
                  onClick={() => setSelectedSlug(district.slug)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="min-w-0 truncate text-sm font-black text-slate-950">{district.name}</strong>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${needs ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-white'}`}>
                      {needs ? `${formatNumber(needs)} revisar` : 'ok'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] font-black uppercase text-slate-500">
                    <span>Exato<br /><b className="text-base text-emerald-700">{formatNumber(district.leadStats.exact)}</b></span>
                    <span>Aprox.<br /><b className="text-base text-amber-600">{formatNumber(district.leadStats.approximate)}</b></span>
                    <span>Pend.<br /><b className="text-base text-rose-600">{formatNumber(district.leadStats.pending)}</b></span>
                    <span>Igrejas<br /><b className="text-base text-sky-700">{formatNumber(district.churchStats.exact + district.churchStats.approximate)}/{formatNumber(district.churchStats.total)}</b></span>
                  </div>
                </button>
              );
            })}
            {!visibleDistricts.length ? <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Nenhum distrito, lead ou igreja encontrado para essa busca.</p> : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          {selectedDistrict ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Distrito selecionado</span>
                  <h2 className="mt-1 text-3xl font-black text-slate-950">{selectedDistrict.name}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    {formatNumber(selectedDistrict.leadStats.total)} leads e {formatNumber(selectedDistrict.churchStats.total)} igrejas acompanhados.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['needs', 'Revisar'],
                    ['pending', 'Pendentes'],
                    ['approximate', 'Aproximados'],
                    ['exact', 'Exatos'],
                    ['all', 'Todos']
                  ].map(([value, label]) => (
                    <button
                      className={`h-10 rounded-xl px-3 text-xs font-black transition ${activeStatus === value ? 'bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      key={value}
                      onClick={() => setActiveStatus(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {detailCards.map(([label, value, tone]) => (
                  <div className={`rounded-2xl border p-4 shadow-sm ${tone}`} key={label}>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
                    <strong className="mt-1 block text-3xl font-black">{formatNumber(value)}</strong>
                  </div>
                ))}
              </div>

              <div className="mt-5 max-h-[29rem] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/90 text-left">
                      {['Nome', 'Status', 'Endereco', 'WhatsApp', 'Acao'].map((head) => (
                        <th className="sticky top-0 z-[1] border-b border-white/[0.1] bg-slate-950 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/75" key={head}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeads.slice(0, 500).map((lead) => (
                      <tr className="hover:bg-slate-50" key={lead.id}>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <strong className="block text-slate-950">{lead.n}</strong>
                          <span className="text-xs font-semibold text-slate-500">ID {lead.id} · {leadNeighborhood(lead)}</span>
                        </td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${lead.geoStatus === 'exact' ? 'bg-emerald-500 text-white' : lead.geoStatus === 'approximate' ? 'bg-amber-400 text-slate-950' : 'bg-red-500 text-white'}`}>
                            {statusLabel(lead.geoStatus)}
                          </span>
                        </td>
                        <td className="max-w-[28rem] border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">{fullLeadAddress(lead)}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 font-black text-slate-950">{phoneDigits(lead.tel) || 'sem telefone'}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3">
                          <button
                            className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                            disabled={updatingLeadId === lead.id}
                            onClick={() => updateLead(lead)}
                            type="button"
                          >
                            {updatingLeadId === lead.id ? 'Enviando...' : 'Atualizar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleLeads.length ? <p className="p-5 text-sm font-semibold text-slate-600">Nenhum lead nesta categoria.</p> : null}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Igrejas do distrito</span>
                <div className="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
                  {selectedDistrict.churches.map((church) => (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" key={`${selectedDistrict.slug}-${church.name}`}>
                      <div className="flex items-start justify-between gap-3">
                        <strong className="text-sm font-black text-slate-950">{church.name}</strong>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${church.geoStatus === 'exact' ? 'bg-emerald-500 text-white' : church.geoStatus === 'approximate' ? 'bg-amber-400 text-slate-950' : 'bg-red-500 text-white'}`}>
                          {statusLabel(church.geoStatus)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">{church.address || 'Endereco nao informado'}</p>
                    </div>
                  ))}
                  {!selectedDistrict.churches.length ? <p className="text-sm font-semibold text-slate-600">Nenhuma igreja cadastrada neste distrito.</p> : null}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-400">Nenhum distrito disponivel.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function leadMatchesFilterGroup(lead, filters, ignoredGroups = []) {
  const ignored = new Set(ignoredGroups);
  const term = filters.search.trim().toLowerCase();
  if (!ignored.has('association') && filters.association !== 'paulistana') return false;
  if (!ignored.has('districts') && filters.districts.length && !filters.districts.includes(lead.d)) return false;
  if (!ignored.has('neighborhoods') && filters.neighborhoods.length && !filters.neighborhoods.includes(leadNeighborhood(lead))) return false;
  if (!ignored.has('materials') && filters.materials.length && !filters.materials.includes(leadMaterial(lead))) return false;
  if (!ignored.has('ageGroups') && filters.ageGroups.length && !filters.ageGroups.includes(leadAgeGroup(lead))) return false;
  if (!ignored.has('genders') && filters.genders.length && !filters.genders.includes(lead.g || 'N')) return false;
  if (!ignored.has('priorities') && filters.priorities.length && !filters.priorities.includes(lead.p)) return false;
  if (!ignored.has('whatsapp') && filters.whatsapp === 'with' && !lead.t) return false;
  if (!ignored.has('whatsapp') && filters.whatsapp === 'without' && lead.t) return false;
  if (!ignored.has('email') && filters.email === 'with' && !lead.em) return false;
  if (!ignored.has('email') && filters.email === 'without' && lead.em) return false;
  if (!ignored.has('study') && filters.study === 'with' && !lead.e) return false;
  if (!ignored.has('study') && filters.study === 'without' && lead.e) return false;
  if (!ignored.has('vip') && filters.vip === 'with' && !lead.v) return false;
  if (!ignored.has('vip') && filters.vip === 'without' && lead.v) return false;
  if (!ignored.has('religion') && filters.religion === 'adventist' && !isAdventistReligion(lead.r)) return false;
  if (!ignored.has('religion') && filters.religion === 'non-adventist' && isAdventistReligion(lead.r)) return false;
  if (!ignored.has('religion') && filters.religion.startsWith('religion:') && leadReligionValue(lead) !== filters.religion.slice('religion:'.length)) return false;
  if (!ignored.has('recency') && filters.recency === 'recent' && (lead.c === null || lead.c > 365)) return false;
  if (!ignored.has('recency') && filters.recency === 'old' && (lead.c === null || lead.c <= 365)) return false;
  if (!ignored.has('recency') && filters.recency === 'unknown' && lead.c !== null) return false;
  if (!ignored.has('search') && term) {
    const haystack = `${lead.n || ''} ${lead.tel || ''} ${lead.em || ''} ${lead.d || ''} ${leadNeighborhood(lead)} ${leadMaterial(lead)} ${lead.r || ''} ${lead.id || ''}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  return true;
}

function isAdventistReligion(value) {
  return slugifyDistrictName(value).includes('adventista');
}

function leadReligionValue(lead) {
  return String(lead?.r || 'Nao informado').trim() || 'Nao informado';
}

function AdvancedFilterGroup({ title, options, selected = [], onToggle, onClear, compact = false }) {
  const [query, setQuery] = useState('');
  const visibleOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? options.filter((option) => option.label.toLowerCase().includes(term))
      : options;
    const selectedOptions = options.filter((option) => selected.includes(option.value));
    return [
      ...selectedOptions,
      ...filtered.filter((option) => !selected.includes(option.value))
    ].slice(0, compact ? 24 : 80);
  }, [compact, options, query, selected]);

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] ring-1 ring-white/70">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">{title}</span>
        {selected.length ? (
          <button className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700 transition hover:bg-blue-100" onClick={onClear} type="button">
            Limpar
          </button>
        ) : null}
      </div>
      {options.length > 12 ? (
        <label className="relative mb-2 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-800 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${title.toLowerCase()}`}
            value={query}
          />
        </label>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${compact ? 'max-h-28 overflow-auto pr-1' : 'max-h-40 overflow-auto pr-1'}`}>
        {visibleOptions.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${active ? 'border-blue-500 bg-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.24)]' : 'border-slate-200 bg-slate-50 text-slate-700 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800'}`}
              key={option.value}
              onClick={() => onToggle(option.value)}
              type="button"
            >
              <span className="truncate">{option.label}</span>
              {hasNumber(option.count) ? <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>{formatNumber(option.count)}</span> : null}
            </button>
          );
        })}
        {!visibleOptions.length ? <span className="text-xs font-bold text-slate-500">Nenhuma opcao encontrada.</span> : null}
      </div>
    </div>
  );
}

function LeadsView({ associations, churchesByDistrict = {}, data, datasetUpdateHistory = [], lastDatasetUpdate, officialDistricts = [], records = [], onDatasetUpdated, onNavigate, user }) {
  const [filters, setFilters] = useState({
    association: 'paulistana',
    districts: [],
    neighborhoods: [],
    materials: [],
    ageGroups: [],
    genders: [],
    priorities: [],
    whatsapp: 'all',
    email: 'all',
    study: 'all',
    vip: 'all',
    religion: 'all',
    recency: 'all',
    search: ''
  });
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState(() => new Set());
  const [geocodeInfo, setGeocodeInfo] = useState(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeDistrict, setGeocodeDistrict] = useState('');
  const [showGeocodeMisses, setShowGeocodeMisses] = useState(false);
  const geocodeWasRunningRef = useRef(false);
  const churchesForMap = useMemo(() => {
    const districtNamesBySlug = officialDistricts.reduce((map, district) => ({
      ...map,
      [district.slug || slugifyDistrictName(district.name)]: district.name
    }), {});
    return Object.entries(churchesByDistrict || {}).flatMap(([districtSlug, entries]) => {
      const districtName = districtNamesBySlug[districtSlug] || districtSlug;
      return (entries || []).map((entry) => {
        const church = typeof entry === 'string' ? { name: entry } : entry;
        return {
          address: church.address || '',
          districtName,
          districtSlug,
          geoDisplayName: church.geoDisplayName || '',
          geoPrecision: church.geoPrecision || '',
          geoSource: church.geoSource || '',
          lat: church.lat,
          lng: church.lng,
          name: church.name || 'Igreja Adventista'
        };
      });
    });
  }, [churchesByDistrict, officialDistricts]);

  const districts = useMemo(
    () => Array.from(new Set(records.map((lead) => lead.d).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [records]
  );
  const recordsForDistrictOptions = useMemo(
    () => records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['districts'])),
    [filters, records]
  );
  const recordsForNeighborhoodOptions = useMemo(
    () => records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['neighborhoods'])),
    [filters, records]
  );
  const recordsForMaterialOptions = useMemo(
    () => records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['materials'])),
    [filters, records]
  );
  const recordsForAgeOptions = useMemo(
    () => records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['ageGroups'])),
    [filters, records]
  );
  const recordsForGenderOptions = useMemo(
    () => records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['genders'])),
    [filters, records]
  );
  const recordsForPriorityOptions = useMemo(
    () => records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['priorities'])),
    [filters, records]
  );
  const recordsForToggleOptions = useMemo(
    () => ({
      whatsapp: records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['whatsapp'])),
      email: records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['email'])),
      study: records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['study'])),
      vip: records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['vip'])),
      religion: records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['religion'])),
      recency: records.filter((lead) => leadMatchesFilterGroup(lead, filters, ['recency']))
    }),
    [filters, records]
  );
  const neighborhoodOptions = useMemo(() => topOptions(recordsForNeighborhoodOptions, leadNeighborhood), [recordsForNeighborhoodOptions]);
  const materialOptions = useMemo(() => topOptions(recordsForMaterialOptions, leadMaterial), [recordsForMaterialOptions]);
  const ageOptions = useMemo(() => ['Ate 17', '18 a 29', '30 a 44', '45 a 59', '60+', 'Sem idade'].map((value) => ({
    value,
    label: value,
    count: recordsForAgeOptions.filter((lead) => leadAgeGroup(lead) === value).length
  })).filter((option) => option.count > 0), [recordsForAgeOptions]);
  const genderOptions = useMemo(() => ['F', 'M', 'N'].map((value) => ({
    value,
    label: leadGenderLabel(value),
    count: recordsForGenderOptions.filter((lead) => (lead.g || 'N') === value).length
  })).filter((option) => option.count > 0), [recordsForGenderOptions]);
  const priorityOptions = useMemo(() => ['Hot', 'Warm', 'Cool', 'Cold'].map((value) => ({
    value,
    label: crmPriorityLabels[value],
    count: recordsForPriorityOptions.filter((lead) => lead.p === value).length
  })), [recordsForPriorityOptions]);
  const districtOptions = useMemo(() => {
    const districtSource = Array.from(new Set(recordsForDistrictOptions.map((lead) => lead.d).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return districtSource.map((district) => ({
    value: district,
    label: district,
    count: recordsForDistrictOptions.filter((lead) => lead.d === district).length
  }));
  }, [recordsForDistrictOptions]);
  const selectFilterOptions = useMemo(() => ({
    whatsapp: [
      ['all', `Todos (${formatNumber(recordsForToggleOptions.whatsapp.length)})`],
      ['with', `Com WhatsApp (${formatNumber(recordsForToggleOptions.whatsapp.filter((lead) => lead.t).length)})`],
      ['without', `Sem WhatsApp (${formatNumber(recordsForToggleOptions.whatsapp.filter((lead) => !lead.t).length)})`]
    ],
    email: [
      ['all', `Todos (${formatNumber(recordsForToggleOptions.email.length)})`],
      ['with', `Com e-mail (${formatNumber(recordsForToggleOptions.email.filter((lead) => lead.em).length)})`],
      ['without', `Sem e-mail (${formatNumber(recordsForToggleOptions.email.filter((lead) => !lead.em).length)})`]
    ],
    study: [
      ['all', `Todos (${formatNumber(recordsForToggleOptions.study.length)})`],
      ['with', `Com estudo (${formatNumber(recordsForToggleOptions.study.filter((lead) => lead.e).length)})`],
      ['without', `Sem estudo (${formatNumber(recordsForToggleOptions.study.filter((lead) => !lead.e).length)})`]
    ],
    vip: [
      ['all', `Todos (${formatNumber(recordsForToggleOptions.vip.length)})`],
      ['with', `VIP (${formatNumber(recordsForToggleOptions.vip.filter((lead) => lead.v).length)})`],
      ['without', `Nao VIP (${formatNumber(recordsForToggleOptions.vip.filter((lead) => !lead.v).length)})`]
    ],
    religion: [
      ['all', `Todos (${formatNumber(recordsForToggleOptions.religion.length)})`],
      ['adventist', `Adventista (${formatNumber(recordsForToggleOptions.religion.filter((lead) => isAdventistReligion(lead.r)).length)})`],
      ['non-adventist', `Nao Adventista (${formatNumber(recordsForToggleOptions.religion.filter((lead) => !isAdventistReligion(lead.r)).length)})`],
      ...topOptions(
        recordsForToggleOptions.religion.filter((lead) => !isAdventistReligion(lead.r)),
        leadReligionValue
      ).map((option) => [`religion:${option.value}`, `${option.label} (${formatNumber(option.count)})`])
    ],
    recency: [
      ['all', `Todos (${formatNumber(recordsForToggleOptions.recency.length)})`],
      ['recent', `Ate 1 ano (${formatNumber(recordsForToggleOptions.recency.filter((lead) => lead.c !== null && lead.c <= 365).length)})`],
      ['old', `+ de 1 ano (${formatNumber(recordsForToggleOptions.recency.filter((lead) => lead.c !== null && lead.c > 365).length)})`],
      ['unknown', `Sem data (${formatNumber(recordsForToggleOptions.recency.filter((lead) => lead.c === null).length)})`]
    ]
  }), [recordsForToggleOptions]);

  const filteredLeads = useMemo(() => {
    return records
      .filter((lead) => leadMatchesFilterGroup(lead, filters))
      .sort((a, b) => (b.s || 0) - (a.s || 0));
  }, [filters, records]);

  const visibleLeads = filteredLeads.slice(0, 300);
  const selectedLeads = filteredLeads.filter((lead) => selectedLeadIds.has(lead.id));
  const mapLeads = selectedLeads.length ? selectedLeads : filteredLeads;
  const hotWithWhatsapp = records.filter((lead) => lead.t && lead.p === 'Hot').length;
  const staleLeads = records.filter((lead) => lead.t && lead.c !== null && lead.c > 365).length;
  const canRunGeocode = isAdminUser(user);
  const geocodeChurchesSelected = geocodeDistrict === GEOCODE_CHURCHES_VALUE;

  async function loadGeocodeInfo({ refreshDashboard = false } = {}) {
    if (!canRunGeocode) return;
    const response = await apiFetch('/api/geocode/status');
    if (!response.ok) return;
    const info = await response.json();
    const justFinished = geocodeWasRunningRef.current && !info.running;
    geocodeWasRunningRef.current = Boolean(info.running);
    setGeocodeInfo(info);
    if ((refreshDashboard || justFinished) && !info.running && onDatasetUpdated) {
      await onDatasetUpdated().catch(() => {});
      const refreshed = await apiFetch('/api/geocode/status').then((nextResponse) => nextResponse.ok ? nextResponse.json() : null).catch(() => null);
      if (refreshed) setGeocodeInfo(refreshed);
    }
  }

  async function startGeocodeBatch() {
    if (!canRunGeocode || geocodeLoading || geocodeInfo?.running) return;
    setGeocodeLoading(true);
    setShowGeocodeMisses(false);
    try {
      const response = await apiFetch('/api/geocode/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: geocodeChurchesSelected ? 1000 : 250,
          district: geocodeChurchesSelected ? null : geocodeDistrict || null,
          scope: geocodeChurchesSelected ? 'churches' : 'leads',
          force: Boolean(geocodeDistrict)
        })
      });
      const info = await response.json().catch(() => null);
      if (info) setGeocodeInfo(info);
      if (response.ok) {
        geocodeWasRunningRef.current = true;
        toast.success('Geocodificacao iniciada', {
          description: geocodeChurchesSelected
            ? 'O backend vai salvar coordenadas das igrejas usando os enderecos oficiais.'
            : geocodeDistrict
            ? `O backend vai salvar coordenadas de ${geocodeDistrict} aos poucos, sem travar o sistema.`
            : 'O backend vai salvar coordenadas aos poucos, sem travar o sistema.'
        });
      } else {
        toast.info('Geocodificacao ja esta em andamento.');
      }
    } catch {
      toast.error('Nao foi possivel iniciar a geocodificacao.');
    } finally {
      setGeocodeLoading(false);
    }
  }

  useEffect(() => {
    loadGeocodeInfo().catch(() => {});
  }, [canRunGeocode]);

  useEffect(() => {
    if (!canRunGeocode || !geocodeInfo?.running) return undefined;
    const timer = window.setInterval(() => {
      loadGeocodeInfo({ refreshDashboard: true }).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [canRunGeocode, geocodeInfo?.running]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleArrayFilter(key, value) {
    setFilters((current) => {
      const values = current[key] || [];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      if (key === 'neighborhoods') {
        return {
          ...current,
          neighborhoods: nextValues,
          districts: relatedDistrictsForNeighborhoods(records, nextValues)
        };
      }
      return {
        ...current,
        [key]: nextValues
      };
    });
  }

  function clearArrayFilter(key) {
    setFilters((current) => ({
      ...current,
      [key]: [],
      ...(key === 'neighborhoods' ? { districts: [] } : {})
    }));
  }

  function clearAllFilters() {
    setFilters({
      association: 'paulistana',
      districts: [],
      neighborhoods: [],
      materials: [],
      ageGroups: [],
      genders: [],
      priorities: [],
      whatsapp: 'all',
      email: 'all',
      study: 'all',
      vip: 'all',
      religion: 'all',
      recency: 'all',
      search: ''
    });
  }

  function toggleLead(lead) {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (next.has(lead.id)) {
        next.delete(lead.id);
      } else {
        next.add(lead.id);
      }
      return next;
    });
  }

  function selectLeadOnMap(lead) {
    setSelectedLeadIds(new Set([lead.id]));
  }

  function selectVisibleLeads() {
    const next = new Set(visibleLeads.filter((lead) => lead.t).map((lead) => lead.id));
    setSelectedLeadIds(next);
    toast.success('Leads selecionados', {
      description: `${formatNumber(next.size)} contatos com WhatsApp ficaram marcados.`
    });
  }

  function clearSelection() {
    setSelectedLeadIds(new Set());
  }

  function exportLeads() {
    const rowsToExport = selectedLeads.length ? selectedLeads : filteredLeads;
    const header = ['Nome', 'WhatsApp', 'Email', 'Distrito', 'Bairro', 'Material', 'Religiao', 'Idade', 'Genero', 'Prioridade ML', 'Score', 'VIP', 'Estudo ativo'];
    const rows = rowsToExport.map((lead) => [
      lead.n,
      phoneDigits(lead.tel),
      lead.em || '',
      lead.d,
      leadNeighborhood(lead),
      leadMaterial(lead),
      lead.r || 'Nao informado',
      lead.a || '',
      leadGenderLabel(lead.g || 'N'),
      crmPriorityLabels[lead.p] || lead.p,
      lead.s,
      lead.v ? 'Sim' : 'Nao',
      lead.e ? 'Sim' : 'Nao'
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => {
      const text = String(cell ?? '');
      return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedLeads.length ? 'leads-selecionados.csv' : 'leads-filtrados.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className={labelClass}>CRM de leads</span>
            <h1 className="silver-title mt-2 text-5xl font-extrabold leading-tight tracking-normal max-md:text-4xl">Leads</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Consulte a base, priorize contatos, abra detalhes e encaminhe grupos para WhatsApp ou Conversas sem perder os fluxos ja existentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={primaryButtonClass} onClick={() => onNavigate('automations')} type="button">
              <Send size={18} />
              Enviar WhatsApp
            </button>
            <button className={ghostButtonClass} onClick={() => onNavigate('conversations')} type="button">
              <MessageCircle size={18} />
              Conversas
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard detail="base carregada" icon={ClipboardList} label="Total de leads" value={formatNumber(data.total)} />
        <MetricCard detail="aptos para contato" icon={MessageCircle} label="Com WhatsApp" tone="green" value={formatNumber(data.phone)} />
        <MetricCard detail="prioridade alta com telefone" icon={Sparkles} label="Quentes WhatsApp" tone="orange" value={formatNumber(hotWithWhatsapp)} />
        <MetricCard detail="contato acima de 1 ano" icon={Bell} label="Reativar" tone="violet" value={formatNumber(staleLeads)} />
      </section>

      <LastDatasetUpdateCard update={lastDatasetUpdate} />

      <div className="flex justify-end">
        <button className={ghostButtonClass} onClick={() => onNavigate('dataset-history')} type="button">
          <ClipboardList size={18} />
          Historico dos Excels
        </button>
      </div>

      <section className={`${panelClass} p-6`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className={labelClass}>Base operacional</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Lista de leads</h2>
          </div>
          <div className="grid min-w-[11rem] gap-1 rounded-2xl border border-blue-300/40 bg-gradient-to-br from-blue-600 to-slate-950 px-4 py-3 text-right shadow-[0_18px_42px_rgba(37,99,235,0.22)]">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">Selecionados</span>
            <strong className="text-2xl font-black text-white">{formatNumber(selectedLeads.length)}</strong>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/55 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)] ring-1 ring-white/80">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Filtragem avancada</span>
              <h3 className="mt-1 text-2xl font-black text-slate-950">Encontrar leads certos</h3>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Resultado</span>
              <strong className="block text-2xl font-black text-emerald-950">{formatNumber(filteredLeads.length)}</strong>
            </div>
          </div>

        <div className="grid grid-cols-[1fr_1.6fr] gap-3 max-xl:grid-cols-1">
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
            Associacao
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10" onChange={(event) => setFilter('association', event.target.value)} value={filters.association}>
              <option value="paulistana">Associacao Paulistana</option>
              {associations.filter((association) => association.id !== 'paulistana').map((association) => (
                <option disabled key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
            Buscar
            <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10" onChange={(event) => setFilter('search', event.target.value)} placeholder="Nome, email, distrito ou WhatsApp" value={filters.search} />
          </label>
        </div>

        <div className="mt-5 grid gap-5">
          <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
            <AdvancedFilterGroup
              title="Distritos"
              options={districtOptions}
              selected={filters.districts}
              onToggle={(value) => toggleArrayFilter('districts', value)}
              onClear={() => clearArrayFilter('districts')}
            />
            <AdvancedFilterGroup
              title="Bairros"
              options={neighborhoodOptions}
              selected={filters.neighborhoods}
              onToggle={(value) => toggleArrayFilter('neighborhoods', value)}
              onClear={() => clearArrayFilter('neighborhoods')}
            />
          </div>
          <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
            <AdvancedFilterGroup
              title="Materiais"
              options={materialOptions}
              selected={filters.materials}
              onToggle={(value) => toggleArrayFilter('materials', value)}
              onClear={() => clearArrayFilter('materials')}
            />
            <div className="grid gap-5">
              <AdvancedFilterGroup
                compact
                title="Prioridade"
                options={priorityOptions}
                selected={filters.priorities}
                onToggle={(value) => toggleArrayFilter('priorities', value)}
                onClear={() => clearArrayFilter('priorities')}
              />
              <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
                <AdvancedFilterGroup
                  compact
                  title="Idade"
                  options={ageOptions}
                  selected={filters.ageGroups}
                  onToggle={(value) => toggleArrayFilter('ageGroups', value)}
                  onClear={() => clearArrayFilter('ageGroups')}
                />
                <AdvancedFilterGroup
                  compact
                  title="Genero"
                  options={genderOptions}
                  selected={filters.genders}
                  onToggle={(value) => toggleArrayFilter('genders', value)}
                  onClear={() => clearArrayFilter('genders')}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {[
              ['whatsapp', 'WhatsApp', selectFilterOptions.whatsapp],
              ['email', 'E-mail', selectFilterOptions.email],
              ['study', 'Estudos', selectFilterOptions.study],
              ['vip', 'VIP', selectFilterOptions.vip],
              ['religion', 'Religiao', selectFilterOptions.religion],
              ['recency', 'Contato', selectFilterOptions.recency]
            ].map(([key, label, options]) => (
              <label className="grid min-w-0 gap-2 rounded-2xl border border-slate-200 bg-white/80 p-4 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 shadow-[0_14px_34px_rgba(15,23,42,0.07)] ring-1 ring-white/70" key={key}>
                {label}
                <select className="h-11 w-full min-w-0 max-w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10" onChange={(event) => setFilter(key, event.target.value)} value={filters[key]}>
                  {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        </div>

        <div className="mt-5">
          <LeadsOpenStreetMap churches={churchesForMap} leads={mapLeads} />
        </div>

        {canRunGeocode ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/85 p-4 text-sm shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
            <div className="min-w-[18rem] flex-1">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Precisao do mapa</span>
              <p className="mt-1 font-bold text-emerald-950">
                {geocodeInfo
                  ? `${formatNumber(geocodeInfo.leadsWithCoordinates)} leads com coordenada. ${formatNumber(geocodeInfo.leadsWithApproximateCoordinates || 0)} aproximada(s). ${formatNumber(geocodeInfo.pendingEstimate)} ainda pendente(s). ${formatNumber(geocodeInfo.churchesWithCoordinates)} igrejas geocodificada(s). ${formatNumber(geocodeInfo.churchPendingEstimate)} igreja(s) pendente(s).`
                  : 'Carregando status das coordenadas...'}
              </p>
              {geocodeInfo?.message ? (
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  {geocodeInfo.message}
                  {geocodeInfo.notFoundItems?.length ? (
                    <button className="ml-2 font-black text-emerald-950 underline decoration-emerald-500/50 underline-offset-2" onClick={() => setShowGeocodeMisses(true)} type="button">
                      Ver historico de {formatNumber(geocodeInfo.notFoundItems.length)} sem resultado
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end justify-end gap-3">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-4 text-sm font-black text-emerald-950 shadow-sm transition hover:bg-emerald-50"
                onClick={() => onNavigate('geolocation')}
                type="button"
              >
                <ClipboardList size={18} />
                Ver geolocalizacao
              </button>
              <label className="grid min-w-[14rem] gap-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-800">
                Distrito
                <select
                  className="h-11 rounded-xl border border-emerald-200 bg-white/80 px-3 text-sm font-black normal-case tracking-normal text-emerald-950 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  disabled={geocodeLoading || geocodeInfo?.running}
                  onChange={(event) => setGeocodeDistrict(event.target.value)}
                  value={geocodeDistrict}
                >
                  <option value="">Todos os distritos</option>
                  <option value={GEOCODE_CHURCHES_VALUE}>Igrejas</option>
                  {districts.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </label>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(22,163,74,0.24)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={geocodeLoading || geocodeInfo?.running}
                onClick={startGeocodeBatch}
                type="button"
              >
                <MapPin size={18} />
                {geocodeInfo?.running
                  ? 'Geocodificando...'
                  : geocodeChurchesSelected
                  ? 'Geocodificar igrejas'
                  : geocodeDistrict ? 'Geocodificar distrito' : 'Geocodificar 250'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-500">
            {formatNumber(filteredLeads.length)} leads encontrados. Exibindo {formatNumber(visibleLeads.length)}.
            {selectedLeads.length ? ` Mapa focado em ${formatNumber(selectedLeads.length)} selecionado(s).` : ''}
          </span>
          <div className="flex flex-wrap gap-2">
            <button className={ghostButtonClass} onClick={clearAllFilters} type="button">
              <X size={18} />
              Limpar filtros
            </button>
            <button className={ghostButtonClass} onClick={selectVisibleLeads} type="button">
              <CheckCircle2 size={18} />
              Selecionar visiveis
            </button>
            <button className={ghostButtonClass} onClick={clearSelection} type="button">Limpar selecao</button>
            <button className={ghostButtonClass} onClick={exportLeads} type="button">Exportar leads</button>
          </div>
        </div>

        <div className="mt-5 max-h-[34rem] overflow-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full border-collapse text-sm">
            <thead
              className="cursor-pointer"
              onClick={() => setSelectedLead(selectedLeads[0] || visibleLeads[0] || null)}
              title="Abrir detalhes do primeiro lead visivel ou selecionado"
            >
              <tr className="bg-slate-950/85 text-left transition hover:bg-slate-900">
                {['Selecionar', 'Nome', 'WhatsApp', 'Distrito', 'Bairro', 'Material', 'Religiao', 'Idade', 'Genero', 'Prioridade ML', 'Status', 'Score', 'Acoes'].map((head) => (
                  <th className="sticky top-0 z-[1] whitespace-nowrap border-b border-white/[0.12] bg-slate-950/95 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/80" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead) => {
                const checked = selectedLeadIds.has(lead.id);
                return (
                  <tr className={`cursor-pointer transition ${checked ? 'bg-blue-500/10' : 'hover:bg-white/[0.035]'}`} key={lead.id} onClick={() => setSelectedLead(lead)} title={`Abrir detalhes de ${lead.n}`}>
                    <td className="border-b border-white/[0.04] px-4 py-3">
                      <input aria-label={`Selecionar ${lead.n}`} checked={checked} className="h-4 w-4 accent-blue-600" onChange={() => toggleLead(lead)} onClick={(event) => event.stopPropagation()} type="checkbox" />
                    </td>
                    <td className="min-w-[15rem] border-b border-white/[0.04] px-4 py-3">
                      <button className="text-left" onClick={(event) => { event.stopPropagation(); selectLeadOnMap(lead); }} title={`Mostrar somente ${lead.n} no mapa`} type="button">
                        <strong className="block text-slate-50">{lead.n}</strong>
                        <span className="text-xs font-semibold text-slate-500">ID {lead.id} · {lead.em || 'sem email'}</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-black tabular-nums text-emerald-400">{phoneDigits(lead.tel) || 'sem telefone'}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-bold text-slate-300">{lead.d}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-semibold text-slate-400">{leadNeighborhood(lead)}</td>
                    <td className="max-w-[16rem] truncate border-b border-white/[0.04] px-4 py-3 font-semibold text-slate-400">{leadMaterial(lead)}</td>
                    <td className="max-w-[12rem] truncate border-b border-white/[0.04] px-4 py-3 font-semibold text-slate-300">{lead.r || 'Nao informado'}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-semibold text-slate-300">{lead.a || 'sem idade'}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-semibold text-slate-300">{leadGenderLabel(lead.g || 'N')}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${lead.p === 'Hot' ? 'bg-orange-500 text-white' : lead.p === 'Warm' ? 'bg-amber-500 text-white' : 'bg-slate-600 text-white'}`}>
                        {crmPriorityLabels[lead.p] || lead.p}
                      </span>
                    </td>
                    <td className="min-w-[12rem] border-b border-white/[0.04] px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {lead.t ? <span className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-black uppercase text-white">WhatsApp</span> : null}
                        {lead.v ? <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-[10px] font-black uppercase text-white">VIP</span> : null}
                        {lead.e ? <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase text-white">Estudo</span> : null}
                        {!lead.t && !lead.v && !lead.e ? <span className="text-xs font-semibold text-slate-500">Sem marcador</span> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-black tabular-nums text-slate-100">{lead.s}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3">
                      <div className="flex gap-2">
                        <button className="inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/10 px-3 text-xs font-black text-slate-100 transition hover:bg-white/15" onClick={(event) => { event.stopPropagation(); setSelectedLead(lead); }} type="button">Abrir</button>
                        <button className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-500" onClick={(event) => { event.stopPropagation(); onNavigate('automations'); }} type="button">WhatsApp</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showGeocodeMisses ? (
        <div className="fixed inset-0 z-[2147483646] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_34px_110px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Geocodificacao</span>
                <h3 className="mt-1 text-xl font-black text-slate-950">Historico sem coordenadas</h3>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100" onClick={() => setShowGeocodeMisses(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-auto p-5">
              {(geocodeInfo?.notFoundItems || []).map((item) => (
                <article className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" key={`${item.id}-${item.address}`}>
                  <strong className="block text-sm font-black text-slate-950">{item.name}</strong>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{item.address}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{item.district}{item.neighborhood ? ` - ${item.neighborhood}` : ''}</p>
                  {item.updatedAt ? <p className="mt-1 text-xs font-bold text-slate-400">Tentado em {formatDatasetDate(item.updatedAt)}</p> : null}
                  {item.attempts?.length ? (
                    <p className="mt-2 text-xs font-semibold text-slate-500">Tentativas: {item.attempts.join(' | ')}</p>
                  ) : null}
                </article>
              ))}
              {!geocodeInfo?.notFoundItems?.length ? <p className="text-sm font-semibold text-slate-600">Nenhum endereco sem resultado registrado.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}

function AdminGeneralView({
  associations,
  data,
  records = [],
  users,
  campaigns,
  auditEvents,
  onAddUser,
  onAddCampaign,
  initialSection = 'overview'
}) {
  const [section, setSection] = useState(initialSection);
  const [leadBatch, setLeadBatch] = useState(20);
  const [provider, setProvider] = useState(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [lastSend, setLastSend] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [lastBatch, setLastBatch] = useState(null);
  const [whatsappConversations, setWhatsappConversations] = useState([]);
  const [selectedInboxId, setSelectedInboxId] = useState(null);
  const [conversationModalOpen, setConversationModalOpen] = useState(false);
  const [selectedAdminLead, setSelectedAdminLead] = useState(null);
  const [leadFilters, setLeadFilters] = useState({
    association: 'paulistana',
    distrito: 'all',
    prioridade: 'Hot',
    search: ''
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState(() => new Set());
  const [batchPhonesText, setBatchPhonesText] = useState('');

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (section !== 'distribution') return;
    let active = true;
    apiFetch('/api/whatsapp/provider')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && payload) setProvider(payload);
      })
      .catch(() => {
        if (active) setProvider({ configured: false, provider: 'zpro-baileys' });
      });
    apiFetch('/api/whatsapp/conversations?limit=50')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && payload?.conversations) setWhatsappConversations(payload.conversations);
      })
      .catch(() => {
        if (active) setWhatsappConversations([]);
      });
    return () => { active = false; };
  }, [section]);

  const adminSections = [
    ['overview', 'Visão geral', Gauge],
    ['users', 'Acessos', UsersRound],
    ['territories', 'Territórios', Building2],
    ['campaigns', 'Campanhas', Radio],
    ['distribution', 'Distribuição', ClipboardList],
    ['audit', 'Auditoria', ShieldCheck],
    ['ml', 'Governança ML', Sparkles]
  ];
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'Ativa').length;
  const pendingUsers = users.filter((item) => item.status !== 'Ativo').length;
  const topDistrict = data.topDistricts[0];
  const operationCards = [
    ['Permissões por perfil', 'Admin geral, gestor de associação, coordenador e voluntário com escopos separados.', 'Pronto para backend', 'from-blue-600 to-cyan-500', 'bg-blue-500/95'],
    ['Territórios e igrejas', 'Admin geral organiza associações, distritos e igrejas antes de distribuir leads.', 'Camada visual', 'from-emerald-600 to-teal-500', 'bg-emerald-500/95'],
    ['Campanhas e metas', 'Cada campanha ganha responsável, associação, status e meta de acompanhamento.', 'Operacional', 'from-amber-500 to-orange-500', 'bg-orange-500/95'],
    ['Auditoria e segurança', 'Eventos sensíveis ficam visíveis para conferência administrativa.', 'Governança', 'from-violet-600 to-fuchsia-500', 'bg-violet-500/95']
  ];
  const campaignColors = ['from-emerald-600 to-teal-500', 'from-blue-600 to-indigo-500', 'from-violet-600 to-fuchsia-500', 'from-amber-500 to-orange-500'];
  const queueCards = [
    ['Leads quentes sem resposta', data.hot, 'Ação imediata', 'from-red-600 to-orange-500'],
    ['VIPs para relacionamento', data.vip, 'Nutrição', 'from-violet-600 to-fuchsia-500'],
    ['Estudos ativos para visita', data.studies, 'Acompanhamento', 'from-emerald-600 to-teal-500'],
    ['Com WhatsApp validado', data.phone, 'Automação', 'from-blue-600 to-cyan-500']
  ];
  const auditColors = ['from-emerald-600 to-teal-500', 'from-blue-600 to-cyan-500', 'from-violet-600 to-fuchsia-500', 'from-amber-500 to-orange-500'];
  const districts = useMemo(
    () => Array.from(new Set(records.map((row) => row.d))).sort((a, b) => a.localeCompare(b)),
    [records]
  );
  const filteredWhatsappLeads = useMemo(() => {
    const search = leadFilters.search.trim().toLowerCase();
    return records
      .filter((row) => {
        if (!row.t || !phoneDigits(row.tel)) return false;
        if (leadFilters.distrito !== 'all' && row.d !== leadFilters.distrito) return false;
        if (leadFilters.prioridade !== 'all' && row.p !== leadFilters.prioridade) return false;
        if (search) {
          const haystack = `${row.n || ''} ${row.tel || ''} ${row.d || ''}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.s || 0) - (a.s || 0));
  }, [records, leadFilters]);
  const visibleWhatsappLeads = useMemo(() => filteredWhatsappLeads.slice(0, 300), [filteredWhatsappLeads]);
  const selectedWhatsappLeads = useMemo(
    () => filteredWhatsappLeads.filter((row) => selectedLeadIds.has(row.id)),
    [filteredWhatsappLeads, selectedLeadIds]
  );
  const batchLimit = Math.min(Math.max(Number(leadBatch) || 1, 1), 50);
  const savedWhatsappMessages = useMemo(
    () => whatsappConversations.flatMap((conversation) => (conversation.messages || []).map((message) => ({ ...message, conversation }))),
    [whatsappConversations]
  );
  const whatsappInbox = useMemo(
    () => whatsappConversations.length
      ? whatsappConversations.slice(0, 6).map((conversation) => {
        const messages = conversation.messages || [];
        const lastMessage = messages[messages.length - 1];
        const linkedLead = records.find((lead) => {
          if (conversation.externalLeadId && lead.id === conversation.externalLeadId) return true;
          return phoneDigits(lead.tel).endsWith(String(conversation.phone || '').slice(-10));
        });
        return {
          id: conversation.externalLeadId || conversation.id,
          conversation,
          messages,
          n: conversation.leadName || conversation.phone,
          d: conversation.district || 'Distrito não vinculado',
          p: linkedLead?.p || null,
          status: lastMessage
            ? `${lastMessage.direction === 'INBOUND' ? 'Recebida' : 'Enviada'}: ${lastMessage.body}`
            : 'Conversa salva sem mensagens',
          when: lastMessage?.createdAt ? new Date(lastMessage.createdAt).toLocaleString('pt-BR') : 'Sem data'
        };
      })
      : filteredWhatsappLeads
      .filter((lead) => (lead.desc && lead.desc !== 'N/I') || lead.e || lead.c !== null)
      .slice(0, 6)
      .map((lead) => ({
        ...lead,
        sourceLead: lead,
        status: lead.desc && lead.desc !== 'N/I'
          ? 'Descrição importada'
          : lead.e
            ? 'Estudo ativo'
            : `Último contato há ${formatNumber(lead.c)} dias`,
        when: lead.c === null ? 'Sem data' : `${formatNumber(lead.c)} dias`
      })),
    [filteredWhatsappLeads, whatsappConversations, records]
  );
  const selectedInboxItem = useMemo(
    () => whatsappInbox.find((item) => String(item.id) === String(selectedInboxId)) || whatsappInbox[0] || null,
    [selectedInboxId, whatsappInbox]
  );
  const selectedQuestion = selectedInboxItem?.messages?.find((message) => message.direction === 'INBOUND')
    || selectedInboxItem?.messages?.[0]
    || null;
  const selectedAnswer = selectedQuestion
    ? selectedInboxItem?.messages?.find((message) => message.direction === 'OUTBOUND' && new Date(message.createdAt || 0) >= new Date(selectedQuestion.createdAt || 0))
    : selectedInboxItem?.messages?.find((message) => message.direction === 'OUTBOUND') || null;
  const selectedInboxPhone = selectedInboxItem ? inboxPhone(selectedInboxItem) : null;
  const leadsWithImportedDescription = records.filter((lead) => lead.t && lead.desc && lead.desc !== 'N/I').length;
  const leadsWithRecentContact = records.filter((lead) => lead.t && lead.c !== null && lead.c <= 90).length;
  const leadsContactUntilOneYear = records.filter((lead) => lead.t && lead.c !== null && lead.c > 90 && lead.c <= 365).length;
  const leadsContactOneToFiveYears = records.filter((lead) => lead.t && lead.c !== null && lead.c > 365 && lead.c <= 1825).length;
  const leadsWithoutFiveYears = records.filter((lead) => lead.t && lead.c !== null && lead.c > 1825).length;
  const hotWithWhatsapp = records.filter((lead) => lead.t && lead.p === 'Hot').length;
  const vipWithWhatsapp = records.filter((lead) => lead.t && lead.v).length;
  const studiesWithWhatsapp = records.filter((lead) => lead.t && lead.e).length;
  const whatsappFunnel = [
    { label: 'Com WhatsApp', value: data.phone, detail: 'telefone válido na base', tone: 'from-blue-600 to-cyan-500' },
    { label: 'Descrição importada', value: leadsWithImportedDescription, detail: 'campo de observação preenchido', tone: 'from-slate-700 to-slate-900' },
    { label: 'Contato até 90 dias', value: leadsWithRecentContact, detail: 'último contato registrado', tone: 'from-emerald-600 to-teal-500' },
    { label: 'Estudo ativo', value: data.studies, detail: 'material em andamento', tone: 'from-violet-600 to-fuchsia-500' }
  ];
  const whatsappTemplates = [
    { name: 'Quentes com WhatsApp', goal: 'Prioridade alta', count: hotWithWhatsapp, filter: { prioridade: 'Hot' } },
    { name: 'VIPs com WhatsApp', goal: 'Relacionamento', count: vipWithWhatsapp, filter: { prioridade: 'all' } },
    { name: 'Estudos ativos', goal: 'Acompanhamento', count: studiesWithWhatsapp, filter: { prioridade: 'all' } },
    { name: 'Sem contato 5+ anos', goal: 'Recuperacao', count: leadsWithoutFiveYears, filter: { prioridade: 'all' } }
  ];
  const whatsappRules = [
    ['Priorizar quentes com WhatsApp', `${formatNumber(hotWithWhatsapp)} leads`, 'Base real'],
    ['Acompanhar estudos ativos', `${formatNumber(studiesWithWhatsapp)} leads`, 'Base real'],
    ['Recuperar sem contato 5+ anos', `${formatNumber(leadsWithoutFiveYears)} leads`, 'Base real'],
    ['Relacionar VIPs com WhatsApp', `${formatNumber(vipWithWhatsapp)} leads`, 'Base real']
  ];
  const whatsappSchedules = [
    ['Contato até 90 dias', leadsWithRecentContact, 'último contato registrado'],
    ['91 dias a 1 ano', leadsContactUntilOneYear, 'contatos em aquecimento'],
    ['1 a 5 anos', leadsContactOneToFiveYears, 'recuperação moderada'],
    ['5+ anos', leadsWithoutFiveYears, 'recuperação antiga']
  ];
  const whatsappAlerts = [
    ['Leads quentes com WhatsApp', `${formatNumber(hotWithWhatsapp)} contatos reais na base`, 'Alta'],
    ['Estudos ativos', `${formatNumber(data.studies)} leads com estudo em andamento`, 'Media'],
    ['Sem contato há 5+ anos', `${formatNumber(leadsWithoutFiveYears)} contatos com WhatsApp`, 'Alta']
  ];
  const timelineConversation = selectedInboxItem?.conversation || whatsappConversations[0] || null;
  const timelineLead = selectedInboxItem || filteredWhatsappLeads[0] || null;
  const whatsappTimeline = selectedInboxItem?.messages?.length
    ? selectedInboxItem.messages.map((message) => [
      message.direction === 'INBOUND' ? `Recebida de ${selectedInboxPhone}` : `Enviada para ${selectedInboxPhone}`,
      message.body,
      message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR') : 'Sem data'
    ])
    : timelineConversation?.messages?.length
      ? timelineConversation.messages.map((message) => [
        message.direction === 'INBOUND' ? `Recebida de ${selectedInboxPhone || timelineConversation.phone}` : `Enviada para ${selectedInboxPhone || timelineConversation.phone}`,
        message.body,
        message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR') : 'Sem data'
      ])
    : timelineLead ? [
    ['Lead real', timelineLead.n, selectedInboxPhone || timelineLead.d],
    ...(timelineLead.desc && timelineLead.desc !== 'N/I' ? [['Descrição importada', timelineLead.desc, 'Cadastro']] : []),
    ...(timelineLead.e ? [['Estudo ativo', 'Material em andamento na base', 'Cadastro']] : []),
    ...(timelineLead.c !== null ? [['Último contato', `Registrado há ${formatNumber(timelineLead.c)} dias`, 'Base']] : [])
  ] : [];
  const whatsappSendHistory = [
    ...Object.entries(savedWhatsappMessages.reduce((acc, message) => {
      const key = message.senderType === 'AI' ? 'IA' : message.senderType === 'AUTOMATION' ? 'Automação' : message.direction === 'INBOUND' ? 'Recebidas' : 'Enviadas';
      acc[key] = acc[key] || { sent: 0, received: 0 };
      if (message.direction === 'OUTBOUND') acc[key].sent += 1;
      if (message.direction === 'INBOUND') acc[key].received += 1;
      return acc;
    }, {})).map(([name, values]) => [name, formatNumber(values.sent), formatNumber(values.received), 'Salvo']),
    ...(!savedWhatsappMessages.length && lastSend ? [['Disparo individual', '1', '-', 'Aceito']] : []),
    ...(!savedWhatsappMessages.length && lastBatch ? [['Lote manual', formatNumber(lastBatch.sent || 0), '-', `${formatNumber(lastBatch.failed || 0)} falhas`]] : [])
  ];

  useEffect(() => {
    if (!selectedLeadIds.size) return;
    setBatchPhonesText(selectedWhatsappLeads.slice(0, batchLimit).map((row) => phoneDigits(row.tel)).join('\n'));
  }, [selectedLeadIds, selectedWhatsappLeads, batchLimit]);

  function setLeadFilter(key, value) {
    setLeadFilters((current) => ({ ...current, [key]: value }));
  }

  function syncBatchPhones(leads) {
    setBatchPhonesText(leads.slice(0, batchLimit).map((row) => phoneDigits(row.tel)).join('\n'));
  }

  function selectLead(row) {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  function selectFilteredBatch() {
    const nextLeads = filteredWhatsappLeads.slice(0, batchLimit);
    setSelectedLeadIds(new Set(nextLeads.map((row) => row.id)));
    syncBatchPhones(nextLeads);
    toast.success('Leads selecionados', {
      description: `${formatNumber(nextLeads.length)} contatos foram colocados no lote.`
    });
  }

  function clearLeadSelection() {
    setSelectedLeadIds(new Set());
    setBatchPhonesText('');
  }

  function exportSelectedLeads() {
    const rowsToExport = selectedWhatsappLeads.length ? selectedWhatsappLeads : filteredWhatsappLeads;
    const header = ['Nome', 'WhatsApp', 'Distrito', 'Prioridade ML', 'Score'];
    const rows = rowsToExport.map((row) => [
      row.n,
      phoneDigits(row.tel),
      row.d,
      crmPriorityLabels[row.p] || row.p,
      row.s
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => {
      const text = String(cell ?? '');
      return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedWhatsappLeads.length ? 'leads-selecionados-whatsapp.csv' : 'leads-filtrados-whatsapp.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function refreshWhatsappConversations() {
    try {
      const response = await apiFetch('/api/whatsapp/conversations?limit=50');
      if (!response.ok) return;
      const payload = await response.json();
      setWhatsappConversations(payload.conversations || []);
    } catch {
      setWhatsappConversations([]);
    }
  }

  function submitUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    if (!name || !email) return;
    onAddUser({
      id: `user-${Date.now()}`,
      name,
      email,
      role: String(form.get('role') || 'VOLUNTARIO'),
      scope: String(form.get('scope') || 'Leads atribuidos'),
      status: 'Convite pendente'
    });
    event.currentTarget.reset();
    toast.success('Acesso preparado', {
      description: `${name} entrou na lista de permissões do admin geral.`
    });
  }

  function submitCampaign(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    onAddCampaign({
      id: `campaign-${Date.now()}`,
      name,
      association: String(form.get('association') || associations[0]?.name || 'Todas as associacoes'),
      status: String(form.get('status') || 'Planejada'),
      owner: String(form.get('owner') || 'Admin geral'),
      goal: Number(form.get('goal') || 0)
    });
    event.currentTarget.reset();
    toast.success('Campanha adicionada', {
      description: `${name} ficou pronta para acompanhamento administrativo.`
    });
  }

  async function submitWhatsAppTest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get('phone') || '').trim();
    const message = String(form.get('message') || '').trim();
    setSendLoading(true);
    setLastSend(null);
    setSendError(null);

    try {
      const response = await apiFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      const payload = await response.json();
      if (!response.ok) {
        setSendError(payload);
        throw new Error(payload.message || 'Nao foi possivel enviar a mensagem.');
      }
      setLastSend(payload);
      await refreshWhatsappConversations();
      toast.success('Mensagem enviada', {
        description: `Disparo feito para ${payload.phone} via ${payload.transport || 'Z-PRO'}.`
      });
    } catch (error) {
      toast.error('Falha no disparo', {
        description: error.message
      });
    } finally {
      setSendLoading(false);
    }
  }

  async function submitWhatsAppBatch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get('batchMessage') || '').trim();
    const typedPhones = batchPhonesText
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const selectedByPhone = new Map(selectedWhatsappLeads.map((row) => [phoneDigits(row.tel), row]));
    const recipients = typedPhones.slice(0, batchLimit).map((phone, index) => {
      const normalized = phoneDigits(phone);
      const lead = selectedByPhone.get(normalized);
      return {
        id: lead?.id || `manual-${index + 1}`,
        leadId: lead?.id || `manual-${index + 1}`,
        name: lead?.n || null,
        district: lead?.d || null,
        priority: lead?.p || null,
        phone: normalized || phone
      };
    });

    if (!recipients.length) {
      toast.error('Informe os numeros', {
        description: 'Selecione leads ou cole ao menos um WhatsApp no campo de numeros do lote.'
      });
      return;
    }

    setBatchLoading(true);
    setLastBatch(null);
    try {
      const response = await apiFetch('/api/whatsapp/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel enviar o lote.');
      }
      setLastBatch(payload);
      await refreshWhatsappConversations();
      toast.success('Lote enviado', {
        description: `${payload.sent || 0} mensagens aceitas pelo provedor.`
      });
    } catch (error) {
      toast.error('Falha no lote', {
        description: error.message
      });
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className={labelClass}>Admin geral</span>
            <h1 className="silver-title mt-2 text-5xl font-extrabold leading-tight tracking-normal max-md:text-4xl">Central de comando</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Controle acessos, territórios, campanhas, distribuição de interessados, auditoria e governança do ranking ML sem perder o painel que já foi construído.
            </p>
          </div>
          <button
            className={primaryButtonClass}
            onClick={() => toast.success('Checklist revisado', {
              description: 'Permissões, campanhas, distribuição, auditoria e ML estão visíveis para o admin geral.'
            })}
            type="button"
          >
            <ShieldCheck size={18} />
            Revisar operação
          </button>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard detail="perfis administrativos" icon={UsersRound} label="Usuários" value={formatNumber(users.length)} />
        <MetricCard detail={`${activeCampaigns} em andamento`} icon={Radio} label="Campanhas" tone="green" value={formatNumber(campaigns.length)} />
        <MetricCard detail="com prioridade alta" icon={Sparkles} label="Leads quentes" tone="orange" value={formatNumber(data.hot)} />
        <MetricCard detail={`${associations.length} associações no painel`} icon={Building2} label="Territórios" value={formatNumber(data.districts)} />
        <MetricCard detail={`${pendingUsers} convite pendente`} icon={ShieldCheck} label="Pendências" tone="violet" value={formatNumber(pendingUsers)} />
      </section>

      <section className={`${panelClass} p-3`}>
        <div className="flex flex-wrap gap-2">
          {adminSections.map(([id, label, Icon]) => (
            <button
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${section === id ? 'bg-blue-600 text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)]' : 'bg-white/60 text-slate-700 hover:bg-white'}`}
              key={id}
              onClick={() => setSection(id)}
              type="button"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {section === 'overview' ? (
        <section className="grid grid-cols-[1.2fr_0.8fr] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Mapa da operação</span>
            <div className="mt-5 grid gap-3">
              {operationCards.map(([title, detail, status, tone, badge]) => (
                <div className={`interactive-card grid grid-cols-[1fr_auto] gap-4 rounded-2xl border border-white/30 bg-gradient-to-br ${tone} p-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]`} key={title}>
                  <div>
                    <strong className="text-lg font-semibold text-white">{title}</strong>
                    <p className="mt-1 text-sm leading-relaxed text-white/82">{detail}</p>
                  </div>
                  <span className={`self-start rounded-full ${badge} px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm`}>{status}</span>
                </div>
              ))}
            </div>
          </article>
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Prioridade agora</span>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-50">{topDistrict?.name || 'Distrito prioritário'}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Maior volume atual para ação do admin geral, combinando território, contatos quentes e capacidade de distribuição.
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-blue-300/40 bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-white shadow-[0_18px_42px_rgba(37,99,235,0.20)]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Interessados</span>
                <strong className="mt-1 block text-3xl font-extrabold text-white">{formatNumber(topDistrict?.interessados || 0)}</strong>
              </div>
              <div className="rounded-2xl border border-orange-300/40 bg-gradient-to-br from-red-600 to-orange-500 p-4 text-white shadow-[0_18px_42px_rgba(239,68,68,0.18)]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Quentes</span>
                <strong className="mt-1 block text-3xl font-extrabold text-white">{formatNumber(topDistrict?.quentes || 0)}</strong>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {section === 'users' ? (
        <section className="grid grid-cols-[1fr_24rem] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Permissões e acessos</span>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-950/70 text-left">
                    {['Nome', 'Perfil', 'Escopo', 'Status'].map((head) => (
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500" key={head}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr className="border-t border-white/[0.05]" key={item.id}>
                      <td className="px-4 py-4">
                        <strong className="block text-slate-50">{item.name}</strong>
                        <span className="text-xs text-slate-500">{item.email}</span>
                      </td>
                      <td className="profile-role px-4 py-4">{item.role.replaceAll('_', ' ')}</td>
                      <td className="px-4 py-4 font-bold text-slate-400">{item.scope}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${item.status === 'Ativo' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <form className={`${panelClass} grid content-start gap-3 p-5`} onSubmit={submitUser}>
            <span className={labelClass}>Novo acesso</span>
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="name" placeholder="Nome do usuário" />
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="email" placeholder="email@dominio.com" type="email" />
            <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="role">
              <option value="ADMIN_GERAL">Admin geral</option>
              <option value="GESTOR_ASSOCIACAO">Gestor de associação</option>
              <option value="COORDENADOR_CAMPANHA">Coordenador de campanha</option>
              <option value="VOLUNTARIO">Voluntário</option>
            </select>
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="scope" placeholder="Escopo de acesso" />
            <button className={primaryButtonClass} type="submit">
              <Plus size={18} />
              Criar acesso
            </button>
          </form>
        </section>
      ) : null}

      {section === 'territories' ? (
        <section className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
          {associations.map((association) => (
            <article className={`${panelClass} interactive-card p-5`} key={association.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200/20 bg-white/[0.07] text-slate-100">
                  <Building2 size={22} />
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${association.status === 'Ativa' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>{association.status}</span>
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-50">{association.name}</h2>
              <p className="mt-2 text-sm text-slate-500">{association.region}</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div><span className={labelClass}>Distritos</span><strong className="mt-1 block text-2xl text-slate-50">{formatNumber(association.districts)}</strong></div>
                <div><span className={labelClass}>Leads</span><strong className="mt-1 block text-2xl text-slate-50">{formatNumber(association.leads)}</strong></div>
                <div><span className={labelClass}>Camp.</span><strong className="mt-1 block text-2xl text-slate-50">{formatNumber(association.campaigns)}</strong></div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {section === 'campaigns' ? (
        <section className="grid grid-cols-[1fr_24rem] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Campanhas gerais</span>
            <div className="mt-5 grid gap-3">
              {campaigns.map((campaign, index) => (
                <div className={`interactive-card grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-white/30 bg-gradient-to-br ${campaignColors[index % campaignColors.length]} p-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.14)]`} key={campaign.id}>
                  <div>
                    <strong className="text-xl font-semibold text-white">{campaign.name}</strong>
                    <span className="mt-2 block text-sm text-white/80">{campaign.association} · {campaign.owner} · meta {formatNumber(campaign.goal)}</span>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${campaign.status === 'Ativa' ? 'bg-emerald-400 text-emerald-950' : 'bg-white/22 text-white'}`}>{campaign.status}</span>
                </div>
              ))}
            </div>
          </article>
          <form className={`${panelClass} grid content-start gap-3 p-5`} onSubmit={submitCampaign}>
            <span className={labelClass}>Nova campanha</span>
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="name" placeholder="Nome da campanha" />
            <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="association">
              {associations.map((association) => <option key={association.id}>{association.name}</option>)}
            </select>
            <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="status">
              <option>Planejada</option>
              <option>Ativa</option>
              <option>Pausada</option>
              <option>Finalizada</option>
            </select>
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="owner" placeholder="Responsável" />
            <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" min="0" name="goal" placeholder="Meta de acompanhamentos" type="number" />
            <button className={primaryButtonClass} type="submit">
              <Plus size={18} />
              Criar campanha
            </button>
          </form>
        </section>
      ) : null}

      {section === 'distribution' ? (
        <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6 max-xl:col-span-1 xl:col-span-2`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className={labelClass}>WhatsApp CRM</span>
                <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-50 max-md:text-2xl">Centro operacional de conversas</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                  Registros importados, indicadores, segmentos, recência, critérios, alertas e relatórios calculados com a base real, sem remover os envios atuais.
                </p>
              </div>
              <button
                className={primaryButtonClass}
                onClick={() => toast.success('Operação WhatsApp revisada', {
                  description: 'A aba agora mostra apenas dados reais carregados ou envios feitos na sessão.'
                })}
                type="button"
              >
                <MessageCircle size={18} />
                Revisar WhatsApp
              </button>
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              {[
                ['Registros reais', whatsappInbox.length, 'leads com histórico'],
                ['Segmentos', whatsappTemplates.length, 'calculados da base'],
                ['Critérios', whatsappRules.length, 'calculados da base'],
                ['Prioridades', whatsappAlerts.length, 'calculadas da base']
              ].map(([label, value, detail]) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)]" key={label}>
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
                  <strong className="mt-2 block text-3xl font-black text-slate-950">{formatNumber(value)}</strong>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">{detail}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <span className={labelClass}>Caixa de entrada</span>
                <h2 className="mt-1 text-2xl font-black text-slate-50">Registros importados</h2>
              </div>
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Ao vivo</span>
            </div>
            <div className="grid gap-3">
              {whatsappInbox.length ? whatsappInbox.map((lead) => (
                <button
                  className={`interactive-card grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-blue-300 ${String(selectedInboxItem?.id) === String(lead.id) ? 'border-blue-400 ring-4 ring-blue-500/10' : 'border-slate-200'}`}
                  key={`inbox-${lead.id}`}
                  onClick={() => {
                    setSelectedInboxId(lead.id);
                    setConversationModalOpen(true);
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-black text-slate-950">{lead.n}</strong>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-600">{lead.d} · {lead.status}</span>
                  </span>
                  <span className="text-right">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${priorityBadgeClasses(lead.p)}`}>{lead.p ? (crmPriorityLabels[lead.p] || lead.p) : 'Salva'}</span>
                    <span className="mt-1 block text-xs font-bold text-slate-500">{lead.when}</span>
                  </span>
                </button>
              )) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
                  Nenhum lead com descrição, estudo ativo ou data de último contato apareceu nos filtros atuais.
                </div>
              )}
            </div>
            {selectedInboxItem ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-[0_12px_34px_rgba(37,99,235,0.08)]">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">Pergunta e resposta</span>
                <strong className="mt-1 block text-sm font-black text-slate-950">{selectedInboxItem.n}</strong>
                <div className="mt-3 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Pergunta</span>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
                      {selectedQuestion?.body || selectedInboxItem.desc || selectedInboxItem.status}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Resposta ligada</span>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
                      {selectedAnswer?.body || 'Ainda nao ha resposta salva para esta pergunta. Ao responder pela tela Conversas, ela ficara gravada no historico deste numero.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Indicadores WhatsApp</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Dados reais da base</h2>
            <div className="mt-5 grid gap-3">
              {whatsappFunnel.map((stage) => (
                <div className={`rounded-2xl border border-white/30 bg-gradient-to-br ${stage.tone} p-4 text-white shadow-[0_16px_42px_rgba(15,23,42,0.14)]`} key={stage.label}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-white">{stage.label}</strong>
                    <strong className="text-2xl font-black text-white">{formatNumber(stage.value)}</strong>
                  </div>
                  <span className="mt-1 block text-sm font-semibold text-white/82">{stage.detail}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Linha do tempo</span>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-slate-50">Conversa do lead</h2>
              {selectedInboxPhone ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-800">{selectedInboxPhone}</span>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3">
              {whatsappTimeline.length ? whatsappTimeline.map(([type, detail, when], index) => (
                <div className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={`${type}-${when}`}>
                  <span className={`mt-1 h-3 w-3 rounded-full ${index === 1 ? 'bg-emerald-600' : index === 3 ? 'bg-blue-600' : 'bg-slate-700'}`} />
                  <span>
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm font-black text-slate-950">{type}</strong>
                      <span className="text-xs font-bold text-slate-500">{when}</span>
                    </span>
                    <span className="mt-1 block text-sm font-semibold leading-relaxed text-slate-700">{detail}</span>
                  </span>
                </div>
              )) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
                  Nenhuma conversa real do WhatsApp foi sincronizada para montar linha do tempo.
                </div>
              )}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Histórico de disparos</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Entregas e respostas</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    {['Sequência', 'Enviadas', 'Resposta', 'Status'].map((head) => (
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600" key={head}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {whatsappSendHistory.length ? whatsappSendHistory.map(([name, sent, response, status]) => (
                    <tr className="border-t border-slate-200" key={name}>
                      <td className="px-4 py-3 font-black text-slate-950">{name}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{sent}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{response}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide text-white ${status === 'Respondido' ? 'bg-emerald-600' : status === 'Monitorar' ? 'bg-orange-600' : 'bg-blue-600'}`}>{status}</span>
                      </td>
                    </tr>
                  )) : (
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-5 text-sm font-semibold text-slate-700" colSpan={4}>Nenhum envio real registrado nesta sessão.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className={`${panelClass} p-6 max-xl:col-span-1 xl:col-span-2`}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className={labelClass}>Segmentos reais</span>
                <h2 className="mt-1 text-2xl font-black text-slate-50">Grupos para ação WhatsApp</h2>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-800">Base real de leads</span>
            </div>
            <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
              {whatsappTemplates.length ? whatsappTemplates.map((template) => (
                <button
                  className="interactive-card rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-blue-300"
                  key={template.name}
                  onClick={() => {
                    setLeadFilters((current) => ({ ...current, ...template.filter }));
                    toast.success(`${template.name} selecionado`, { description: `${formatNumber(template.count)} leads nesse segmento real.` });
                  }}
                  type="button"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{template.goal}</span>
                  <strong className="mt-2 block text-lg font-black text-slate-950">{template.name}</strong>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{formatNumber(template.count)} leads encontrados na base atual.</p>
                </button>
              )) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-[0_12px_34px_rgba(15,23,42,0.08)] max-xl:col-span-2 max-md:col-span-1 xl:col-span-4">
                  Nenhum segmento real encontrado com os filtros atuais.
                </div>
              )}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Recência real</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Último contato</h2>
            <div className="mt-5 grid gap-3">
              {whatsappSchedules.length ? whatsappSchedules.map(([name, when, audience]) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={`${name}-${when}`}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-950">{name}</strong>
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">{formatNumber(when)}</span>
                  </div>
                  <span className="mt-2 block text-sm font-semibold text-slate-600">{audience}</span>
                </div>
              )) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
                  Nenhuma data de último contato encontrada na base.
                </div>
              )}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Critérios reais</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Priorização da base</h2>
            <div className="mt-5 grid gap-3">
              {whatsappRules.length ? whatsappRules.map(([trigger, action, status]) => (
                <button
                  className="interactive-card rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-emerald-300"
                  key={trigger}
                  onClick={() => toast.info(trigger, { description: action })}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-950">{trigger}</strong>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${status === 'Ativa' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}`}>{status}</span>
                  </div>
                  <span className="mt-2 block text-sm font-semibold text-slate-600">{action}</span>
                </button>
              )) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
                  Nenhum critério real encontrado na base.
                </div>
              )}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Alertas inteligentes</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">O que precisa de atenção</h2>
            <div className="mt-5 grid gap-3">
              {whatsappAlerts.map(([title, detail, level]) => (
                <div className={`rounded-2xl border p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)] ${level === 'Alta' ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50'}`} key={title}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-950">{title}</strong>
                    <span className={`rounded-full px-3 py-1 text-xs font-black text-white ${level === 'Alta' ? 'bg-orange-600' : 'bg-blue-600'}`}>{level}</span>
                  </div>
                  <span className="mt-2 block text-sm font-semibold text-slate-700">{detail}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Relatórios e atribuição</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Indicadores reais disponíveis</h2>
            <div className="mt-5 grid gap-3">
              {[
                ['WhatsApp válidos', formatNumber(data.phone), 'telefones válidos na base'],
                ['Contato até 90 dias', formatNumber(leadsWithRecentContact), 'último contato registrado'],
                ['Estudos ativos', formatNumber(data.studies), 'material em andamento']
              ].map(([label, value, detail]) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={label}>
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
                  <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">{detail}</span>
                </div>
              ))}
            </div>
            <button
              className={`${ghostButtonClass} mt-4 w-full opacity-70`}
              onClick={() => toast.info('Atribuição indisponível', { description: 'Ainda não há cadastro real de atribuições WhatsApp para voluntários.' })}
              type="button"
            >
              <UsersRound size={17} />
              Atribuição aguardando cadastro real
            </button>
          </article>

          <article className={`${panelClass} grid content-start gap-5 p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={labelClass}>WhatsApp Zpro</span>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-50">Disparo Individual</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Envie uma mensagem real pelo canal Baileys configurado antes de ativar filas maiores.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${provider?.configured ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                {provider?.configured ? 'Configurado' : 'Pendente'}
              </span>
            </div>
            <div className="hidden">
              <span>Provedor: {provider?.provider || 'zpro-baileys'}</span>
              <span>API ID: {provider?.apiId || 'configure ZPRO_API_ID'}</span>
              <span>Canal: {provider?.channelId || 'configure ZPRO_CHANNEL_ID'}</span>
              <span>Base: {provider?.baseUrl || 'configure ZPRO_API_URL'}</span>
              <span>Token: {provider?.token?.loaded ? `${provider.token.length} caracteres · ${provider.token.prefix}` : 'não carregado'}</span>
            </div>
            <form className="grid gap-3" onSubmit={submitWhatsAppTest}>
              <label className="grid gap-2 text-sm font-medium text-slate-300">
                WhatsApp
                <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" name="phone" placeholder="Ex.: 5511999999999" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-300">
                Mensagem
                <textarea className="min-h-28 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-3 text-slate-100 outline-none" name="message" defaultValue="Olá! Aqui é da Escola Bíblica Novo Tempo. Estamos felizes pelo seu interesse e queremos ajudar você a continuar seus estudos." />
              </label>
              <button className={primaryButtonClass} disabled={sendLoading} type="submit">
                <Send size={18} />
                {sendLoading ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
            {lastSend ? (
              <div className="rounded-2xl border border-emerald-300/45 bg-emerald-600/80 p-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15">
                Mensagem aceita pelo provedor para {lastSend.phone} via {lastSend.transport || 'Z-PRO'}.
              </div>
            ) : null}
            {sendError ? (
              <div className="grid gap-3 rounded-2xl border border-red-400/35 bg-red-500/10 p-4 text-sm text-red-100">
                <strong className="text-red-50">DiagnÃ³stico do envio</strong>
                <span>{sendError.message || 'O provedor recusou o disparo.'}</span>
                {sendError.providerAttempts?.length ? (
                  <div className="grid gap-2 text-xs text-red-100/85">
                    {sendError.providerAttempts.map((attempt, index) => (
                      <span key={`${attempt.transport}-${index}`}>
                        Tentativa {index + 1}: {attempt.transport} respondeu {attempt.status}{attempt.message ? ` - ${attempt.message}` : ''}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>

          <form className={`${panelClass} grid content-start gap-5 p-6`} onSubmit={submitWhatsAppBatch}>
            <span className={labelClass}>Envio em lote WhatsApp</span>
            <label className="grid gap-2 text-sm font-medium text-slate-300">
              Quantidade de WhatsApps
              <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" max={50} min="1" onChange={(event) => setLeadBatch(Math.min(Math.max(Number(event.target.value || 1), 1), 50))} type="number" value={leadBatch} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-300">
              Numeros do lote
              <textarea className="min-h-28 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-3 text-slate-100 outline-none" name="batchPhones" onChange={(event) => setBatchPhonesText(event.target.value)} placeholder={`Um numero por linha. Ex.:\n75992456130\n5511999999999`} value={batchPhonesText} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-300">
              Mensagem do lote
              <textarea className="min-h-28 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-3 text-slate-100 outline-none" name="batchMessage" defaultValue="Ola! Aqui e da Escola Biblica Novo Tempo. Estamos felizes pelo seu interesse e queremos ajudar voce a continuar seus estudos." />
            </label>
            <button className={primaryButtonClass} disabled={batchLoading} type="submit">
              <ClipboardList size={18} />
              {batchLoading ? 'Enviando...' : 'Enviar lote'}
            </button>
            {lastBatch ? (
              <div className="rounded-2xl border border-emerald-300/45 bg-emerald-600/80 p-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15">
                Lote finalizado: {lastBatch.sent || 0} enviadas, {lastBatch.failed || 0} falhas.
              </div>
            ) : null}
          </form>
          <article className={`${panelClass} p-6 max-xl:col-span-1 xl:col-span-2`}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className={labelClass}>Leads para WhatsApp</span>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-50">Selecionar contatos por distrito e ML</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Filtre os leads da Associacao Paulistana, escolha quentes ou potenciais, marque contatos e envie os WhatsApps para o lote.
                </p>
              </div>
              <div className="grid min-w-[12rem] gap-1 rounded-2xl border border-blue-300/40 bg-gradient-to-br from-blue-600 to-slate-950 px-4 py-3 text-right shadow-[0_18px_42px_rgba(37,99,235,0.22)]">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">Selecionados</span>
                <strong className="text-2xl font-black text-white">{formatNumber(selectedWhatsappLeads.length)}</strong>
              </div>
            </div>

            <div className="grid grid-cols-[1.1fr_1.1fr_1fr_1.4fr_auto] gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
              <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Associacao
                <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm font-bold text-slate-100 outline-none" onChange={(event) => setLeadFilter('association', event.target.value)} value={leadFilters.association}>
                  <option value="paulistana">Associacao Paulistana</option>
                  {associations.filter((association) => association.id !== 'paulistana').map((association) => (
                    <option disabled key={association.id} value={association.id}>{association.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Distrito
                <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm font-bold text-slate-100 outline-none" onChange={(event) => setLeadFilter('distrito', event.target.value)} value={leadFilters.distrito}>
                  <option value="all">Todos os distritos</option>
                  {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Prioridade ML
                <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm font-bold text-slate-100 outline-none" onChange={(event) => setLeadFilter('prioridade', event.target.value)} value={leadFilters.prioridade}>
                  <option value="Hot">Quentes</option>
                  <option value="Warm">Potenciais</option>
                  <option value="all">Todas</option>
                </select>
              </label>
              <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Buscar
                <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm font-bold text-slate-100 outline-none placeholder:text-slate-600" onChange={(event) => setLeadFilter('search', event.target.value)} placeholder="Nome, distrito ou WhatsApp" value={leadFilters.search} />
              </label>
              <div className="grid content-end">
                <button className={primaryButtonClass} onClick={selectFilteredBatch} type="button">
                  <CheckCircle2 size={18} />
                  Selecionar lote
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-500">
                {formatNumber(filteredWhatsappLeads.length)} leads encontrados com WhatsApp. Exibindo {formatNumber(visibleWhatsappLeads.length)}.
              </span>
              <div className="flex flex-wrap gap-2">
                <button className={ghostButtonClass} onClick={clearLeadSelection} type="button">Limpar selecao</button>
                <button className={ghostButtonClass} onClick={exportSelectedLeads} type="button">Exportar contatos</button>
              </div>
            </div>

            <div className="mt-5 max-h-[32rem] overflow-auto rounded-2xl border border-white/[0.07]">
              <table className="w-full border-collapse text-sm">
                <thead
                  className="cursor-pointer"
                  onClick={() => setSelectedAdminLead(selectedWhatsappLeads[0] || visibleWhatsappLeads[0] || null)}
                  title="Abrir detalhes do primeiro lead visivel ou selecionado"
                >
                  <tr className="bg-slate-950/85 text-left transition hover:bg-slate-900">
                    {['Enviar', 'Nome', 'WhatsApp', 'Distrito', 'Prioridade ML', 'Score'].map((head) => (
                      <th className="sticky top-0 z-[1] whitespace-nowrap border-b border-white/[0.12] bg-slate-950/95 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/80" key={head}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleWhatsappLeads.map((lead) => {
                    const checked = selectedLeadIds.has(lead.id);
                    return (
                      <tr className={`cursor-pointer transition ${checked ? 'bg-blue-500/10' : 'hover:bg-white/[0.035]'}`} key={lead.id} onClick={() => setSelectedAdminLead(lead)} title={`Abrir detalhes de ${lead.n}`}>
                        <td className="border-b border-white/[0.04] px-4 py-3">
                          <input aria-label={`Selecionar ${lead.n}`} checked={checked} className="h-4 w-4 accent-blue-600" onChange={() => selectLead(lead)} onClick={(event) => event.stopPropagation()} type="checkbox" />
                        </td>
                        <td className="min-w-[14rem] border-b border-white/[0.04] px-4 py-3">
                          <strong className="block text-slate-50">{lead.n}</strong>
                          <span className="text-xs font-semibold text-slate-500">ID {lead.id}</span>
                        </td>
                        <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-black tabular-nums text-emerald-400">{phoneDigits(lead.tel)}</td>
                        <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-bold text-slate-300">{lead.d}</td>
                        <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${lead.p === 'Hot' ? 'bg-orange-500 text-white' : lead.p === 'Warm' ? 'bg-amber-500 text-white' : 'bg-slate-600 text-white'}`}>
                            {crmPriorityLabels[lead.p] || lead.p}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-white/[0.04] px-4 py-3 font-black tabular-nums text-slate-100">{lead.s}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
          <LeadDetailModal lead={selectedAdminLead} onClose={() => setSelectedAdminLead(null)} />
          <article className={`${panelClass} p-6 max-xl:col-span-1 xl:col-span-2`}>
            <span className={labelClass}>Filas sugeridas</span>
            <div className="mt-5 grid gap-3">
              {queueCards.map(([title, value, tag, tone]) => (
                <div className={`interactive-card grid grid-cols-[1fr_auto] rounded-2xl border border-white/30 bg-gradient-to-br ${tone} p-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.14)]`} key={title}>
                  <div>
                    <strong className="font-semibold text-white">{title}</strong>
                    <span className="mt-1 block text-sm text-white/78">{tag}</span>
                  </div>
                  <strong className="text-2xl font-extrabold text-white">{formatNumber(value)}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {section === 'audit' ? (
        <section className={`${panelClass} p-6`}>
          <span className={labelClass}>Auditoria administrativa</span>
          <div className="mt-5 grid gap-3">
            {auditEvents.map((event, index) => (
              <div className={`interactive-card grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-white/30 bg-gradient-to-br ${auditColors[index % auditColors.length]} p-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.14)]`} key={event.id}>
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/30 bg-white/18 text-white">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <strong className="block font-semibold text-white">{event.action}</strong>
                  <span className="text-sm text-white/78">{event.user} · {event.detail}</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">{event.when}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {section === 'ml' ? (
        <section className="grid grid-cols-[1fr_1fr] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Ranking ML</span>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-50">Governança do modelo</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              O admin geral precisa saber quando a base foi calculada, quantos registros entraram no ranking e qual arquivo alimenta a prioridade operacional.
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-violet-300/40 bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4 text-white shadow-[0_18px_42px_rgba(124,58,237,0.18)]"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Registros ML</span><strong className="mt-1 block text-3xl font-extrabold text-white">{formatNumber(data.total)}</strong></div>
              <div className="rounded-2xl border border-orange-300/40 bg-gradient-to-br from-red-600 to-orange-500 p-4 text-white shadow-[0_18px_42px_rgba(239,68,68,0.18)]"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Leads quentes</span><strong className="mt-1 block text-3xl font-extrabold text-white">{formatNumber(data.hot)}</strong></div>
            </div>
          </article>
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Controles do admin</span>
            <div className="mt-5 grid gap-3">
              {['Importar novo ranking CSV', 'Recalcular prioridade operacional', 'Registrar versão do modelo', 'Bloquear exportação sem permissão'].map((item) => (
                <button
                  className={`${ghostButtonClass} justify-start`}
                  key={item}
                  onClick={() => toast.info(item, { description: 'Controle preparado na interface do admin geral.' })}
                  type="button"
                >
                  <Sparkles size={17} />
                  {item}
                </button>
              ))}
            </div>
          </article>
        </section>
      ) : null}
      <InboxConversationModal
        answer={selectedAnswer}
        item={conversationModalOpen ? selectedInboxItem : null}
        onClose={() => setConversationModalOpen(false)}
        question={selectedQuestion}
      />
    </div>
  );
}

function ConversationsView({ records = [] }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('Ola! Aqui e da Escola Biblica Novo Tempo. Como posso ajudar voce hoje?');
  const chatEndRef = useRef(null);
  const activePhoneRef = useRef('');
  const lastSeenMessageIdRef = useRef(null);

  async function loadConversations(phone = '', options = {}) {
    const { silent = false, notify = false, selectSearched = false } = options;
    if (!silent) setLoading(true);
    try {
      const query = phoneDigits(phone);
      const recentParams = new URLSearchParams({
        limit: '10',
        _: String(Date.now())
      });
      const searchedParams = new URLSearchParams({
        limit: '1',
        _: String(Date.now())
      });
      if (query) searchedParams.set('phone', query);

      const requestOptions = {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      };
      const [recentResponse, searchedResponse] = await Promise.all([
        apiFetch(`/api/whatsapp/conversations?${recentParams.toString()}`, requestOptions),
        query ? apiFetch(`/api/whatsapp/conversations?${searchedParams.toString()}`, requestOptions) : Promise.resolve(null)
      ]);
      const recentPayload = recentResponse.ok ? await recentResponse.json() : { conversations: [] };
      const searchedPayload = searchedResponse?.ok ? await searchedResponse.json() : { conversations: [] };
      const byId = new Map();
      [...(searchedPayload.conversations || []), ...(recentPayload.conversations || [])].forEach((conversation) => {
        byId.set(conversation.id, conversation);
      });
      const nextConversations = Array.from(byId.values()).slice(0, query ? 11 : 10);
      const searchedConversation = query
        ? nextConversations.find((conversation) => phoneDigits(conversation.phone).endsWith(query.slice(-10)))
        : null;
      const nextSelected = selectSearched
        ? searchedConversation
        : nextConversations.find((conversation) => conversation.id === selectedId)
          || nextConversations[0]
          || null;
      const nextMessages = nextSelected?.messages || [];
      const nextLastMessage = nextMessages[nextMessages.length - 1] || null;
      const previousLastMessageId = lastSeenMessageIdRef.current;

      setConversations(nextConversations);
      setSelectedId((current) => (
        selectSearched
          ? searchedConversation?.id || null
          : nextConversations.some((conversation) => conversation.id === current)
          ? current
          : nextConversations[0]?.id || null
      ));
      if (nextLastMessage?.id) {
        lastSeenMessageIdRef.current = nextLastMessage.id;
      }
      if (
        notify
        && previousLastMessageId
        && nextLastMessage?.id
        && nextLastMessage.id !== previousLastMessageId
        && nextLastMessage.direction === 'INBOUND'
      ) {
        toast.success('Nova resposta recebida', {
          description: nextLastMessage.body
        });
      }
    } catch {
      if (!silent) setConversations([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  const leadOptions = useMemo(
    () => records
      .filter((lead) => lead.t && phoneDigits(lead.tel))
      .sort((a, b) => (b.s || 0) - (a.s || 0))
      .slice(0, 80),
    [records]
  );
  const searchedPhone = phoneDigits(phoneSearch);
  const selectedById = conversations.find((conversation) => conversation.id === selectedId) || null;
  const searchedConversation = searchedPhone
    ? conversations.find((conversation) => phoneDigits(conversation.phone).endsWith(searchedPhone.slice(-10)))
    : null;
  const selectedConversation = searchedPhone ? searchedConversation : selectedById || conversations[0] || null;
  const activePhone = searchedPhone || selectedConversation?.phone || '';
  const messages = selectedConversation?.messages || [];
  const lastMessage = messages[messages.length - 1];
  const activeLead = records.find((lead) => phoneDigits(lead.tel).endsWith(String(activePhone).slice(-10)));
  const quickActions = [
    ['Resumo', 'Gerar resumo da conversa para o coordenador.'],
    ['Visita', 'Marcar como candidato para visita ou estudo presencial.'],
    ['IA', 'Preparar sugestao de resposta antes do envio.'],
    ['Pausa', 'Registrar pedido para nao receber novas mensagens.']
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedConversation?.id]);

  useEffect(() => {
    activePhoneRef.current = activePhone;
  }, [activePhone]);

  useEffect(() => {
    if (lastMessage?.id) {
      lastSeenMessageIdRef.current = lastMessage.id;
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations(activePhoneRef.current || phoneSearch, { silent: true, notify: true });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phoneSearch, selectedId]);

  async function submitSearch(event) {
    event.preventDefault();
    await loadConversations(phoneSearch, { selectSearched: true });
  }

  async function submitMessage(event) {
    event.preventDefault();
    const phone = activePhone;
    const message = messageText.trim();
    if (!phone || !message) {
      toast.error('Informe telefone e mensagem');
      return;
    }

    setSending(true);
    try {
      const response = await apiFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          message,
          leadId: activeLead?.id || selectedConversation?.externalLeadId || null,
          name: activeLead?.n || selectedConversation?.leadName || null,
          district: activeLead?.d || selectedConversation?.district || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel enviar a mensagem.');
      setMessageText('');
      await loadConversations(phone, { selectSearched: true });
      setSelectedId(payload.conversationId || selectedId);
      toast.success('Mensagem salva na conversa', {
        description: `Historico atualizado para ${payload.phone || phone}.`
      });
    } catch (error) {
      toast.error('Falha ao enviar', { description: error.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className={labelClass}>WhatsApp</span>
            <h1 className="silver-title mt-2 text-5xl font-extrabold leading-tight tracking-normal max-md:text-4xl">Conversas</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Atendimento por numero com historico salvo no banco, leitura das respostas e ferramentas de acompanhamento para transformar mensagem em cuidado real.
            </p>
          </div>
          <form className="flex min-w-[20rem] gap-2 max-sm:min-w-0 max-sm:w-full" onSubmit={submitSearch}>
            <input
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm font-bold text-slate-100 outline-none placeholder:text-slate-600"
              onChange={(event) => setPhoneSearch(event.target.value)}
              placeholder="Buscar ou digitar numero"
              value={phoneSearch}
            />
            <button className={primaryButtonClass} type="submit">
              <Search size={18} />
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-[22rem_1fr_18rem] gap-4 max-2xl:grid-cols-[20rem_1fr] max-lg:grid-cols-1">
        <aside className={`${panelClass} flex min-h-[42rem] flex-col overflow-hidden p-4`}>
          <div className="flex items-center justify-between gap-3">
            <span className={labelClass}>Numeros</span>
            <button className={`${ghostButtonClass} h-9 px-3`} onClick={() => loadConversations()} type="button">Atualizar</button>
          </div>
          <div className="mt-4 grid min-h-0 flex-1 content-start gap-2 overflow-auto pr-1">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">Carregando conversas...</div>
            ) : conversations.length ? conversations.map((conversation) => {
              const conversationMessages = conversation.messages || [];
              const currentLast = conversationMessages[conversationMessages.length - 1];
              return (
                <button
                  className={`interactive-card flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 ${selectedConversation?.id === conversation.id ? 'border-blue-400 ring-4 ring-blue-500/10' : 'border-slate-200'}`}
                  key={conversation.id}
                  onClick={() => {
                    setSelectedId(conversation.id);
                    setPhoneSearch(conversation.phone);
                  }}
                  type="button"
                >
                  <ContactAvatar name={conversation.leadName} phone={conversation.phone} />
                  <span className="min-w-0">
                  <strong className="block truncate text-sm font-black text-slate-950">{conversation.leadName || conversation.phone}</strong>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-600">{conversation.phone} · {conversation.district || 'Distrito nao vinculado'}</span>
                  <span className="mt-2 block truncate text-xs font-bold text-slate-500">{currentLast?.body || 'Sem mensagens registradas'}</span>
                  </span>
                </button>
              );
            }) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                Nenhuma conversa salva para esse filtro. Digite um numero e envie a primeira mensagem.
              </div>
            )}
          </div>
        </aside>

        <article className={`${panelClass} flex min-h-[42rem] flex-col overflow-hidden`}>
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <ContactAvatar name={activeLead?.n || selectedConversation?.leadName} phone={activePhone} size="lg" />
                <span className="min-w-0">
                  <span className={labelClass}>Atendimento</span>
                <h2 className="mt-1 text-2xl font-black text-slate-50">{activeLead?.n || selectedConversation?.leadName || activePhone || 'Novo numero'}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{activePhone || 'Digite um numero para iniciar'}{activeLead?.d ? ` · ${activeLead.d}` : ''}</p>
                </span>
              </div>
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                {lastMessage?.direction === 'INBOUND' ? 'Responder' : 'Em acompanhamento'}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-950/20 p-5">
            <div className="grid gap-3">
              {messages.length ? messages.map((message) => {
                const outgoing = message.direction === 'OUTBOUND';
                const deliveredByReply = outgoing && messages.some((nextMessage) => (
                  nextMessage.direction === 'INBOUND'
                  && new Date(nextMessage.createdAt || 0) > new Date(message.createdAt || 0)
                ));
                return (
                  <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`} key={message.id}>
                    <div className={`max-w-[78%] rounded-2xl border px-4 py-3 shadow-[0_12px_34px_rgba(15,23,42,0.08)] ${outgoing ? 'border-blue-300 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-800'}`}>
                      <span className={`block text-[11px] font-black uppercase tracking-[0.14em] ${outgoing ? 'text-blue-100' : 'text-slate-500'}`}>
                        {outgoing ? 'Mensagem enviada' : 'Pergunta recebida'}
                      </span>
                      <p className="mt-1 text-sm font-semibold leading-relaxed">{message.body}</p>
                      <span className={`mt-2 flex items-center justify-end gap-1.5 text-[11px] font-bold ${outgoing ? 'text-blue-100' : 'text-slate-500'}`}>
                        <span>{message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR') : 'Sem data'}</span>
                        {outgoing ? <DeliveryReceipt deliveredByReply={deliveredByReply} message={message} /> : null}
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div className="grid min-h-[20rem] place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-700">
                  A conversa deste numero ainda nao tem mensagens salvas.
                </div>
              )}
              <span ref={chatEndRef} />
            </div>
          </div>

          <form className="grid gap-3 border-t border-white/[0.07] p-5" onSubmit={submitMessage}>
            <textarea
              className="min-h-28 rounded-2xl border border-white/[0.08] bg-slate-950/70 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-100 outline-none placeholder:text-slate-600"
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Digite sua resposta"
              value={messageText}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">Ao enviar, a mensagem fica ligada ao numero no banco de dados.</span>
              <button className={primaryButtonClass} disabled={sending || !activePhone} type="submit">
                <Send size={18} />
                {sending ? 'Enviando...' : 'Enviar resposta'}
              </button>
            </div>
          </form>
        </article>

        <aside className={`${panelClass} grid content-start gap-4 p-5 max-2xl:col-span-2 max-lg:col-span-1`}>
          <div>
            <span className={labelClass}>Ferramentas</span>
            <h2 className="mt-1 text-xl font-black text-slate-50">Proximas acoes</h2>
          </div>
          {quickActions.map(([title, detail]) => (
            <button
              className="interactive-card rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-blue-300"
              key={title}
              onClick={() => toast.info(title, { description: detail })}
              type="button"
            >
              <strong className="block text-sm font-black text-slate-950">{title}</strong>
              <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-600">{detail}</span>
            </button>
          ))}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Poderiamos implementar mais</span>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
              etiquetas por assunto, status de atendimento, responsavel, resposta sugerida por IA, resumo automatico, opt-out e tarefas de visita ligadas a conversa.
            </p>
          </div>
        </aside>
      </section>

      <section className={`${panelClass} p-6`}>
        <span className={labelClass}>Base de contatos</span>
        <div className="mt-4 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          {leadOptions.slice(0, 8).map((lead) => (
            <button
              className="interactive-card rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-blue-300"
              key={lead.id}
              onClick={() => {
                setPhoneSearch(phoneDigits(lead.tel));
                loadConversations(lead.tel);
              }}
              type="button"
            >
              <strong className="block truncate text-sm font-black text-slate-950">{lead.n}</strong>
              <span className="mt-1 block text-xs font-semibold text-slate-600">{phoneDigits(lead.tel)} · {lead.d}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AIAgentView({ associations = [], campaigns = [], data, records = [] }) {
  const [tab, setTab] = useState('overview');
  const [mode, setMode] = useState('assistido');
  const [active, setActive] = useState(false);
  const [selectedReviewLead, setSelectedReviewLead] = useState(null);
  const hotWhatsapp = records.filter((lead) => lead.t && lead.p === 'Hot').length;
  const studyWhatsapp = records.filter((lead) => lead.t && lead.e).length;
  const vipWhatsapp = records.filter((lead) => lead.t && lead.v).length;
  const reviewQueue = records
    .filter((lead) => lead.t && (lead.p === 'Hot' || lead.e || lead.v))
    .sort((a, b) => (b.s || 0) - (a.s || 0))
    .slice(0, 6);
  const knowledgeItems = [
    ['Campanha ativa', campaigns.find((campaign) => campaign.status === 'Ativa')?.name || 'Nenhuma campanha ativa'],
    ['Associacao padrao', associations[0]?.name || 'Associacao Paulistana'],
    ['Leads com WhatsApp', formatNumber(data.phone)],
    ['Estudos ativos', formatNumber(data.studies)]
  ];
  const tabs = [
    ['overview', 'Visao geral'],
    ['agent', 'Agente'],
    ['campaigns', 'Campanhas'],
    ['knowledge', 'Base'],
    ['flows', 'Fluxos'],
    ['review', 'Revisao'],
    ['safety', 'Seguranca'],
    ['metrics', 'Metricas']
  ];
  const guardrails = [
    'Nao prometer visita sem confirmacao humana.',
    'Encaminhar temas sensiveis para humano.',
    'Respeitar pedido de parar contato.',
    'Responder apenas dentro das campanhas liberadas.',
    'Registrar toda sugestao, resposta e decisao no historico.'
  ];
  const flowSteps = [
    ['Entrada', 'Lead responde no WhatsApp ou entra em campanha autorizada.'],
    ['Triagem', 'IA identifica interesse, duvida, pedido de visita ou opt-out.'],
    ['Resposta assistida', 'IA prepara resposta para aprovacao humana.'],
    ['Encaminhamento', 'Quando necessario, envia para gestor, coordenador ou voluntario.']
  ];

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className={labelClass}>IA de atendimento</span>
            <h1 className="silver-title mt-2 text-5xl font-black leading-tight tracking-normal max-md:text-4xl">Agente IA</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Configure a IA que futuramente fara triagem, sugestao de respostas e acompanhamento das campanhas no WhatsApp, sempre preservando revisao humana e auditoria.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className={active ? ghostButtonClass : primaryButtonClass}
              onClick={() => {
                setActive((value) => !value);
                toast.message(active ? 'IA pausada' : 'IA ativada em modo assistido');
              }}
              type="button"
            >
              <WandSparkles size={18} />
              {active ? 'Pausar IA' : 'Ativar IA'}
            </button>
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 shadow-[0_10px_28px_rgba(15,23,42,0.07)] outline-none" onChange={(event) => setMode(event.target.value)} value={mode}>
              <option value="assistido">Modo assistido</option>
              <option value="rascunho">Somente rascunho</option>
              <option value="automatico">Automatico com limites</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard detail={active ? 'modo ativo' : 'modo pausado'} icon={WandSparkles} label="Status IA" tone={active ? 'green' : 'violet'} value={active ? 'Ativa' : 'Pausada'} />
        <MetricCard detail="leads prioritarios" icon={Sparkles} label="Quentes WhatsApp" tone="orange" value={formatNumber(hotWhatsapp)} />
        <MetricCard detail="para acompanhar" icon={ClipboardList} label="Estudos ativos" tone="green" value={formatNumber(studyWhatsapp)} />
        <MetricCard detail="relacionamento" icon={Crown} label="VIPs WhatsApp" tone="violet" value={formatNumber(vipWhatsapp)} />
        <MetricCard detail="primeira etapa segura" icon={ShieldCheck} label="Modo" value={mode === 'assistido' ? 'Assistido' : mode === 'rascunho' ? 'Rascunho' : 'Auto'} />
      </section>

      <section className={`${panelClass} p-3`}>
        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              className={`inline-flex h-10 items-center rounded-xl px-3 text-sm font-black transition ${tab === id ? 'bg-blue-600 text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)]' : 'bg-white/70 text-slate-700 hover:bg-white'}`}
              key={id}
              onClick={() => setTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'overview' ? (
        <section className="grid grid-cols-[1fr_0.85fr] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Painel executivo</span>
            <h2 className="mt-2 text-2xl font-black text-slate-50">Como a IA entra na operacao</h2>
            <div className="mt-5 grid gap-3">
              {[
                ['Triagem de respostas', 'Classifica interesse, duvida, visita, estudo ativo e pedido de pausa.'],
                ['Sugestao de mensagem', 'Prepara resposta para aprovacao humana antes do envio.'],
                ['Encaminhamento humano', 'Leads sensiveis ou promissores vao para gestor, coordenador ou voluntario.'],
                ['Auditoria completa', 'Toda resposta sugerida, aprovada ou enviada fica registrada.']
              ].map(([title, detail]) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={title}>
                  <strong className="text-slate-950">{title}</strong>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{detail}</p>
                </div>
              ))}
            </div>
          </article>
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Checklist de implantacao</span>
            <div className="mt-5 grid gap-3">
              {['Definir instrucao do agente', 'Selecionar campanhas permitidas', 'Cadastrar base de conhecimento', 'Ativar modo assistido', 'Revisar respostas antes do automatico'].map((item, index) => (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={item}>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl text-sm font-black text-white ${index < 2 ? 'bg-emerald-600' : 'bg-slate-700'}`}>{index + 1}</span>
                  <strong className="text-sm">{item}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'agent' ? (
        <section className="grid grid-cols-[1fr_0.9fr] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Configuracao do agente</span>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-slate-300">Nome da IA<input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" defaultValue="Assistente Novo Tempo" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Tom de voz<select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" defaultValue="acolhedor"><option value="acolhedor">Acolhedor e breve</option><option value="formal">Formal</option><option value="jovem">Jovem e simples</option><option value="pastoral">Pastoral cuidadoso</option></select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Instrucao principal<textarea className="min-h-36 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-3 text-slate-100 outline-none" defaultValue="Voce e uma assistente da Escola Biblica Novo Tempo. Seja acolhedora, objetiva e respeitosa. Ajude a confirmar interesse, tirar duvidas simples e encaminhar casos sensiveis para um humano." /></label>
              <button className={primaryButtonClass} onClick={() => toast.success('Configuracao da IA preparada')} type="button"><CheckCircle2 size={18} />Salvar configuracao</button>
            </div>
          </article>
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Limites do agente</span>
            <div className="mt-5 grid gap-3">
              {guardrails.map((item) => (
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={item}>
                  <input className="mt-1 h-4 w-4 accent-blue-600" defaultChecked type="checkbox" />
                  {item}
                </label>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'campaigns' ? (
        <section className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
          {campaigns.map((campaign) => (
            <article className={`${panelClass} p-5`} key={campaign.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-100"><Radio size={20} /></span>
                <label className="inline-flex items-center gap-2 text-sm font-black text-slate-300"><input className="h-4 w-4 accent-blue-600" defaultChecked={campaign.status === 'Ativa'} type="checkbox" /> IA</label>
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-50">{campaign.name}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">{campaign.association}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Objetivo sugerido: confirmar interesse e encaminhar para estudo ou visita.</div>
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'knowledge' ? (
        <section className="grid grid-cols-[0.9fr_1.1fr] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Base operacional</span>
            <div className="mt-5 grid gap-3">
              {knowledgeItems.map(([label, value]) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={label}>
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
                  <strong className="mt-1 block text-slate-950">{value}</strong>
                </div>
              ))}
            </div>
          </article>
          <article className={`${panelClass} p-6`}>
            <span className={labelClass}>Conteudo aprovado</span>
            <textarea className="mt-5 min-h-64 w-full rounded-2xl border border-white/[0.08] bg-slate-950/70 px-4 py-4 text-sm leading-relaxed text-slate-100 outline-none" defaultValue="Perguntas frequentes, links oficiais, materiais disponiveis, horarios de atendimento, orientacoes pastorais e mensagens aprovadas devem ser cadastrados aqui antes do modo automatico." />
          </article>
        </section>
      ) : null}

      {tab === 'flows' ? (
        <section className={`${panelClass} p-6`}>
          <span className={labelClass}>Fluxo de atendimento</span>
          <div className="mt-5 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
            {flowSteps.map(([title, detail], index) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={title}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white">{index + 1}</span>
                <strong className="mt-4 block text-lg text-slate-950">{title}</strong>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'review' ? (
        <section className={`${panelClass} p-6`}>
          <button
            className="block w-full rounded-2xl bg-slate-950/85 p-4 text-left transition hover:bg-slate-900"
            onClick={() => setSelectedReviewLead(reviewQueue[0] || null)}
            title="Abrir detalhes do primeiro lead da fila"
            type="button"
          >
            <span className={labelClass}>Revisao assistida</span>
            <h2 className="mt-1 text-2xl font-black text-slate-50">Leads para a IA sugerir resposta</h2>
          </button>
          <div className="mt-5 grid gap-3">
            {reviewQueue.map((lead) => (
              <div className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-blue-300 max-md:grid-cols-1" key={lead.id} onClick={() => setSelectedReviewLead(lead)} title={`Abrir detalhes de ${lead.n}`}>
                <div>
                  <strong className="text-slate-950">{lead.n}</strong>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">{lead.d} · {lead.tel || 'sem telefone'} · score {lead.s}</span>
                </div>
                <button className={ghostButtonClass} onClick={(event) => { event.stopPropagation(); toast.info('Sugestao preparada', { description: `IA prepararia uma resposta assistida para ${lead.n}.` }); }} type="button">Gerar sugestao</button>
              </div>
            ))}
          </div>
          <LeadDetailModal lead={selectedReviewLead} onClose={() => setSelectedReviewLead(null)} />
        </section>
      ) : null}

      {tab === 'safety' ? (
        <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          {[
            ['Bloqueios sensiveis', 'luto, saude, abuso, crise emocional, reclamacao grave, pedido pastoral profundo'],
            ['Opt-out', 'parar, remover, nao quero, cancelar, sair'],
            ['Limites', 'maximo de mensagens por lead, horario permitido e pausa manual imediata'],
            ['Auditoria', 'salvar prompt, resposta sugerida, resposta enviada, custo e aprovador']
          ].map(([title, detail]) => (
            <article className={`${panelClass} p-6`} key={title}>
              <span className={labelClass}>Seguranca</span>
              <h2 className="mt-2 text-xl font-black text-slate-50">{title}</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">{detail}</p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'metrics' ? (
        <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          {[
            ['Elegiveis para IA', hotWhatsapp + studyWhatsapp + vipWhatsapp, 'quentes, estudos e VIPs'],
            ['Modo atual', mode === 'assistido' ? 'Assistido' : mode === 'rascunho' ? 'Rascunho' : 'Auto', 'politica de resposta'],
            ['Campanhas ativas', campaigns.filter((campaign) => campaign.status === 'Ativa').length, 'podem receber IA'],
            ['Custo estimado', 'R$ 0,00', 'sem uso de IA ainda']
          ].map(([label, value, detail]) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]" key={label}>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
              <strong className="mt-2 block text-3xl font-black text-slate-950">{typeof value === 'number' ? formatNumber(value) : value}</strong>
              <span className="mt-1 block text-sm font-semibold text-slate-600">{detail}</span>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SettingsView({ theme, onToggleTheme }) {
  const settings = [
    {
      title: 'Perfil do sistema',
      description: 'Nome Amigos NT, identidade visual, domínio e dados institucionais.',
      status: 'Configurado',
      icon: Crown
    },
    {
      title: 'Permissões e acessos',
      description: 'Perfis de admin geral, gestor de associação, coordenador e voluntário.',
      status: 'Prioritário',
      icon: ShieldCheck
    },
    {
      title: 'Integração WhatsApp',
      description: 'Fornecedor oficial, templates, opt-out e controle de disparos.',
      status: 'Pendente',
      icon: MessageCircle
    },
    {
      title: 'Banco de dados',
      description: 'PostgreSQL, Prisma, auditoria e política de retenção dos interessados.',
      status: 'Base criada',
      icon: Gauge
    },
    {
      title: 'Notificações',
      description: 'Alertas para leads sem resposta, visitas pendentes e automações.',
      status: 'Ativo',
      icon: Bell
    },
    {
      title: 'Aparência',
      description: 'Modo light prateado como padrão e dark como alternativa.',
      status: theme === 'light' ? 'Light ativo' : 'Dark ativo',
      icon: Sparkles
    }
  ];

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className={labelClass}>Administração</span>
            <h1 className="silver-title mt-2 text-5xl font-black leading-tight tracking-normal max-md:text-4xl">Configurações</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Centralize os ajustes críticos do Amigos NT em um painel organizado, com foco em segurança, operação e consistência visual.
            </p>
          </div>
          <button
            className={primaryButtonClass}
            onClick={() => {
              onToggleTheme();
              toast.message(theme === 'light' ? 'Modo dark ativado' : 'Modo light prateado ativado');
            }}
            type="button"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            Alternar tema
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {settings.map(({ title, description, status, icon: Icon }) => (
          <article className={`${panelClass} interactive-card settings-card p-5`} key={title}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <span className="settings-icon grid h-12 w-12 place-items-center rounded-xl border">
                <Icon size={22} />
              </span>
              <span className="settings-status rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide">{status}</span>
            </div>
            <h2 className="text-xl font-black text-slate-50">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
            <button
              className={`${ghostButtonClass} mt-5 h-10`}
              onClick={() => toast.info(title, { description: 'Configuração detalhada será conectada ao backend nas próximas etapas.' })}
              type="button"
            >
              Abrir ajuste
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-[1fr_1fr] gap-4 max-lg:grid-cols-1">
        <article className={`${panelClass} p-6`}>
          <span className={labelClass}>Checklist técnico</span>
          <div className="mt-5 grid gap-3">
            {['Configurar DATABASE_URL de produção', 'Gerar AUTH_SECRET definitivo', 'Criar migrações iniciais no Prisma', 'Definir provedor oficial de WhatsApp'].map((item) => (
              <div className="settings-row flex items-center gap-3 rounded-xl border p-3" key={item}>
                <CheckCircle2 size={18} />
                <span className="text-sm font-bold text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </article>
        <article className={`${panelClass} p-6`}>
          <span className={labelClass}>Preferências visuais</span>
          <div className="mt-5 grid gap-3">
            <button className={`${theme === 'light' ? primaryButtonClass : ghostButtonClass} justify-start`} onClick={() => theme !== 'light' && onToggleTheme()} type="button">
              <Sun size={18} />
              Light prateado
            </button>
            <button className={`${theme === 'dark' ? primaryButtonClass : ghostButtonClass} justify-start`} onClick={() => theme !== 'dark' && onToggleTheme()} type="button">
              <Moon size={18} />
              Dark premium
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}

function PlaceholderView({ title, subtitle, icon: Icon }) {
  return (
    <section className={`${panelClass} grid min-h-[28rem] place-items-center p-8 text-center`}>
      <div>
        <Icon className="mx-auto text-slate-200" size={42} />
        <h1 className="silver-title mt-5 text-4xl font-black">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">{subtitle}</p>
      </div>
    </section>
  );
}

function AppShell({ children, current, onBack, canGoBack = false, onNavigate, onLogout, theme, onToggleTheme, user, associations = [], selectedAssociationId = '', onSelectAssociation }) {
  const isLight = theme === 'light';
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const headerNavItems = navigationItemsForUser(user);
  const title = isAdminUser(user) ? 'Administração Geral' : accessLabelForUser(user);

  return (
    <div className={`silver-stage ${isLight ? 'app-light' : 'app-dark'} min-h-screen text-slate-100`}>
      <AppToaster theme={theme} />
      <div className="flex min-h-screen gap-4 p-4 max-lg:flex-col max-lg:p-0">
      <Sidebar compact={sidebarCompact} current={current} onLogout={onLogout} onNavigate={onNavigate} onToggleCompact={() => setSidebarCompact((value) => !value)} user={user} />
      <div className="flex min-h-[calc(100vh-2rem)] min-w-0 flex-1 flex-col overflow-visible rounded-[1.75rem] max-lg:min-h-screen max-lg:rounded-none">
        <header className="app-header-glass sticky top-4 z-50 shrink-0 rounded-t-[1.75rem] border-b border-white/[0.07] bg-slate-950/40 px-8 py-4 backdrop-blur-2xl max-lg:top-0 max-lg:rounded-none max-md:px-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div>
              <span className={labelClass}>Amigos NT</span>
              <h2 className="text-xl font-black text-slate-50">{title}</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {isAdminUser(user) && associations.length ? (
                <label className="relative hidden min-w-64 md:inline-flex">
                  <select
                    className="app-header-control interactive-card h-10 w-full appearance-none rounded-xl border border-slate-900/10 bg-white/55 px-4 pr-10 text-sm font-black text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)] outline-none transition hover:bg-white/70 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/12"
                    onChange={(event) => onSelectAssociation?.(event.target.value)}
                    value={selectedAssociationId}
                  >
                    {associations.map((association) => (
                      <option key={association.id} value={association.id}>{association.name}</option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-500" size={17} />
                </label>
              ) : null}
              {canGoBack ? (
                <button
                  aria-label="Voltar"
                  className="app-header-control interactive-card grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-900/10 bg-white/55 text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
                  onClick={onBack}
                  type="button"
                >
                  <ArrowRight className="rotate-180" size={17} />
                </button>
              ) : null}
              <button
                className="app-header-control interactive-card inline-flex h-10 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/55 px-3 text-sm font-black text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
                onClick={() => {
                  onToggleTheme();
                  toast.message(isLight ? 'Modo dark ativado' : 'Modo light prateado ativado', {
                    description: isLight ? 'A opção escura fica disponível como modo alternativo.' : 'O fundo prateado voltou a ser a experiência principal.'
                  });
                }}
                type="button"
              >
                {isLight ? <Moon size={17} /> : <Sun size={17} />}
                {isLight ? 'Dark' : 'Light'}
              </button>
              <button
                className="app-header-control interactive-card relative grid h-10 w-10 place-items-center rounded-xl border border-slate-900/10 bg-white/55 text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
                onClick={() => toast('0 notificacoes operacionais', {
                  description: '0 leads sem resposta, 0 visitas pendentes e 0 automacoes prontas para revisao.',
                  action: {
                    label: 'Ver',
                    onClick: () => setTimeout(() => toast.info('Central de notificações será aberta na próxima etapa.'), 0)
                  }
                })}
                type="button"
                aria-label="Notificações"
              >
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
                <Bell size={18} />
              </button>
              <div className="group relative hidden md:block">
                <button
                  className="app-header-control interactive-card inline-flex h-10 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/55 px-4 text-sm font-black text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
                  type="button"
                >
                  <span className="grid h-6 w-6 place-items-center rounded bg-slate-900/10 text-slate-800">
                    <UsersRound size={14} />
                  </span>
                  {user?.name || 'Admin'}
                </button>
                <div className="absolute right-0 top-full z-50 invisible pt-3 opacity-0 transition-all duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="w-[260px] rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-[0_30px_60px_-15px_rgba(15,23,42,0.15)] ring-1 ring-slate-900/5 backdrop-blur-2xl">
                    <div className="px-3 pb-2 pt-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Configurações</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {headerNavItems.map(([id, label, Icon]) => (
                        <button
                          className={`group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-all hover:bg-slate-100 hover:text-slate-900 ${current === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}
                          key={id}
                          onClick={() => onNavigate(id)}
                          type="button"
                        >
                          <Icon size={16} className={`transition-colors group-hover/item:text-blue-500 ${current === id ? 'text-blue-600' : 'text-slate-400'}`} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="my-1.5 h-px bg-slate-200/80" />
                    <button
                      className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      onClick={onLogout}
                      type="button"
                    >
                      <LogOut size={16} className="text-red-400 transition-colors group-hover/item:text-red-600" />
                      Sair da conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-8 pb-6 pt-6 max-lg:pb-28 max-md:px-4">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}

function DetailsShell({ payload, onBack, onLogout, onNavigate, onOpenDistrict, user }) {
  const [sidebarCompact, setSidebarCompact] = useState(true);

  return (
    <div className="silver-stage app-light min-h-screen text-slate-100">
      <AppToaster theme="light" />
      <div className="flex min-h-screen gap-4 p-4 max-lg:flex-col max-lg:p-0">
        <Sidebar
          compact={sidebarCompact}
          current="associations"
          onLogout={onLogout}
          onNavigate={onNavigate}
          onToggleCompact={() => setSidebarCompact((value) => !value)}
          user={user}
        />
        <div className="min-w-0 flex-1 overflow-hidden rounded-[1.75rem] max-lg:rounded-none max-lg:pb-24">
          <DashboardClient onBack={onBack} onOpenDistrict={onOpenDistrict} payload={payload} />
        </div>
      </div>
    </div>
  );
}

function DistrictInterestDashboard({ districtName = 'Alphaville', interestRecords = [], onBack }) {
  const data = useMemo(() => ({
    total: interestRecords.length,
    phone: interestRecords.filter((lead) => lead.temTelefone).length,
    hot: interestRecords.filter((lead) => lead.vipHistorico).length,
    vip: interestRecords.filter((lead) => lead.vipHistorico).length,
    studies: interestRecords.filter((lead) => Number(lead.materiaisQuantidade) > 0).length,
    districts: interestRecords.length ? 1 : 0,
    campaignTrend: [
      { etapa: 'Base', leads: interestRecords.length },
      { etapa: 'WhatsApp', leads: interestRecords.filter((lead) => lead.temTelefone).length },
      { etapa: 'Tentativa', leads: interestRecords.filter((lead) => lead.tentativaContato === true).length },
      { etapa: 'Resposta', leads: interestRecords.filter((lead) => lead.respondeu === true).length },
      { etapa: 'Interesse', leads: interestRecords.filter((lead) => lead.demonstrouInteresse === true).length },
      { etapa: 'Visita', leads: interestRecords.filter((lead) => lead.aceitouVisita === true).length }
    ]
  }), [interestRecords]);

  return (
    <div className="grid gap-6">
      <section className={`${panelClass} overflow-hidden p-6`}>
        <div className="flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <span className={labelClass}>Distrito com dados detalhados</span>
            <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-50 max-md:text-3xl">{districtName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
              Painel exclusivo dos registros reais vindos da base piloto deste distrito.
            </p>
          </div>
          <button className={ghostButtonClass} onClick={onBack} type="button">
            <ArrowRight className="rotate-180" size={18} />
            Voltar aos distritos
          </button>
        </div>
      </section>
      <LeadAnalyticsSection data={data} records={[]} interestRecords={interestRecords} onlyPilot />
      <DistrictLeadScoreList records={interestRecords} />
    </div>
  );
}

function DashboardLoadingView({ title = 'Carregando base', subtitle = 'Preparando o dashboard administrativo...' }) {
  return (
    <section className={`${panelClass} grid min-h-[420px] place-items-center p-6 text-center`}>
      <div>
        <div className="login-loading-spinner mx-auto mb-5">
          <Gauge size={22} />
        </div>
        <h1 className="text-2xl font-black text-slate-50">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-400">{subtitle}</p>
      </div>
    </section>
  );
}

function DistrictLeadScoreList({ records = [] }) {
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(80);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records
      .filter((lead) => {
        if (!term) return true;
        const haystack = `${lead.n || ''} ${lead.tel || ''} ${lead.em || ''} ${lead.materialPrincipal || ''} ${lead.bairro || ''}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.n || '').localeCompare(String(b.n || '')));
  }, [records, search]);
  const visible = filtered.slice(0, visibleLimit);

  useEffect(() => {
    setVisibleLimit(80);
  }, [search, records]);

  return (
    <section className={`${panelClass} p-6`}>
      <div className="mb-5 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <span className={labelClass}>Lista operacional</span>
          <h2 className="mt-1 text-2xl font-black text-slate-50">Leads do distrito por score</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Nomes ordenados pela pontuação operacional, com prioridade, WhatsApp, VIP, estudo ativo e material principal.
          </p>
        </div>
        <label className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="h-12 w-full rounded-2xl border border-white/[0.08] bg-slate-950/50 pl-11 pr-4 text-sm font-bold text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/15"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nome, telefone, e-mail, bairro..."
            value={search}
          />
        </label>
      </div>

      <div className="grid gap-3">
        {visible.length ? visible.map((lead, index) => {
          const priority = lead.priority || 'Cold';
          const priorityText = lead.priorityLabel || (priority === 'Hot' ? 'Quente' : priority === 'Warm' ? 'Potencial' : priority === 'Cool' ? 'Morno' : 'Frio');
          return (
            <article
              className="group grid grid-cols-[auto_1fr_auto] items-start gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-950/72 via-slate-900/45 to-white/[0.035] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.16)] transition duration-300 hover:-translate-y-1 hover:border-blue-300/45 hover:shadow-[0_24px_60px_rgba(37,99,235,0.18)] max-md:grid-cols-1"
              key={`${lead.id}-${lead.n}-${index}`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.18)]">
                #{index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-words text-base font-black text-slate-50">{lead.n || 'Lead sem nome'}</strong>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${priority === 'Hot' ? 'bg-orange-600 text-white' : priority === 'Warm' ? 'bg-blue-600 text-white' : priority === 'Cool' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-white'}`}>
                    {priorityText}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm font-semibold text-slate-400">
                  {lead.bairro || lead.d || 'Local não informado'} · {lead.tel || 'sem telefone'} · {lead.em || 'sem e-mail'} · último contato: {Number.isFinite(Number(lead.raw?.c)) ? `${formatNumber(lead.raw.c)} dias` : 'sem informação'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-white">WhatsApp: {lead.temTelefone ? 'sim' : 'não'}</span>
                  <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-white">VIP: {lead.vipHistorico ? 'sim' : 'não'}</span>
                  <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-white">Estudo: {lead.estudoAtivo || Number(lead.materiaisQuantidade) > 0 ? 'sim' : 'não'}</span>
                  <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-white">Material: {lead.materialPrincipal || 'não informado'}</span>
                  <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-white">Último contato: {Number.isFinite(Number(lead.raw?.c)) ? `${formatNumber(lead.raw.c)} dias` : 'sem informação'}</span>
                </div>
              </div>
              <strong className="rounded-2xl bg-blue-600 px-4 py-2 text-lg font-black text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)]">
                {Number(lead.score || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              </strong>
            </article>
          );
        }) : (
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/45 p-6 text-center text-sm font-semibold text-slate-400">
            Nenhum lead encontrado para a pesquisa atual.
          </div>
        )}
      </div>

      {filtered.length > visible.length ? (
        <button
          className="mx-auto mt-5 flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-slate-950 shadow-[0_16px_34px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5 hover:bg-blue-50"
          onClick={() => setVisibleLimit((current) => current + 80)}
          type="button"
        >
          Carregar mais {formatNumber(Math.min(80, filtered.length - visible.length))}
        </button>
      ) : null}
    </section>
  );
}

function openDetailsView(setView) {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  setView('details');
  requestAnimationFrame(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

export default function CrmApp({ payload: initialPayload = null }) {
  const initialAssociations = initialPayload ? buildInitialAssociations(initialPayload.records) : [];
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [authReady, setAuthReady] = useState(true);
  const [restoringSession, setRestoringSession] = useState(false);
  const [theme, setTheme] = useState('light');
  const [selectedAssociationId, setSelectedAssociationId] = useState('paulistana');
  const [selectedDistrictName, setSelectedDistrictName] = useState('Alphaville');
  const [payload, setPayload] = useState(initialPayload);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [districtInterestBySlug, setDistrictInterestBySlug] = useState({});
  const [loadingDistrictSlug, setLoadingDistrictSlug] = useState(null);
  const [viewHistory, setViewHistory] = useState([]);
  const [associations, setAssociations] = useState(() => initialAssociations);
  const [adminUsers, setAdminUsers] = useState(() => buildAdminUsers(initialAssociations));
  const [adminCampaigns, setAdminCampaigns] = useState(() => buildAdminCampaigns(initialAssociations));
  const [auditEvents, setAuditEvents] = useState([
    { id: 'audit-login', action: 'Login administrativo', user: 'Admin geral', detail: 'Sessão aberta com perfil ADMIN_GERAL', when: 'Agora' },
    { id: 'audit-export', action: 'Exportação controlada', user: 'Gestão Paulistana', detail: 'Relatório de distritos filtrados disponível', when: 'Hoje' },
    { id: 'audit-ml', action: 'Ranking ML carregado', user: 'Sistema', detail: 'Prioridade operacional aplicada ao dashboard', when: 'Hoje' }
  ]);
  const baseRecords = useMemo(() => scopedRecordsForUser(payload?.records || [], user), [payload, user]);
  const visibleAssociations = useMemo(() => scopedAssociationsForUser(associations, user), [associations, user]);
  const selectedAssociation = visibleAssociations.find((association) => association.id === selectedAssociationId) || visibleAssociations[0];
  const selectedAssociationSlug = selectedAssociation?.id || selectedAssociationId;
  const records = useMemo(() => (
    isAdminUser(user) && selectedAssociationSlug !== 'paulistana' ? [] : baseRecords
  ), [baseRecords, selectedAssociationSlug, user]);
  const interestRecords = useMemo(() => (
    selectedAssociationSlug === 'paulistana' ? payload?.interestRecords || [] : []
  ), [payload, selectedAssociationSlug]);
  const selectedDistrictInterestRecords = useMemo(() => {
    if (selectedAssociationSlug !== 'paulistana') return [];
    const slug = slugifyDistrictName(selectedDistrictName);
    return districtInterestBySlug[slug] || payload?.interestRecordsByDistrict?.[slug] || [];
  }, [districtInterestBySlug, payload, selectedAssociationSlug, selectedDistrictName]);
  const data = useMemo(() => buildAssociationData(records), [records]);
  const filteredAssociations = useMemo(() => {
    if (!isAdminUser(user)) return visibleAssociations;
    if (!selectedAssociation) return visibleAssociations;
    const selectedData = buildAssociationData(records);
    return [{
      ...selectedAssociation,
      leads: selectedData.total,
      hot: selectedData.hot,
      studies: selectedData.studies,
      districts: selectedData.districts
    }];
  }, [records, selectedAssociation, user, visibleAssociations]);

  useEffect(() => {
    if (!user || view === 'login') return;
    if (!canOpenView(user, view)) {
      setView(defaultViewForUser(user));
      setViewHistory([]);
    }
  }, [user, view]);

  useEffect(() => {
    if (!visibleAssociations.length) return;
    if (!visibleAssociations.some((association) => association.id === selectedAssociationId)) {
      setSelectedAssociationId(visibleAssociations[0].id);
    }
  }, [selectedAssociationId, visibleAssociations]);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const storedToken = window.localStorage.getItem('sevenflow_token');
      if (!storedToken) {
        setAuthReady(true);
        setRestoringSession(false);
        setView('login');
        return;
      }

      setAuthReady(false);
      setRestoringSession(true);

      try {
        const response = await apiFetch('/api/auth/me');
        if (!response.ok) {
          window.localStorage.removeItem('sevenflow_token');
          if (active) setView('login');
          return;
        }

        const session = await response.json();
        if (!session?.user) {
          window.localStorage.removeItem('sevenflow_token');
          if (active) setView('login');
          return;
        }

        if (!active) return;
        setUser(session.user);
        setView(defaultViewForUser(session.user));
        loadDashboard().catch(() => {
          if (active) {
            toast.error('Backend nao foi lido', {
              description: 'Sua sessao foi restaurada, mas os dados do dashboard ainda nao carregaram.'
            });
          }
        });
      } catch {
        window.localStorage.removeItem('sevenflow_token');
        if (active) setView('login');
      } finally {
        if (active) {
          setAuthReady(true);
          setRestoringSession(false);
        }
      }
    }

    restoreSession();
    return () => { active = false; };
  }, []);

  async function loadDashboard() {
    setDashboardLoading(true);
    try {
      const response = await apiFetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Nao foi possivel carregar os dados do backend.');
      }
      const nextPayload = await response.json();
      const nextAssociations = buildInitialAssociations(nextPayload.records);
      setPayload(nextPayload);
      setAssociations(nextAssociations);
      setAdminUsers(buildAdminUsers(nextAssociations));
      setAdminCampaigns(buildAdminCampaigns(nextAssociations));
      setDistrictInterestBySlug({});
    } finally {
      setDashboardLoading(false);
    }
  }

  async function openDistrictInterest(districtName) {
    const slug = slugifyDistrictName(districtName);
    setSelectedDistrictName(districtName);
    setViewHistory((history) => [...history, 'details'].slice(-20));
    setView('district-interest');
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));

    if (districtInterestBySlug[slug]?.length || payload?.interestRecordsByDistrict?.[slug]?.length) return;

    setLoadingDistrictSlug(slug);
    try {
      const response = await apiFetch(`/api/dashboard/district-interest/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error('Nao foi possivel carregar o distrito.');
      const result = await response.json();
      setDistrictInterestBySlug((current) => ({
        ...current,
        [slug]: result.records || []
      }));
    } catch {
      toast.error('Distrito nao foi carregado', {
        description: 'Tente abrir este distrito novamente em alguns instantes.'
      });
    } finally {
      setLoadingDistrictSlug(null);
    }
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.localStorage.removeItem('sevenflow_token');
    setUser(null);
    setViewHistory([]);
    setView('login');
  }

  function navigateView(nextView) {
    if (nextView === view) return;
    if (!canOpenView(user, nextView)) {
      setViewHistory([]);
      setView(defaultViewForUser(user));
      return;
    }
    setViewHistory((history) => [...history, view].filter((item) => item !== 'login').slice(-20));
    setView(nextView);
  }

  function goBack() {
    setViewHistory((history) => {
      const defaultView = defaultViewForUser(user);
      const previous = history[history.length - 1] || defaultView;
      setView(previous === 'login' ? defaultView : previous);
      return history.slice(0, -1);
    });
  }

  function openAssociation(id) {
    if (!visibleAssociations.some((association) => association.id === id)) return;
    setSelectedAssociationId(id);
    navigateView('association');
  }

  if (!authReady && restoringSession) {
    return (
      <div className="silver-stage min-h-screen">
        <AppToaster theme={theme} />
        <div className="login-loading-overlay" role="status" aria-live="polite">
          <div className="login-loading-card">
            <div className="login-loading-spinner">
              <Gauge size={22} />
            </div>
            <strong>Restaurando acesso</strong>
            <span>Verificando sua sessao administrativa...</span>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return <LoginScreen onLogin={async (loggedUser) => {
      setUser(loggedUser);
      setView(defaultViewForUser(loggedUser));
      loadDashboard().catch(() => {
        toast.error('Backend nao foi lido', {
          description: 'A autenticacao funcionou, mas os dados do dashboard nao foram carregados.'
        });
      });
    }} />;
  }

  if (!payload) {
    return (
      <AppShell
        current={view}
        onBack={goBack}
        onLogout={logout}
        onNavigate={navigateView}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        associations={visibleAssociations}
        selectedAssociationId={selectedAssociation?.id || ''}
        onSelectAssociation={setSelectedAssociationId}
        theme={theme}
        user={user}
      >
        <DashboardLoadingView />
      </AppShell>
    );
  }

  if (view === 'details') {
    return (
      <DetailsShell
        onBack={goBack}
        onLogout={logout}
        onOpenDistrict={(districtName) => {
          openDistrictInterest(districtName);
          return true;
        }}
        onNavigate={navigateView}
        payload={payload}
        user={user}
      />
    );
  }

  const addAdminCampaign = (campaign) => {
    setAdminCampaigns((current) => [campaign, ...current]);
    setAuditEvents((current) => [
      { id: `audit-${Date.now()}`, action: 'Campanha criada', user: user?.name || 'Admin geral', detail: campaign.name, when: 'Agora' },
      ...current
    ]);
  };
  const addAdminUser = (nextUser) => {
    setAdminUsers((current) => [nextUser, ...current]);
    setAuditEvents((current) => [
      { id: `audit-${Date.now()}`, action: 'Acesso criado', user: user?.name || 'Admin geral', detail: `${nextUser.name} · ${nextUser.role.replaceAll('_', ' ')}`, when: 'Agora' },
      ...current
    ]);
  };
  const adminGeneralProps = {
    associations: filteredAssociations,
    auditEvents,
    campaigns: adminCampaigns,
    data,
    onAddCampaign: addAdminCampaign,
    onAddUser: addAdminUser,
    records,
    users: adminUsers
  };
  const effectiveView = canOpenView(user, view) ? view : defaultViewForUser(user);

  let content = null;
  if (effectiveView === 'admin') {
    content = (
      <AdminDashboard
        associations={filteredAssociations}
        canManageAdmin={isAdminUser(user)}
        data={data}
        isAssociationsView={false}
        onAddAssociation={(association) => setAssociations((current) => [association, ...current])}
        onOpenAdminGeneral={() => navigateView('general-admin')}
        onOpenAssociations={() => navigateView('associations')}
        onOpenAssociation={openAssociation}
        onOpenLeads={() => navigateView('leads')}
        onOpenUsers={() => navigateView('users')}
      />
    );
  } else if (effectiveView === 'associations' && isAdminUser(user) && selectedAssociation) {
    content = (
      <AssociationDashboard
        association={selectedAssociation}
        data={data}
        onDatasetUpdated={loadDashboard}
        onOpenDetails={() => openDetailsView(navigateView)}
        onOpenHistory={() => navigateView('dataset-history')}
        interestRecords={[]}
        records={records}
        user={user}
      />
    );
  } else if (effectiveView === 'associations') {
    content = (
      <AdminDashboard
        associations={filteredAssociations}
        canManageAdmin={isAdminUser(user)}
        data={data}
        isAssociationsView
        onAddAssociation={(association) => setAssociations((current) => [association, ...current])}
        onOpenAdminGeneral={() => navigateView('general-admin')}
        onOpenAssociations={() => navigateView('associations')}
        onOpenAssociation={openAssociation}
        onOpenLeads={() => navigateView('leads')}
        onOpenUsers={() => navigateView('users')}
      />
    );
  } else if (effectiveView === 'leads') {
    content = (
      <LeadsView
        associations={filteredAssociations}
        churchesByDistrict={payload?.meta?.territory?.churchesByDistrict || {}}
        data={data}
        datasetUpdateHistory={payload?.meta?.datasetUpdateHistory || []}
        lastDatasetUpdate={payload?.meta?.lastDatasetUpdate}
        officialDistricts={payload?.meta?.territory?.districts || []}
        onDatasetUpdated={loadDashboard}
        onNavigate={navigateView}
        records={records}
        user={user}
      />
    );
  } else if (effectiveView === 'dataset-history') {
    content = <DatasetHistoryView history={payload?.meta?.datasetUpdateHistory || []} onBack={goBack} />;
  } else if (effectiveView === 'geolocation') {
    content = (
      <GeolocationView
        churchesByDistrict={payload?.meta?.territory?.churchesByDistrict || {}}
        officialDistricts={payload?.meta?.territory?.districts || []}
        onBack={goBack}
        onDatasetUpdated={loadDashboard}
        records={records}
      />
    );
  } else if (['general-admin', 'users'].includes(effectiveView)) {
    content = (
      <AdminGeneralView
        {...adminGeneralProps}
        initialSection={effectiveView === 'users' ? 'users' : 'overview'}
      />
    );
  } else if (effectiveView === 'campaigns') {
    content = isAdminUser(user)
      ? <AdminGeneralView {...adminGeneralProps} initialSection="campaigns" />
      : <PlaceholderView icon={Radio} subtitle="As campanhas desta associação serão listadas aqui quando estiverem cadastradas." title="Campanhas" />;
  } else if (effectiveView === 'association') {
    content = (
      <AssociationDashboard
        association={selectedAssociation}
        data={data}
        onDatasetUpdated={loadDashboard}
        onOpenDetails={() => openDetailsView(navigateView)}
        onOpenHistory={() => navigateView('dataset-history')}
        interestRecords={[]}
        records={records}
        user={user}
      />
    );
  } else if (effectiveView === 'district-interest') {
    const selectedDistrictSlug = slugifyDistrictName(selectedDistrictName);
    content = loadingDistrictSlug === selectedDistrictSlug && !selectedDistrictInterestRecords.length ? (
      <DashboardLoadingView
        title="Carregando distrito"
        subtitle={`Preparando os registros de ${selectedDistrictName}...`}
      />
    ) : (
      <DistrictInterestDashboard
        districtName={selectedDistrictName}
        interestRecords={selectedDistrictInterestRecords}
        onBack={goBack}
      />
    );
  } else if (effectiveView === 'automations') {
    content = isAdminUser(user)
      ? <AdminGeneralView {...adminGeneralProps} initialSection="distribution" />
      : <PlaceholderView icon={MessageCircle} subtitle="O WhatsApp desta associação será exibido aqui com conversas, envios e indicadores próprios." title="WhatsApp" />;
  } else if (effectiveView === 'conversations') {
    content = <ConversationsView records={records} />;
  } else if (effectiveView === 'ai-agent') {
    content = <AIAgentView associations={filteredAssociations} campaigns={adminCampaigns} data={data} records={records} />;
  } else if (effectiveView === 'reports') {
    content = isAdminUser(user)
      ? <AdminGeneralView {...adminGeneralProps} initialSection="audit" />
      : <PlaceholderView icon={PieChart} subtitle="Os relatórios desta associação serão exibidos aqui com base apenas nos dados reais carregados." title="Relatórios" />;
  } else if (effectiveView === 'settings') {
    content = <SettingsView onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} theme={theme} />;
  } else {
    content = <AdminGeneralView {...adminGeneralProps} initialSection="audit" />;
  }

  return (
    <AppShell
      current={effectiveView === 'association' ? 'associations' : effectiveView}
      canGoBack={effectiveView !== defaultViewForUser(user)}
      onBack={goBack}
      onLogout={logout}
      onNavigate={navigateView}
      onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      associations={visibleAssociations}
      selectedAssociationId={selectedAssociation?.id || ''}
      onSelectAssociation={(id) => {
        setSelectedAssociationId(id);
        if (['admin', 'associations', 'association'].includes(effectiveView)) {
          setView('associations');
        }
      }}
      theme={theme}
      user={user}
    >
      {content}
    </AppShell>
  );
}
