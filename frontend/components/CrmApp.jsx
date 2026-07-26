'use client';

import { useEffect, useMemo, useState } from 'react';
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
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Crown,
  Eye,
  EyeOff,
  Gauge,
  LayoutDashboard,
  Lock,
  LogOut,
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
  UsersRound,
  WandSparkles
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import DashboardClient from './DashboardClient';

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500';
const primaryButtonClass = 'primary-button-glow group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_52%,#0f172a_100%)] px-4 text-sm font-bold text-white shadow-[0_18px_46px_rgba(37,99,235,0.34)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_24px_70px_rgba(37,99,235,0.30)] focus:outline-none focus:ring-4 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-70';
const ghostButtonClass = 'group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-900/10 bg-white/60 px-4 text-sm font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_28px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-slate-900/20 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-400/15';
const panelClass = 'premium-panel rounded-2xl border border-white/[0.08] bg-slate-950/60 shadow-[0_28px_90px_rgba(0,0,0,0.34)] ring-1 ring-white/[0.035] backdrop-blur-2xl';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('sevenflow_token') : '';
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
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

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
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
      campaigns: 4,
      leads: data.total,
      hot: data.hot,
      studies: data.studies,
      districts: data.districts,
      conversion: data.conversion,
      featured: true
    },
    {
      id: 'sul',
      name: 'Associação Paulista Sul',
      region: 'Grande São Paulo',
      status: 'Planejada',
      campaigns: 2,
      leads: 12840,
      hot: 932,
      studies: 611,
      districts: 31,
      conversion: 5
    },
    {
      id: 'leste',
      name: 'Associação Paulista Leste',
      region: 'Zona Leste e Alto Tietê',
      status: 'Planejada',
      campaigns: 1,
      leads: 9630,
      hot: 604,
      studies: 428,
      districts: 26,
      conversion: 4
    }
  ];
}

function buildAdminUsers(associations) {
  return [
    {
      id: 'user-admin-central',
      name: 'Admin central',
      email: 'admin@leadsnt.com.br',
      role: 'ADMIN_GERAL',
      scope: 'Todas as associacoes',
      status: 'Ativo'
    },
    {
      id: 'user-paulistana',
      name: 'Gestao Paulistana',
      email: 'paulistana@leadsnt.com.br',
      role: 'GESTOR_ASSOCIACAO',
      scope: associations[0]?.name || 'Associacao Paulistana',
      status: 'Ativo'
    },
    {
      id: 'user-coord',
      name: 'Coordenacao de campanha',
      email: 'coordenacao@leadsnt.com.br',
      role: 'COORDENADOR_CAMPANHA',
      scope: 'Campanhas ativas',
      status: 'Convite pendente'
    },
    {
      id: 'user-volunteer',
      name: 'Equipe de visitas',
      email: 'visitas@leadsnt.com.br',
      role: 'VOLUNTARIO',
      scope: 'Leads atribuidos',
      status: 'Ativo'
    }
  ];
}

