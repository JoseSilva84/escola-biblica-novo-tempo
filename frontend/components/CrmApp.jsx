'use client';

import { useMemo, useState } from 'react';
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
  Gauge,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  UsersRound,
  WandSparkles
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import DashboardClient from './DashboardClient';

const labelClass = 'text-[11px] font-black uppercase tracking-[0.16em] text-slate-500';
const primaryButtonClass = 'group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_52%,#0f172a_100%)] px-4 text-sm font-black text-white shadow-[0_18px_46px_rgba(37,99,235,0.34)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_24px_70px_rgba(37,99,235,0.30)] focus:outline-none focus:ring-4 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-70';
const ghostButtonClass = 'group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-900/10 bg-white/60 px-4 text-sm font-black text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_28px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-slate-900/20 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-400/15';
const panelClass = 'premium-panel rounded-2xl border border-white/[0.08] bg-slate-950/60 shadow-[0_28px_90px_rgba(0,0,0,0.34)] ring-1 ring-white/[0.035] backdrop-blur-2xl';

function AppToaster({ theme = 'light' }) {
  return (
    <Toaster
      closeButton
      expand
      position="top-right"
      richColors
      theme={theme}
      toastOptions={{
        classNames: {
          toast: 'leads-toast',
          title: 'leads-toast-title',
          description: 'leads-toast-description',
          actionButton: 'leads-toast-action',
          closeButton: 'leads-toast-close'
        }
      }}
    />
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

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password')
      })
    });

    if (!response.ok) {
      setLoading(false);
      const message = 'Use admin@leadsnt.com.br e senha demo123.';
      setError(message);
      toast.error('Não foi possível entrar', {
        description: message
      });
      return;
    }

    const user = await response.json();
    setLoading(false);
    toast.success('Bem-vindo ao Leads NT', {
      description: 'Dashboard admin carregado com sucesso.'
    });
    onLogin(user);
  }

  return (
    <main className="silver-stage app-light grid min-h-screen place-items-center overflow-hidden px-5 py-10 text-slate-100">
      <AppToaster />
      <section className="relative grid w-full max-w-6xl grid-cols-[1.1fr_0.9fr] gap-5 max-lg:grid-cols-1">
        <div className={`${panelClass} flex min-h-[34rem] flex-col justify-between p-8 max-sm:p-5`}>
          <div>
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-slate-200/15 bg-white/[0.055] px-4 py-2 text-sm font-black text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <ShieldCheck size={18} />
              CRM missionário com acesso por associação
            </div>
            <h1 className="silver-title max-w-2xl text-6xl font-black leading-tight tracking-normal max-md:text-4xl">
              Leads NT
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
              Administre associações, campanhas, automações de WhatsApp e interessados da Novo Tempo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {[
              ['Associações', 'Gestão por território', Building2],
              ['Campanhas', 'Funis independentes', Radio],
              ['WhatsApp', 'Aquecimento inteligente', MessageCircle]
            ].map(([title, detail, Icon]) => (
              <div className="interactive-card rounded-xl border border-white/[0.07] bg-slate-950/50 p-4" key={title}>
                <Icon className="mb-3 text-slate-200 drop-shadow-[0_0_16px_rgba(226,232,240,0.20)]" size={22} />
                <strong className="block text-sm text-slate-100">{title}</strong>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        <form className={`${panelClass} grid content-center gap-5 p-8 max-sm:p-5`} onSubmit={submitLogin}>
          <div>
            <span className={labelClass}>Conta admin</span>
            <h2 className="mt-2 text-2xl font-black text-slate-50">Acesso ao Leads NT</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Login demonstrativo de administrador geral, pronto para migrar para usuários reais no PostgreSQL.</p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Email
            <input className="h-12 rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 text-slate-100 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" defaultValue="admin@leadsnt.com.br" name="email" type="email" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Senha
            <input className="h-12 rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 text-slate-100 outline-none transition focus:border-slate-200/40 focus:ring-4 focus:ring-slate-400/10" defaultValue="demo123" name="password" type="password" />
          </label>
          {error ? (
            <p className="rounded-xl border border-red-500/35 bg-red-50 px-4 py-3 text-sm font-black leading-relaxed text-red-800 shadow-[0_12px_34px_rgba(220,38,38,0.10)]">
              Não foi possível entrar. {error}
            </p>
          ) : null}
          <button className={primaryButtonClass} disabled={loading} type="submit">
            <Lock size={18} />
            {loading ? 'Entrando...' : 'Entrar como admin'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Sidebar({ compact, current, onNavigate, onLogout, onToggleCompact, user }) {
  const items = [
    ['admin', 'Dashboard', LayoutDashboard],
    ['associations', 'Associações', Building2],
    ['automations', 'WhatsApp', MessageCircle],
    ['reports', 'Relatórios', Gauge]
  ];

  return (
    <aside className={`sidebar-shell sticky top-4 z-40 flex h-[calc(100vh-2rem)] shrink-0 flex-col rounded-[1.75rem] border p-4 text-slate-100 backdrop-blur-2xl transition-all duration-300 max-lg:relative max-lg:top-0 max-lg:h-auto max-lg:w-full ${compact ? 'w-24' : 'w-72'}`}>
      <div className={`sidebar-brand mb-6 flex items-center gap-3 rounded-2xl border p-3 ${compact ? 'justify-center' : ''}`}>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(135deg,#f8fafc,#64748b_58%,#0f172a)] text-slate-950 shadow-[0_16px_36px_rgba(226,232,240,0.12)]">
          <Crown size={22} />
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
            className={`sidebar-nav-item group flex h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-black transition duration-300 ${compact ? 'justify-center' : ''} ${current === id ? 'nav-active' : 'nav-idle'}`}
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
        <div className={`session-card rounded-2xl border p-4 ${compact ? 'px-2 text-center' : ''}`}>
          <span className={labelClass}>Sessão</span>
          <strong className="mt-2 block text-sm text-emerald-100">{user?.name || 'Admin Leads NT'}</strong>
          <p className="mt-1 text-xs leading-relaxed text-emerald-200/70">Acesso geral para criar associações e acompanhar campanhas.</p>
        </div>
        <button className={`${ghostButtonClass} ${compact ? 'px-0' : ''}`} onClick={onLogout} type="button" title={compact ? 'Sair' : undefined}>
          <LogOut size={18} />
          <span className={compact ? 'hidden' : 'inline'}>Sair</span>
        </button>
      </div>
    </aside>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'silver' }) {
  const tones = {
    silver: 'text-slate-100 bg-white/[0.07] border-slate-200/20',
    green: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
    orange: 'text-orange-300 bg-orange-500/10 border-orange-400/20',
    violet: 'text-violet-300 bg-violet-500/10 border-violet-400/20'
  };

  return (
    <article className={`${panelClass} interactive-card p-5`}>
      <span className={`mb-5 grid h-12 w-12 place-items-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${tones[tone]}`}>
        <Icon size={22} />
      </span>
      <span className={labelClass}>{label}</span>
      <strong className="mt-2 block text-3xl font-black text-slate-50">{value}</strong>
      <span className="mt-2 block text-sm text-slate-500">{detail}</span>
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
      <section className={`${panelClass} overflow-hidden p-6`}>
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
          <div className="min-h-72 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-4 transition duration-300 hover:border-slate-200/25">
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
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} formatter={(value) => formatNumber(value)} />
                <Area dataKey="leads" fill="url(#silverLeadGradient)" stroke="#e2e8f0" strokeWidth={3} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard detail={`${associations.length} territórios cadastrados`} icon={Building2} label="Associações" value={formatNumber(associations.length)} />
        <MetricCard detail="campanhas mapeadas" icon={Radio} label="Campanhas" tone="green" value={formatNumber(totals.campaigns)} />
        <MetricCard detail="com prioridade alta" icon={Sparkles} label="Leads quentes" tone="orange" value={formatNumber(totals.hot)} />
        <MetricCard detail="em acompanhamento" icon={ClipboardList} label="Estudos ativos" tone="violet" value={formatNumber(totals.studies)} />
      </section>

      <section className="grid grid-cols-[1fr_24rem] gap-4 max-xl:grid-cols-1">
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
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${association.status === 'Ativa' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-400'}`}>{association.status}</span>
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
          <div className={`${panelClass} p-5`}>
            <span className={labelClass}>Governança</span>
            <h3 className="mt-2 text-xl font-black text-slate-50">Acesso por nível</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Admin geral vê todas as associações. Gestores e voluntários entram apenas nos territórios e leads permitidos.</p>
          </div>
          <div className={`${panelClass} p-5`}>
            <span className={labelClass}>Comparativo</span>
            <div className="mt-4 h-60">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(226,232,240,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} formatter={(value) => formatNumber(value)} />
                  <Bar dataKey="leads" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="quentes" fill="#60a5fa" radius={[8, 8, 0, 0]} />
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
    { name: 'Boas-vindas', status: 'Ativa', sent: 1280, response: '18%' },
    { name: 'Devocional 21 dias', status: 'Rascunho', sent: 0, response: '-' },
    { name: 'Convite de visita', status: 'Ativa', sent: 312, response: '31%' }
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
          <div className="min-h-64 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-4 transition duration-300 hover:border-slate-200/25">
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
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} formatter={(value) => formatNumber(value)} />
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
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300">{association.name}</span>
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
                <span className="rounded-full border border-white/[0.07] px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">Planejada</span>
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
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(226,232,240,0.16)', borderRadius: 12, color: '#e2e8f0' }} formatter={(value) => formatNumber(value)} />
                <Bar className="transition duration-300 hover:brightness-125" dataKey="interessados" fill="#cbd5e1" radius={[0, 10, 10, 0]} />
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
            <div className="interactive-card rounded-2xl border border-white/[0.07] bg-slate-950/42 p-5" key={automation.name}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <strong className="text-slate-100">{automation.name}</strong>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${automation.status === 'Ativa' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-400'}`}>{automation.status}</span>
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
              <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-sm font-bold text-slate-400 md:inline-flex">
                {user?.name || 'Admin Leads NT'} · Admin geral
              </span>
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

export default function CrmApp({ payload }) {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [theme, setTheme] = useState('light');
  const [selectedAssociationId, setSelectedAssociationId] = useState('paulistana');
  const [associations, setAssociations] = useState(() => buildInitialAssociations(payload.records));
  const data = useMemo(() => buildAssociationData(payload.records), [payload.records]);
  const selectedAssociation = associations.find((association) => association.id === selectedAssociationId) || associations[0];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setView('login');
  }

  function openAssociation(id) {
    setSelectedAssociationId(id);
    setView('association');
  }

  if (view === 'login') {
    return <LoginScreen onLogin={(loggedUser) => { setUser(loggedUser); setView('admin'); }} />;
  }

  if (view === 'details') {
    return <DashboardClient onBack={() => setView('association')} payload={payload} />;
  }

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
  } else if (view === 'association') {
    content = <AssociationDashboard association={selectedAssociation} data={data} onOpenDetails={() => setView('details')} />;
  } else if (view === 'automations') {
    content = <PlaceholderView icon={MessageCircle} subtitle="A próxima camada terá sequências, templates aprovados e gatilhos de envio por etapa do funil." title="Central WhatsApp" />;
  } else {
    content = <PlaceholderView icon={Gauge} subtitle="Relatórios executivos por associação, campanha, distrito, voluntário, visita e resposta do WhatsApp." title="Relatórios Leads NT" />;
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
