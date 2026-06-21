'use client';

import { useMemo, useState } from 'react';

const priorityLabels = {
  Hot: 'Quente',
  Warm: 'Potencial',
  Cool: 'Morno',
  Cold: 'Frio'
};

const priorityColors = {
  Hot: 'hsl(14, 100%, 57%)',
  Warm: 'hsl(38, 92%, 50%)',
  Cool: 'hsl(210, 70%, 55%)',
  Cold: 'hsl(220, 15%, 45%)'
};

const cardClass = 'group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/78 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.025] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-slate-900/90 hover:shadow-[0_26px_80px_rgba(0,0,0,0.36)]';
const labelClass = 'text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500';
const selectClass = 'h-10 w-full cursor-pointer rounded-lg border border-white/[0.06] bg-slate-950/80 px-3 text-sm font-semibold text-slate-100 outline-none transition hover:border-blue-400/50 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 md:w-auto md:min-w-40';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function KpiCard({ accent, label, value, sub, onClick, children }) {
  return (
    <button className={`${cardClass} cursor-pointer text-left`} onClick={onClick} type="button">
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition group-hover:opacity-100" />
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-3xl transition group-hover:opacity-30" style={{ background: accent }} />
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl text-xl font-black text-white shadow-lg transition duration-300 group-hover:scale-105" style={{ background: accent }}>
        {children}
      </span>
      <span className={labelClass}>{label}</span>
      <span className="mt-2 block text-4xl font-black leading-none tracking-normal text-slate-50">{formatNumber(value)}</span>
      <span className="mt-2 block text-sm text-slate-500">{sub}</span>
    </button>
  );
}