function buildAdminCampaigns(associations) {
  return [
    {
      id: 'campaign-escola-biblica',
      name: 'Escola Biblica Novo Tempo',
      association: associations[0]?.name || 'Associacao Paulistana',
      status: 'Ativa',
      owner: 'Gestao Paulistana',
      goal: 1800
    },
    {
      id: 'campaign-familia',
      name: 'Curso Familia',
      association: associations[0]?.name || 'Associacao Paulistana',
      status: 'Planejada',
      owner: 'Coordenacao de campanha',
      goal: 600
    },
    {
      id: 'campaign-reencontro',
      name: 'Reencontro Novo Tempo',
      association: associations[1]?.name || 'Associacao Paulista Sul',
      status: 'Planejada',
      owner: 'Admin central',
      goal: 900
    }
  ];
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
      toast.success('Bem-vindo ao Leads NT', {
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

      <section className={`relative grid w-full max-w-6xl grid-cols-[1.1fr_0.9fr] gap-5 max-lg:grid-cols-1 ${splashState === 'visible' ? 'opacity-0' : 'stagger-in'}`}>
        <div className={`${panelClass} flex min-h-[34rem] flex-col justify-between p-8 max-sm:p-5`}>
          <div>

            <h1 className="silver-title max-w-2xl text-6xl font-black leading-tight tracking-normal max-md:text-4xl text-center">
              Leads NT
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
            <h2 className="mt-2 text-2xl font-black text-slate-50 text-center">Acesso aos Leads NT</h2>
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
    </main>
  );
}

function Sidebar({ compact, current, onNavigate, onLogout, onToggleCompact, user }) {
  const items = [
    ['admin', 'Dashboard', LayoutDashboard],
    ['general-admin', 'Admin geral', ShieldCheck],
    ['associations', 'Associações', Building2],
    ['users', 'Acessos', UsersRound],
    ['campaigns', 'Campanhas', Radio],
    ['automations', 'WhatsApp', MessageCircle],
    ['reports', 'Relatórios', PieChart]
  ];
  items.push(['settings', 'Configurações', Settings]);

  return (
    <aside className={`sidebar-shell sticky top-4 z-40 flex h-[calc(100vh-2rem)] shrink-0 flex-col rounded-[1.75rem] border p-4 text-slate-100 backdrop-blur-2xl transition-all duration-300 max-lg:relative max-lg:top-0 max-lg:h-auto max-lg:w-full ${compact ? 'w-24' : 'w-72'}`}>
      <div className={`mb-8 flex items-center gap-3 ${compact ? 'justify-center' : ''}`}>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(226,232,240,0.12)]">
          <img src="/novo-tempo.jpg" alt="Logo Novo Tempo" className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-normal" />
        </div>
        <div className={compact ? 'hidden' : 'block'}>
          <strong className="silver-title block text-xl font-black">Leads NT</strong>
          <span className="text-xs font-bold text-slate-500">Admin central</span>
        </div>
      </div>

      <button
        className="sidebar-toggle mb-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-black transition duration-300 hover:-translate-y-0.5 max-lg:hidden"
        onClick={onToggleCompact}
        type="button"
      >
        {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        <span className={compact ? 'hidden' : 'inline'}>Recolher menu</span>
      </button>

      <nav className="grid gap-2">
        {items.map(([id, label, Icon]) => (
          <button
            className={`sidebar-nav-item group flex h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-black transition-all duration-300 ${compact ? 'justify-center hover:-translate-y-1' : 'hover:translate-x-1.5'} ${current === id ? 'nav-active' : 'nav-idle'}`}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
            title={compact ? label : undefined}
          >
            <Icon className="transition group-hover:scale-110" size={19} />
            <span className={compact ? 'hidden' : 'inline'}>{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto grid gap-3">
        <button className={`${ghostButtonClass} group transition-all duration-300 ${compact ? 'px-0 hover:-translate-y-1' : 'hover:translate-x-1.5'}`} onClick={onLogout} type="button" title={compact ? 'Sair' : undefined}>
          <LogOut className="transition duration-300 group-hover:scale-110" size={18} />
          <span className={compact ? 'hidden' : 'inline'}>Sair</span>
        </button>
      </div>
    </aside>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'silver' }) {
  const tones = {
    silver: {
      card: 'border-blue-300/40 bg-gradient-to-br from-blue-600 to-cyan-500 text-white',
      icon: 'text-white bg-white/18 border-white/30'
    },
    green: {
      card: 'border-emerald-300/40 bg-gradient-to-br from-emerald-600 to-teal-500 text-white',
      icon: 'text-white bg-white/18 border-white/30'
    },
    orange: {
      card: 'border-orange-300/40 bg-gradient-to-br from-red-600 to-orange-500 text-white',
      icon: 'text-white bg-white/18 border-white/30'
    },
    violet: {
      card: 'border-violet-300/40 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white',
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

function AdminDashboard({ associations, data, onOpenAssociation, onAddAssociation }) {
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
            <span className={labelClass}>Painel admin</span>
            <h1 className="silver-title mt-2 text-5xl font-black leading-tight tracking-normal max-md:text-4xl">
              Dashboard das associações
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Gerencie territórios, campanhas e performance dos leads em um painel central com navegação limpa e efeitos sutis de interação.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className={primaryButtonClass} onClick={() => onOpenAssociation('paulistana')} type="button">
                Abrir Associação Paulistana
                <ArrowRight size={18} />
              </button>
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
        <MetricCard detail={`${associations.length} territórios cadastrados`} icon={Building2} label="Associações" value={formatNumber(associations.length)} />
        <MetricCard detail="campanhas mapeadas" icon={Radio} label="Campanhas" tone="green" value={formatNumber(totals.campaigns)} />
        <MetricCard detail="com prioridade alta" icon={Sparkles} label="Leads quentes" tone="orange" value={formatNumber(totals.hot)} />
        <MetricCard detail="em acompanhamento" icon={ClipboardList} label="Estudos ativos" tone="violet" value={formatNumber(totals.studies)} />
      </section>

      <section className="grid grid-cols-[1fr_24rem] gap-4 max-xl:grid-cols-1 stagger-in" style={{ animationDelay: '200ms' }}>
        <article className={`${panelClass} p-6`}>
          <div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
            <div>
              <span className={labelClass}>Associações</span>
              <h2 className="mt-1 text-2xl font-black text-slate-50">Territórios cadastrados</h2>
            </div>
            <div className="relative w-80 max-md:w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
              <input className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 pl-10 pr-3 text-sm font-bold text-slate-200 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" placeholder="Buscar associação..." />
            </div>
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
          <AddAssociationForm onAdd={onAddAssociation} />
          <div className={`${panelClass} interactive-card p-5`}>
            <span className={labelClass}>Governança</span>
            <h3 className="mt-2 text-xl font-black text-slate-50">Acesso por nível</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Admin geral vê todas as associações. Gestores e voluntários entram apenas nos territórios e leads permitidos.</p>
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

function AssociationDashboard({ association, data, onOpenDetails }) {
  const automations = [
    { name: 'Boas-vindas', status: 'Ativa', sent: 1280, response: '18%', color: 'border-emerald-500/20 bg-emerald-500/[0.04]' },
    { name: 'Devocional 21 dias', status: 'Rascunho', sent: 0, response: '-', color: 'border-slate-500/20 bg-slate-500/[0.04]' },
    { name: 'Convite de visita', status: 'Ativa', sent: 312, response: '31%', color: 'border-blue-500/20 bg-blue-500/[0.04]' }
  ];

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
                Ver detalhes dos interessados
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

      <section className="grid grid-cols-[1.15fr_0.85fr] gap-4 max-xl:grid-cols-1">
        <article className={`${panelClass} p-6`}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <span className={labelClass}>Campanhas</span>
              <h2 className="mt-1 text-xl font-black text-slate-50">Ambientes de captação</h2>
            </div>
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">{association.name}</span>
          </div>
          <div className="grid gap-3">
            <button className="interactive-card group grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-blue-400/20 bg-blue-500/[0.08] p-5 text-left" onClick={onOpenDetails} type="button">
              <span>
                <span className={labelClass}>Campanha ativa</span>
                <strong className="mt-2 block text-2xl font-black text-slate-50">Escola Bíblica Novo Tempo</strong>
                <span className="mt-2 block text-sm leading-relaxed text-slate-400">Clique para abrir a tela Detalhes dos interessados com filtros, prioridades, distritos e exportação.</span>
              </span>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-500 text-white transition group-hover:translate-x-1">
                <ArrowRight size={22} />
              </span>
            </button>
            {['Curso Família', 'Semana Especial', 'Reencontro Novo Tempo'].map((campaign) => (
              <div className="interactive-card grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5" key={campaign}>
                <div>
                  <span className={labelClass}>Próxima campanha</span>
                  <strong className="mt-2 block text-lg text-slate-200">{campaign}</strong>
                </div>
                <span className="rounded-full bg-slate-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Planejada</span>
              </div>
            ))}
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
          {automations.map((automation) => (
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
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminGeneralView({
  associations,
  data,
  users,
  campaigns,
  auditEvents,
  onAddUser,
  onAddCampaign,
  initialSection = 'overview'
}) {
  const [section, setSection] = useState(initialSection);
  const [leadBatch, setLeadBatch] = useState(280);
  const [targetUser, setTargetUser] = useState(users[3]?.name || users[0]?.name || 'Equipe');

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

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
      owner: String(form.get('owner') || 'Admin central'),
      goal: Number(form.get('goal') || 0)
    });
    event.currentTarget.reset();
    toast.success('Campanha adicionada', {
      description: `${name} ficou pronta para acompanhamento administrativo.`
    });
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
        <MetricCard detail={`${pendingUsers} convite pendente`} icon={ShieldCheck} label="Pendências" tone="violet" value={formatNumber(pendingUsers + 4)} />
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
                      <td className="px-4 py-4 font-black text-blue-300">{item.role.replaceAll('_', ' ')}</td>
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
        <section className="grid grid-cols-[0.9fr_1.1fr] gap-4 max-xl:grid-cols-1">
          <article className={`${panelClass} grid content-start gap-5 p-6`}>
            <span className={labelClass}>Distribuição de trabalho</span>
            <label className="grid gap-2 text-sm font-medium text-slate-300">
              Lote de leads quentes
              <input className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" max={data.hot} min="1" onChange={(event) => setLeadBatch(Number(event.target.value || 1))} type="number" value={leadBatch} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-300">
              Responsável
              <select className="h-11 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-slate-100 outline-none" onChange={(event) => setTargetUser(event.target.value)} value={targetUser}>
                {users.map((item) => <option key={item.id}>{item.name}</option>)}
              </select>
            </label>
            <button
              className={primaryButtonClass}
              onClick={() => toast.success('Lote atribuído', { description: `${formatNumber(leadBatch)} leads foram separados para ${targetUser}.` })}
              type="button"
            >
              <ClipboardList size={18} />
              Atribuir lote
            </button>
          </article>
          <article className={`${panelClass} p-6`}>
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
    </div>
  );
}

function SettingsView({ theme, onToggleTheme }) {
  const settings = [
    {
      title: 'Perfil do sistema',
      description: 'Nome Leads NT, identidade visual, domínio e dados institucionais.',
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
              Centralize os ajustes críticos do Leads NT em um painel organizado, com foco em segurança, operação e consistência visual.
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

function AppShell({ children, current, onNavigate, onLogout, theme, onToggleTheme, user }) {
  const isLight = theme === 'light';
  const [sidebarCompact, setSidebarCompact] = useState(false);

  return (
    <div className={`silver-stage ${isLight ? 'app-light' : 'app-dark'} min-h-screen text-slate-100`}>
      <AppToaster theme={theme} />
      <div className="flex min-h-screen gap-4 p-4 max-lg:flex-col max-lg:p-0">
      <Sidebar compact={sidebarCompact} current={current} onLogout={onLogout} onNavigate={onNavigate} onToggleCompact={() => setSidebarCompact((value) => !value)} user={user} />
      <div className="flex min-h-[calc(100vh-2rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] max-lg:min-h-screen max-lg:rounded-none">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-slate-950/60 px-8 py-4 backdrop-blur-2xl max-md:px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className={labelClass}>Leads NT</span>
              <h2 className="text-xl font-black text-slate-50">Administração central</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="interactive-card inline-flex h-10 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-3 text-sm font-black text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
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
                className="interactive-card relative grid h-10 w-10 place-items-center rounded-xl border border-slate-900/10 bg-white/70 text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
                onClick={() => toast('3 notificações operacionais', {
                  description: '12 leads sem resposta, 3 visitas pendentes e 1 automação pronta para revisão.',
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
                  className="interactive-card inline-flex h-10 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-4 text-sm font-black text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.07)]"
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
                      <button className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900" onClick={() => onNavigate('settings')} type="button">
                        <Crown size={16} className="text-slate-400 transition-colors group-hover/item:text-blue-500" />
                        Perfil do sistema
                      </button>
                      <button className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900" onClick={() => onNavigate('settings')} type="button">
                        <ShieldCheck size={16} className="text-slate-400 transition-colors group-hover/item:text-emerald-500" />
                        Permissões e acessos
                      </button>
                      <button className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900" onClick={() => onNavigate('settings')} type="button">
                        <MessageCircle size={16} className="text-slate-400 transition-colors group-hover/item:text-green-500" />
                        Integração WhatsApp
                      </button>
                      <button className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900" onClick={() => onNavigate('settings')} type="button">
                        <Gauge size={16} className="text-slate-400 transition-colors group-hover/item:text-violet-500" />
                        Banco de dados
                      </button>
                      <button className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900" onClick={() => onNavigate('settings')} type="button">
                        <Bell size={16} className="text-slate-400 transition-colors group-hover/item:text-amber-500" />
                        Notificações
                      </button>
                      <button className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900" onClick={() => { onNavigate('settings'); onToggleTheme(); }} type="button">
                        <Sparkles size={16} className="text-slate-400 transition-colors group-hover/item:text-indigo-500" />
                        Aparência
                      </button>
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
        <main className="mx-auto w-full max-w-[1500px] px-8 py-6 max-md:px-4">
          {children}
        </main>
      </div>
      </div>
    </div>
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
  const [theme, setTheme] = useState('light');
  const [selectedAssociationId, setSelectedAssociationId] = useState('paulistana');
  const [payload, setPayload] = useState(initialPayload);
  const [associations, setAssociations] = useState(() => initialAssociations);
  const [adminUsers, setAdminUsers] = useState(() => buildAdminUsers(initialAssociations));
  const [adminCampaigns, setAdminCampaigns] = useState(() => buildAdminCampaigns(initialAssociations));
  const [auditEvents, setAuditEvents] = useState([
    { id: 'audit-login', action: 'Login administrativo', user: 'Admin central', detail: 'Sessão aberta com perfil ADMIN_GERAL', when: 'Agora' },
    { id: 'audit-export', action: 'Exportação controlada', user: 'Gestão Paulistana', detail: 'Relatório de distritos filtrados disponível', when: 'Hoje' },
    { id: 'audit-ml', action: 'Ranking ML carregado', user: 'Sistema', detail: 'Prioridade operacional aplicada ao dashboard', when: 'Hoje' }
  ]);
  const records = payload?.records || [];
  const data = useMemo(() => buildAssociationData(records), [records]);
  const selectedAssociation = associations.find((association) => association.id === selectedAssociationId) || associations[0];

  async function loadDashboard() {
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
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.localStorage.removeItem('sevenflow_token');
    setUser(null);
    setView('login');
  }

  function openAssociation(id) {
    setSelectedAssociationId(id);
    setView('association');
  }

  if (view === 'login') {
    return <LoginScreen onLogin={async (loggedUser) => {
      await loadDashboard();
      setUser(loggedUser);
      setView('admin');
    }} />;
  }

  if (!payload) {
    return null;
  }

  if (view === 'details') {
    return <DashboardClient onBack={() => setView('association')} payload={payload} />;
  }

  const addAdminCampaign = (campaign) => {
    setAdminCampaigns((current) => [campaign, ...current]);
    setAuditEvents((current) => [
      { id: `audit-${Date.now()}`, action: 'Campanha criada', user: user?.name || 'Admin central', detail: campaign.name, when: 'Agora' },
      ...current
    ]);
  };
  const addAdminUser = (nextUser) => {
    setAdminUsers((current) => [nextUser, ...current]);
    setAuditEvents((current) => [
      { id: `audit-${Date.now()}`, action: 'Acesso criado', user: user?.name || 'Admin central', detail: `${nextUser.name} · ${nextUser.role.replaceAll('_', ' ')}`, when: 'Agora' },
      ...current
    ]);
  };
  const adminGeneralProps = {
    associations,
    auditEvents,
    campaigns: adminCampaigns,
    data,
    onAddCampaign: addAdminCampaign,
    onAddUser: addAdminUser,
    users: adminUsers
  };

  let content = null;
  if (view === 'admin' || view === 'associations') {
    content = (
      <AdminDashboard
        associations={associations}
        data={data}
        onAddAssociation={(association) => setAssociations((current) => [association, ...current])}
        onOpenAssociation={openAssociation}
      />
    );
  } else if (['general-admin', 'users', 'campaigns'].includes(view)) {
    content = (
      <AdminGeneralView
        {...adminGeneralProps}
        initialSection={view === 'users' ? 'users' : view === 'campaigns' ? 'campaigns' : 'overview'}
      />
    );
  } else if (view === 'association') {
    content = <AssociationDashboard association={selectedAssociation} data={data} onOpenDetails={() => openDetailsView(setView)} />;
  } else if (view === 'automations') {
    content = <AdminGeneralView {...adminGeneralProps} initialSection="distribution" />;
  } else if (view === 'settings') {
    content = <SettingsView onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} theme={theme} />;
  } else {
    content = <AdminGeneralView {...adminGeneralProps} initialSection="audit" />;
  }

  return (
    <AppShell
      current={view === 'association' ? 'associations' : view}
      onLogout={logout}
      onNavigate={setView}
      onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      theme={theme}
      user={user}
    >
      {content}
    </AppShell>
  );
}