function MetricTooltip({ title, color, rows }) {
  return (
    <div className="pointer-events-none relative z-50 w-64 rounded-xl border border-white/[0.08] bg-slate-950/95 p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04] backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <strong className="truncate text-sm font-black text-slate-100">{title}</strong>
      </div>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4 text-xs" key={row.label}>
            <span className="text-slate-500">{row.label}</span>
            <span className="font-black tabular-nums text-slate-100">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, horizontal = false, color = 'hsl(217, 91%, 60%)' }) {
  const [activeBar, setActiveBar] = useState(null);
  const max = Math.max(1, ...data.map((item) => item.value));

  if (horizontal) {
    return (
      <div className="grid gap-3 pt-4">
        {data.map((item, index) => (
          <div className="grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-4" key={`${item.label}-${index}`}>
            <span className="truncate text-right text-sm text-slate-400" title={item.label}>{item.label}</span>
            <div className="h-7 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/5">
              <div
                className="flex h-full min-w-2 items-center justify-end rounded-full px-3 text-xs font-black text-white shadow-[0_0_24px_rgba(59,130,246,0.20)] transition-all duration-500"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color || color }}
              >
                {formatNumber(item.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activeItem = activeBar === null ? null : data[activeBar];
  const tooltipLeft = activeBar === null || data.length <= 1 ? 50 : (activeBar / (data.length - 1)) * 100;

  return (
    <div className="relative min-h-80 overflow-visible pt-20">
      {activeItem?.tooltipRows?.length ? (
        <div
          className="absolute top-0 z-50 w-72 max-w-[calc(100vw-3rem)] transition-all duration-150"
          style={{
            left: `${Math.min(82, Math.max(18, tooltipLeft))}%`,
            transform: 'translateX(-50%)'
          }}
        >
          <MetricTooltip title={activeItem.label} color={activeItem.color || color} rows={activeItem.tooltipRows} />
        </div>
      ) : null}
      <div className="grid min-h-72 grid-flow-col items-end gap-3 overflow-visible">
      {data.map((item, index) => (
          <div className="relative grid h-72 min-w-0 grid-rows-[1fr_auto] gap-3" key={`${item.label}-${index}`}>
            <div className="relative flex items-end rounded-b-lg border-b border-white/15 bg-[linear-gradient(to_top,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:100%_52px]">
              <div
                className="group/bar relative z-10 w-full cursor-pointer rounded-lg shadow-[0_0_28px_rgba(59,130,246,0.20)] transition-all duration-500 hover:z-20 hover:brightness-110 focus:z-20 focus:brightness-110"
                style={{ height: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color || color }}
                onBlur={() => setActiveBar(null)}
                onFocus={() => setActiveBar(index)}
                onMouseEnter={() => setActiveBar(index)}
                onMouseLeave={() => setActiveBar(null)}
                tabIndex={0}
              >
                <strong className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-slate-400 transition group-hover/bar:text-slate-100">
                  {formatNumber(item.value)}
                </strong>
              </div>
            </div>
          <span className="truncate text-center text-xs text-slate-500" title={item.label}>{item.label}</span>
        </div>
      ))}
      </div>
    </div>
  );
}

function DonutChart({ values }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const active = activeIndex === null ? null : values[activeIndex];
  let offset = 0;
  const segments = values.map((item, index) => {
    const percent = total ? (item.value / total) * 100 : 0;
    const segment = { ...item, index, percent, offset };
    offset += percent;
    return segment;
  });

  return (
    <div className="grid min-h-80 place-items-center gap-5">
      <div className="relative grid aspect-square w-[min(18rem,80vw)] place-items-center">
        <svg className="h-full w-full overflow-visible drop-shadow-[0_0_42px_rgba(59,130,246,0.14)]" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(15,23,42,0.95)" strokeWidth="18" />
          {segments.map((segment) => (
            <circle
              aria-label={`${segment.label}: ${formatNumber(segment.value)}`}
              className="cursor-pointer transition duration-200 hover:brightness-125 focus:outline-none"
              cx="60"
              cy="60"
              fill="none"
              key={segment.label}
              onBlur={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(segment.index)}
              onMouseEnter={() => setActiveIndex(segment.index)}
              onMouseLeave={() => setActiveIndex(null)}
              pathLength="100"
              r="42"
              role="img"
              stroke={segment.color}
              strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="butt"
              strokeWidth={activeIndex === segment.index ? 21 : 18}
              tabIndex={0}
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
        <div className="absolute inset-0 m-auto grid aspect-square w-[58%] place-items-center rounded-full bg-slate-900 text-center ring-1 ring-white/[0.06]">
          <span className="text-base text-slate-500">{active ? active.label : 'Total'}</span>
          <strong className="text-3xl font-black text-slate-50">{formatNumber(active ? active.value : total)}</strong>
        </div>
      </div>
      <div className="min-h-[5.5rem] w-full max-w-md rounded-xl border border-white/[0.06] bg-slate-950/55 p-3 text-sm ring-1 ring-white/[0.03]">
        {active ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 font-black text-slate-100">
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: active.color }} />
                {active.label}
              </span>
              <span className="font-black tabular-nums text-slate-100">{pct(active.value, total)}%</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{active.description}</p>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">Passe o mouse sobre uma fatia ou item da legenda para ver quantidade, percentual e descrição da prioridade.</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-400">
        {values.map((item, index) => (
          <span
            className="group/legend relative inline-flex cursor-pointer items-center gap-2 rounded-full px-1 py-0.5 transition hover:text-slate-100 focus:text-slate-100"
            key={item.label}
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            tabIndex={0}
          >
            <i className="h-3 w-3 rounded-full ring-2 ring-white/40" style={{ background: item.color }} />
            {item.label}
            <span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 hidden w-56 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-slate-950/95 p-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04] backdrop-blur-xl group-hover/legend:block group-focus/legend:block">
              <span className="mb-2 flex items-center gap-2 text-sm font-black text-slate-100">
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
              <span className="flex justify-between text-xs text-slate-500">
                <span>Contatos</span>
                <strong className="text-slate-100">{formatNumber(item.value)}</strong>
              </span>
              <span className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Participação</span>
                <strong className="text-slate-100">{pct(item.value, total)}%</strong>
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-slate-400">{item.description}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function aggregate(records, filters) {
  const filtered = records.filter((row) => {
    if (filters.distrito !== 'all' && row.d !== filters.distrito) return false;
    if (filters.prioridade !== 'all' && row.p !== filters.prioridade) return false;
    if (filters.vip !== 'all' && row.v !== Number(filters.vip)) return false;
    if (filters.telefone !== 'all' && row.t !== Number(filters.telefone)) return false;
    if (filters.estudos !== 'all' && row.e !== Number(filters.estudos)) return false;
    if (filters.genero !== 'all' && row.g !== filters.genero) return false;
    if (filters.search && !row.d.toLowerCase().includes(filters.search)) return false;
    return true;
  });

  const kpis = { total: 0, telefone: 0, hot: 0, warm: 0, cool: 0, cold: 0, vips: 0, estudos: 0 };
  const districts = new Map();
  const religions = new Map();
  const tempo = new Map([
    ['Até 3 meses', 0],
    ['3m a 1 ano', 0],
    ['1 a 2 anos', 0],
    ['2 a 5 anos', 0],
    ['5+ anos', 0],
    ['Não Informado', 0]
  ]);

  for (const row of filtered) {
    kpis.total++;
    if (row.t) kpis.telefone++;
    if (row.v) kpis.vips++;
    if (row.e) kpis.estudos++;
    if (row.p === 'Hot') kpis.hot++;
    if (row.p === 'Warm') kpis.warm++;
    if (row.p === 'Cool') kpis.cool++;
    if (row.p === 'Cold') kpis.cold++;

    if (!districts.has(row.d)) {
      districts.set(row.d, { nome: row.d, total: 0, telefone: 0, hot: 0, warm: 0, cool: 0, cold: 0, vips: 0, sumScore: 0 });
    }
    const district = districts.get(row.d);
    district.total++;
    district.telefone += row.t;
    district.vips += row.v;
    district.sumScore += row.s;
    district[row.p.toLowerCase()]++;

    religions.set(row.r, (religions.get(row.r) || 0) + 1);

    let bucket = 'Não Informado';
    if (row.c !== null) {
      if (row.c <= 90) bucket = 'Até 3 meses';
      else if (row.c <= 365) bucket = '3m a 1 ano';
      else if (row.c <= 730) bucket = '1 a 2 anos';
      else if (row.c <= 1825) bucket = '2 a 5 anos';
      else bucket = '5+ anos';
    }
    tempo.set(bucket, (tempo.get(bucket) || 0) + 1);
  }

  const districtList = Array.from(districts.values())
    .map((district) => ({ ...district, score_medio: district.total ? Number((district.sumScore / district.total).toFixed(1)) : 0 }))
    .sort((a, b) => b.total - a.total);

  const religionList = Array.from(religions.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return { filtered, kpis, districtList, religionList, tempo };
}

export default function DashboardClient({ payload }) {
  const { records, meta } = payload;
  const districts = useMemo(() => Array.from(new Set(records.map((row) => row.d))).sort((a, b) => a.localeCompare(b)), [records]);
  const [filters, setFilters] = useState({ distrito: 'all', prioridade: 'all', vip: 'all', telefone: 'all', estudos: 'all', genero: 'all', search: '' });
  const [sort, setSort] = useState({ col: 'total', asc: false });
  const [pointer, setPointer] = useState({ x: 50, y: 20 });

  const data = useMemo(() => aggregate(records, filters), [records, filters]);
  const sortedDistricts = useMemo(() => {
    const rows = [...data.districtList];
    rows.sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (typeof av === 'string') return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.asc ? av - bv : bv - av;
    });
    return rows;
  }, [data.districtList, sort]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ distrito: 'all', prioridade: 'all', vip: 'all', telefone: 'all', estudos: 'all', genero: 'all', search: '' });
  const clickSort = (col) => setSort((current) => current.col === col ? { col, asc: !current.asc } : { col, asc: col === 'nome' });
  const onPointerMove = (event) => {
    setPointer({
      x: Math.round((event.clientX / window.innerWidth) * 100),
      y: Math.round((event.clientY / window.innerHeight) * 100)
    });
  };

  const priorityValues = [
    { label: 'Quente', value: data.kpis.hot, color: priorityColors.Hot, description: 'Maior prioridade operacional pelo score de ML, recência e contactabilidade.' },
    { label: 'Potencial', value: data.kpis.warm, color: priorityColors.Warm, description: 'Boa chance de abordagem, com sinais relevantes no modelo de prioridade.' },
    { label: 'Morno', value: data.kpis.cool, color: priorityColors.Cool, description: 'Contatos úteis para acompanhamento, porém com prioridade intermediária.' },
    { label: 'Frio', value: data.kpis.cold, color: priorityColors.Cold, description: 'Menor prioridade no momento, geralmente por baixa recência ou baixa contactabilidade.' }
  ];
  const tempoRows = Array.from(data.tempo.entries()).map(([label, value], index) => ({
    label,
    value,
    color: ['hsl(152,69%,53%)', 'hsl(80,60%,50%)', 'hsl(38,92%,50%)', 'hsl(14,100%,57%)', 'hsl(0,70%,50%)', 'hsl(220,15%,45%)'][index]
  }));

  return (
    <div className="min-h-screen text-slate-100" onPointerMove={onPointerMove}>
      <div
        className="pointer-events-none fixed inset-0 -z-10 transition duration-300"
        style={{
          background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(59,130,246,0.13), transparent 28%), radial-gradient(circle at 78% 14%, rgba(245,158,11,0.08), transparent 30%), hsl(222, 25%, 6%)`
        }}
      />

      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-slate-950/80 px-8 py-4 backdrop-blur-2xl max-md:flex-col max-md:items-start max-md:px-4">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="SEVENFLOW Logo" className="h-11 w-11 rounded-xl object-cover ring-1 ring-cyan-300/20" />
          <div>
            <h1 className="text-xl font-black tracking-normal text-slate-50">Escola Bíblica Novo Tempo</h1>
            <p className="text-sm text-slate-400">Associação Paulistana - Visão Geral</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-2 text-sm font-bold text-slate-400 max-md:w-full max-md:justify-center">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.10)]" />
          {formatNumber(data.kpis.total)} registros (Filtro Ativo)
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-8 py-6 max-md:px-4">
        <section className="mb-6 flex flex-wrap items-end gap-5 rounded-2xl border border-white/[0.06] bg-slate-900/78 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.20)] backdrop-blur-xl">
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Distrito<select className={selectClass} value={filters.distrito} onChange={(event) => setFilter('distrito', event.target.value)}><option value="all">Todos os Distritos</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Prioridade ML<select className={selectClass} value={filters.prioridade} onChange={(event) => setFilter('prioridade', event.target.value)}><option value="all">Todas as Prioridades</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>Prioridade: {label}</option>)}</select></label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Status VIP<select className={selectClass} value={filters.vip} onChange={(event) => setFilter('vip', event.target.value)}><option value="all">Todos</option><option value="1">Apenas VIPs</option><option value="0">Não VIPs</option></select></label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">WhatsApp<select className={selectClass} value={filters.telefone} onChange={(event) => setFilter('telefone', event.target.value)}><option value="all">Todos</option><option value="1">Com Telefone</option><option value="0">Sem Telefone</option></select></label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Estudos Ativos<select className={selectClass} value={filters.estudos} onChange={(event) => setFilter('estudos', event.target.value)}><option value="all">Todos</option><option value="1">Em Andamento</option><option value="0">Sem Estudo Ativo</option></select></label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Gênero<select className={selectClass} value={filters.genero} onChange={(event) => setFilter('genero', event.target.value)}><option value="all">Todos</option><option value="F">Feminino</option><option value="M">Masculino</option></select></label>
          <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Ações<button className="h-10 cursor-pointer rounded-lg border border-blue-400/15 px-5 text-sm font-bold text-blue-400 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10" onClick={resetFilters} type="button">Limpar Filtros</button></label>
        </section>

        <section className="mb-6 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          <KpiCard accent="hsl(217, 91%, 60%)" label="Contatos (Filtrados)" value={data.kpis.total} sub={`em ${data.districtList.length} distritos`} onClick={resetFilters}>◎</KpiCard>
          <KpiCard accent="hsl(152, 69%, 53%)" label="Com Telefone" value={data.kpis.telefone} sub={`${pct(data.kpis.telefone, data.kpis.total)}% com zap`} onClick={() => setFilter('telefone', '1')}>☎</KpiCard>
          <KpiCard accent="hsl(14, 100%, 57%)" label="Contatos Quentes" value={data.kpis.hot} sub={`${pct(data.kpis.hot, data.kpis.total)}% via ML`} onClick={() => setFilter('prioridade', 'Hot')}>△</KpiCard>
          <KpiCard accent="hsl(38, 92%, 50%)" label="VIPs" value={data.kpis.vips} sub={`${pct(data.kpis.vips, data.kpis.total)}%`} onClick={() => setFilter('vip', '1')}>☆</KpiCard>
          <KpiCard accent="hsl(270, 70%, 62%)" label="Estudos Ativos" value={data.kpis.estudos} sub={`${pct(data.kpis.estudos, data.kpis.total)}%`} onClick={() => setFilter('estudos', '1')}>□</KpiCard>
        </section>

        <section className="mb-6 grid grid-cols-[1.6fr_1fr] gap-4 max-xl:grid-cols-1">
          <article className={`${cardClass} min-w-0`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-base font-black text-slate-100">Top 15 Distritos por Volume (Filtrado)</h2><span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-400">Ranking</span></div>
            <BarChart data={data.districtList.slice(0, 15).map((d) => ({
              label: d.nome,
              value: d.total,
              tooltipRows: [
                { label: 'Contatos', value: formatNumber(d.total) },
                { label: 'WhatsApp', value: `${formatNumber(d.telefone)} (${pct(d.telefone, d.total)}%)` },
                { label: 'Quentes', value: formatNumber(d.hot) },
                { label: 'Potenciais', value: formatNumber(d.warm) },
                { label: 'Mornos', value: formatNumber(d.cool) },
                { label: 'Frios', value: formatNumber(d.cold) },
                { label: 'VIPs', value: formatNumber(d.vips) },
                { label: 'Pontuação média', value: d.score_medio.toLocaleString('pt-BR') }
              ]
            }))} />
          </article>
          <article className={`${cardClass} min-w-0`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-base font-black text-slate-100">Distribuição de Prioridade ML</h2><span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-400">Pontuação</span></div>
            <DonutChart values={priorityValues} />
          </article>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          <article className={`${cardClass} min-w-0`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-base font-black text-slate-100">Perfil Religioso</h2><span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-400">Top 10</span></div>
            <BarChart horizontal data={data.religionList.map((item, index) => ({ ...item, color: ['hsl(217,91%,60%)', 'hsl(195,80%,50%)', 'hsl(152,69%,53%)', 'hsl(38,92%,50%)', 'hsl(270,70%,62%)', 'hsl(340,70%,55%)'][index % 6] }))} />
          </article>
          <article className={`${cardClass} min-w-0`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-base font-black text-slate-100">Tempo sem Contato</h2><span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-400">Recência</span></div>
            <BarChart data={tempoRows} />
          </article>
        </section>

        <section className={`${cardClass} p-6`}>
          <div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
            <div>
              <h2 className="text-base font-black text-slate-100">Distritos (Dados Filtrados)</h2>
              <p className="mt-1 text-sm font-bold text-emerald-400">Dica: clique no nome do distrito para abrir a análise detalhada.</p>
            </div>
            <input className="h-11 w-full rounded-xl border border-white/[0.06] bg-slate-950/80 px-4 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 hover:border-blue-400/40 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 md:w-80" value={filters.search} onChange={(event) => setFilter('search', event.target.value.toLowerCase())} placeholder="Buscar distrito..." />
          </div>
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {[
                    ['nome', 'Distrito'], ['total', 'Total'], ['telefone', 'WhatsApp'], ['hot', 'Quente'],
                    ['warm', 'Potencial'], ['cool', 'Morno'], ['cold', 'Frio'], ['vips', 'VIPs'], ['score_medio', 'Pontuação Média']
                  ].map(([key, label]) => <th className="cursor-pointer whitespace-nowrap border-b border-white/[0.06] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:text-blue-400" key={key} onClick={() => clickSort(key)}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortedDistricts.map((d) => (
                  <tr className="transition hover:bg-white/[0.035]" key={d.nome}>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-black"><a className="cursor-pointer text-blue-400 no-underline transition hover:text-blue-300" href={`/distrito?id=${encodeURIComponent(d.nome)}`}>{d.nome} ↗</a></td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.total)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.telefone)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-black tabular-nums text-orange-500">{formatNumber(d.hot)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-black tabular-nums text-amber-500">{formatNumber(d.warm)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.cool)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.cold)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.vips)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4"><span className="inline-block min-w-10 rounded-full bg-amber-500/[0.12] px-2 py-1 text-center text-xs font-black" style={{ color: d.score_medio >= 14 ? priorityColors.Hot : d.score_medio >= 9 ? priorityColors.Warm : priorityColors.Cool }}>{d.score_medio}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="px-4 py-10 text-center text-sm text-slate-600">
          Escola Bíblica Novo Tempo | Prioridade via ML ({formatNumber(meta.mlRecords)} rankings do notebook)
        </footer>
      </main>
    </div>
  );
}

