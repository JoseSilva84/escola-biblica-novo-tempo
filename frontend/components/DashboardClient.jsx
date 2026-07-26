'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Info } from 'lucide-react';

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

const cardClass = 'interactive-card group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/78 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.025] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-slate-900/90 hover:shadow-[0_26px_80px_rgba(0,0,0,0.36)]';
const labelClass = 'text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500';
const selectClass = 'h-10 w-full cursor-pointer rounded-lg border border-white/[0.06] bg-slate-950/80 px-3 text-sm font-semibold text-slate-100 outline-none transition hover:border-blue-400/50 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10';
const activeSelectClass = 'border-blue-400/45 bg-blue-500/[0.08] text-blue-100 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]';

const rules = {
  total: 'Total de interessados que permanecem depois dos filtros aplicados nesta tela.',
  telefone: 'Conta os interessados com telefone/WhatsApp cadastrado. O percentual usa o total filtrado como base.',
  hot: 'Contatos classificados como Quente pelo modelo de prioridade ML. Sao os leads com maior urgencia operacional.',
  vip: 'Interessados marcados como VIP na base filtrada. O percentual usa o total filtrado como base.',
  estudos: 'Interessados com estudo ativo/em andamento na base filtrada.',
  actionHot: 'Seleciona o distrito com maior quantidade de contatos Quentes entre os dados filtrados.',
  actionWarm: 'Seleciona o distrito com maior quantidade de contatos Potenciais entre os dados filtrados.',
  actionVip: 'Seleciona o distrito com maior quantidade de VIPs entre os dados filtrados.',
  actionRecovery: 'Seleciona o distrito com mais contatos ha mais de 5 anos sem contato registrado.',
  topDistricts: 'Ranking dos 15 distritos com maior total de interessados apos os filtros. Ao passar o mouse em uma barra, aparecem os indicadores que formam a leitura do distrito.',
  priority: 'Distribui os interessados filtrados nas faixas do modelo ML: Quente, Potencial, Morno e Frio.',
  religion: 'Mostra as 10 religioes mais frequentes entre os interessados filtrados.',
  recency: 'Agrupa os interessados pelo tempo desde o ultimo contato. Quanto maior a faixa, maior a chance de recuperacao operacional.',
  table: 'Tabela consolidada por distrito, sempre respeitando os filtros ativos.',
  score: 'Pontuacao media = soma das pontuacoes ML individuais do distrito dividida pelo total de interessados do distrito. Quanto maior, maior a prioridade media.',
  district: 'Abre a analise detalhada do distrito selecionado.'
};

function RulesModal({ onClose }) {
  const mlRules = [
    { label: 'Quente', color: priorityColors.Hot, score: '≥ 15 pts', desc: 'Maior prioridade operacional. Alta chance de engajamento baseada em score de ML, interação recente e contactabilidade (celular validado).' },
    { label: 'Potencial', color: priorityColors.Warm, score: '10 a 14 pts', desc: 'Boa chance de abordagem. O modelo identifica sinais relevantes de interesse, ideal para manter no funil.' },
    { label: 'Morno', color: priorityColors.Cool, score: '5 a 9 pts', desc: 'Prioridade intermediária. Úteis para campanhas de acompanhamento e nutrição de relacionamento.' },
    { label: 'Frio', color: priorityColors.Cold, score: '< 5 pts', desc: 'Menor prioridade no momento. Geralmente com baixa recência ou baixa contactabilidade.' }
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm" onClick={onClose} type="button" aria-label="Fechar regras" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-white/95 to-slate-50/95 p-6 text-left shadow-[0_24px_50px_-12px_rgba(0,0,0,0.25)] ring-1 ring-slate-900/5 backdrop-blur-3xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900">Regras de Prioridade ML</h3>
            <p className="mt-1 text-sm font-medium text-slate-600">Entenda como o modelo classifica cada interessado.</p>
          </div>
          <button className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-slate-100 text-xl font-bold text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 focus:outline-none" onClick={onClose} type="button" aria-label="Fechar">×</button>
        </div>
        
        <div className="grid gap-4">
          {mlRules.map((r) => (
            <div key={r.label} className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-sm ring-1 ring-slate-900/5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shadow-inner ring-1 ring-black/10" style={{ background: r.color }} />
                  <strong className="text-base font-black text-slate-800">{r.label}</strong>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">{r.score}</span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function filterLabel(filters, key, districts) {
  const labels = {
    distrito: filters.distrito === 'all' ? null : districts.find((district) => district === filters.distrito),
    prioridade: filters.prioridade === 'all' ? null : priorityLabels[filters.prioridade],
    vip: filters.vip === 'all' ? null : filters.vip === '1' ? 'Apenas VIPs' : 'Não VIPs',
    telefone: filters.telefone === 'all' ? null : filters.telefone === '1' ? 'Com telefone' : 'Sem telefone',
    estudos: filters.estudos === 'all' ? null : filters.estudos === '1' ? 'Com estudo ativo' : 'Sem estudo ativo',
    genero: filters.genero === 'all' ? null : filters.genero === 'F' ? 'Feminino' : 'Masculino'
  };
  return labels[key];
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function FilterSelect({ label, value, onChange, children, active }) {
  return (
    <label className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 flex-1 min-w-[140px]">
      {label}
      <select className={`${selectClass} ${active ? activeSelectClass : ''}`} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function RuleTooltip({ children, side = 'top' }) {
  const positionClass = side === 'right'
    ? 'left-[calc(100%+0.75rem)] top-1/2 -translate-y-1/2'
    : side === 'bottom'
      ? 'left-1/2 top-[calc(100%+0.75rem)] -translate-x-1/2'
      : side === 'bottom-right'
        ? 'right-0 top-[calc(100%+0.75rem)]'
        : side === 'top-right'
          ? 'right-0 bottom-[calc(100%+0.75rem)]'
          : 'bottom-[calc(100%+0.75rem)] left-1/2 -translate-x-1/2';

  return (
    <span className={`pointer-events-none absolute ${positionClass} z-[9999] hidden w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white bg-gradient-to-br from-white/95 to-slate-50/90 p-4 text-left text-[11px] whitespace-normal font-medium leading-relaxed text-slate-600 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/5 backdrop-blur-3xl group-hover/tip:block group-focus-within/tip:block`}>
      {children}
    </span>
  );
}

function InfoHint({ text, side = 'top' }) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <span
        aria-label="Ver regra da analise"
        role="img"
        className="grid h-6 w-6 place-items-center rounded-full border border-slate-900/10 bg-white/70 text-slate-500 shadow-sm transition hover:border-blue-400/40 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        <Info size={14} strokeWidth={2.6} />
      </span>
      <RuleTooltip side={side}>{text}</RuleTooltip>
    </span>
  );
}

function ScoreBadge({ district }) {
  const [tooltip, setTooltip] = useState(null);
  const badgeRef = useRef(null);

  function showTooltip() {
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;

    const filterRect = document.querySelector('[data-dashboard-filterbar]')?.getBoundingClientRect();
    const filterBottom = filterRect?.bottom || 0;
    const tooltipWidth = 288;
    const tooltipHeight = 136;
    const margin = 12;
    const preferredTop = rect.top - tooltipHeight - margin;
    const top = preferredTop > filterBottom + margin ? preferredTop : rect.bottom + margin;
    const left = Math.min(
      window.innerWidth - tooltipWidth - 16,
      Math.max(16, rect.right - tooltipWidth)
    );

    setTooltip({ top, left, width: tooltipWidth });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  return (
    <>
      <span
        className="group/tip relative inline-block min-w-10 rounded-full bg-amber-500/[0.12] px-2 py-1 text-center text-xs font-black"
        onBlur={hideTooltip}
        onFocus={showTooltip}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        ref={badgeRef}
        style={{ color: district.score_medio >= 14 ? priorityColors.Hot : district.score_medio >= 9 ? priorityColors.Warm : priorityColors.Cool }}
        tabIndex={0}
      >
        {district.score_medio}
      </span>
      {tooltip ? createPortal(
        <span
          className="pointer-events-none fixed z-[55] overflow-hidden rounded-2xl border border-white bg-gradient-to-br from-white/95 to-slate-50/90 p-4 text-left text-[11px] whitespace-normal font-medium leading-relaxed text-slate-600 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/5 backdrop-blur-3xl"
          style={{ top: tooltip.top, left: tooltip.left, width: tooltip.width }}
        >
          <strong className="mb-2 block text-sm text-slate-900">{district.nome}</strong>
          <span className="text-slate-600 font-medium">{rules.score}</span>
          <span className="mt-2.5 flex justify-between gap-4 text-slate-600 font-medium">
            <span>Total usado</span>
            <strong className="text-slate-900 font-black">{formatNumber(district.total)}</strong>
          </span>
        </span>,
        document.body
      ) : null}
    </>
  );
}

function LabelWithHint({ children, hint }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      {hint ? <InfoHint text={hint} /> : null}
    </span>
  );
}

function KpiCard({ accent, label, value, sub, onClick, rule, children }) {
  return (
    <button className={`${cardClass} !overflow-visible cursor-pointer text-left hover:z-50 focus-within:z-50`} onClick={onClick} type="button">
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition group-hover:opacity-100" />
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-3xl transition group-hover:opacity-30" style={{ background: accent }} />
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl text-xl font-black text-white shadow-lg transition duration-300 group-hover:scale-105" style={{ background: accent }}>
        {children}
      </span>
      <span className={labelClass}>
        <LabelWithHint hint={rule}>{label}</LabelWithHint>
      </span>
      <span className="mt-2 block text-4xl font-black leading-none tracking-normal text-slate-50">{formatNumber(value)}</span>
      <span className="mt-2 block text-sm text-slate-500">{sub}</span>
    </button>
  );
}

function MetricTooltip({ title, color, rows }) {
  return (
    <div className="pointer-events-none relative z-50 w-64 overflow-hidden rounded-2xl border border-white bg-gradient-to-br from-white/95 to-slate-50/90 p-5 text-left shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/5 backdrop-blur-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full shadow-inner ring-1 ring-black/10" style={{ background: color }} />
        <div className="truncate text-base font-black text-slate-900">{title}</div>
      </div>
      <div className="grid gap-2.5">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={row.label}>
            <div className="font-semibold text-slate-600">{row.label}</div>
            <div className="font-black tabular-nums text-slate-900">{row.value}</div>
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
          <div className="group/tip relative grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-4" key={`${item.label}-${index}`}>
            <span className="truncate text-right text-sm text-slate-400" title={item.label}>{item.label}</span>
            <div className="h-7 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/5">
              <div
                className="flex h-full min-w-2 items-center justify-end rounded-full px-3 text-xs font-black text-white shadow-[0_0_24px_rgba(59,130,246,0.20)] transition-all duration-500"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color || color }}
              >
                {formatNumber(item.value)}
              </div>
            </div>
            {(item.description || item.tooltipRows?.length) ? (
              <RuleTooltip side="top">
                <strong className="mb-2 block text-sm text-slate-900">{item.label}</strong>
                {item.description ? <span className="block text-slate-600 font-medium">{item.description}</span> : null}
                {item.tooltipRows?.map((row) => (
                  <span className="mt-1.5 flex justify-between gap-4 text-slate-600 font-medium" key={row.label}>
                    <span>{row.label}</span>
                    <strong className="text-slate-900 font-black">{row.value}</strong>
                  </span>
                ))}
              </RuleTooltip>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  const activeItem = activeBar === null ? null : data[activeBar];
  const tooltipLeft = activeBar === null || data.length <= 1 ? 50 : (activeBar / (data.length - 1)) * 100;

  return (
    <div className="relative min-h-80 overflow-visible pt-20" onMouseLeave={() => setActiveBar(null)}>
      {activeItem?.tooltipRows?.length ? (
        <div
          className="pointer-events-none absolute top-0 z-50 w-72 max-w-[calc(100vw-3rem)] transition-all duration-300 ease-out"
          style={{
            left: `${Math.min(82, Math.max(18, tooltipLeft))}%`,
            transform: 'translateX(-50%)'
          }}
        >
          <MetricTooltip title={activeItem.label} color={activeItem.color || color} rows={activeItem.tooltipRows} />
          {activeItem.description ? (
            <div className="-mt-2 rounded-b-2xl border border-t-0 border-white bg-slate-50/95 px-5 pb-4 pt-4 text-xs font-medium leading-relaxed text-slate-600 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/5 backdrop-blur-3xl">
              {activeItem.description}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid min-h-72 grid-flow-col items-end gap-3 overflow-visible">
      {data.map((item, index) => (
          <div className="relative grid h-72 min-w-0 grid-rows-[1fr_auto] gap-3" key={`${item.label}-${index}`} onMouseEnter={() => setActiveBar(index)}>
            <div className="relative flex items-end rounded-b-lg border-b border-white/15 bg-[linear-gradient(to_top,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:100%_52px]">
              <div
                className="group/bar relative z-10 w-full cursor-pointer rounded-lg shadow-[0_0_28px_rgba(59,130,246,0.20)] transition-all duration-500 hover:z-20 hover:brightness-110 focus:z-20 focus:brightness-110"
                style={{ height: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color || color }}
                onBlur={() => setActiveBar(null)}
                onFocus={() => setActiveBar(index)}
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
        <div className="absolute inset-0 m-auto grid aspect-square w-[58%] place-items-center rounded-full bg-slate-200 text-center ring-1 ring-slate-900/10 shadow-inner">
          <span className="text-base font-bold text-slate-600">{active ? active.label : 'Total'}</span>
          <strong className="text-3xl font-black text-slate-900">{formatNumber(active ? active.value : total)}</strong>
        </div>
      </div>
      <div className="min-h-[5.5rem] w-full max-w-md rounded-xl border border-white/[0.06] bg-slate-950/55 p-3 text-sm ring-1 ring-white/[0.03]">
        {active ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-black text-white">
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: active.color }} />
                {active.label}
              </div>
              <div className="font-black tabular-nums text-white">{pct(active.value, total)}%</div>
            </div>
            <div className="text-xs leading-relaxed text-white/80">{active.description}</div>
          </div>
        ) : (
          <div className="text-xs font-bold leading-relaxed text-white">Passe o mouse sobre uma fatia ou item da legenda para ver quantidade, percentual e descrição da prioridade.</div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-400">
        {values.map((item, index) => (
          <div
            className="group/legend relative inline-flex cursor-pointer items-center gap-2 rounded-full px-1 py-0.5 transition hover:text-slate-100 focus:text-slate-100 outline-none"
            key={item.label}
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            tabIndex={0}
          >
            <i className="h-3 w-3 rounded-full ring-2 ring-white/40" style={{ background: item.color }} />
            {item.label}
            <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[9999] hidden w-64 -translate-x-1/2 overflow-hidden rounded-2xl border border-white bg-gradient-to-br from-white/95 to-slate-50/90 p-4 text-left shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/5 backdrop-blur-3xl group-hover/legend:block group-focus/legend:block">
              <div className="mb-3 flex items-center gap-3 text-sm font-black text-slate-900">
                <i className="h-3 w-3 rounded-full shadow-inner ring-1 ring-black/10" style={{ background: item.color }} />
                {item.label}
              </div>
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <div>Contatos</div>
                <div className="font-black text-slate-900">{formatNumber(item.value)}</div>
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-slate-600 font-medium">
                <div>Participação</div>
                <div className="font-black text-slate-900">{pct(item.value, total)}%</div>
              </div>
              <div className="mt-3 block text-xs leading-relaxed text-slate-500 font-medium">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ title, value, detail, tone, onClick, rule }) {
  return (
    <button
      className="interactive-card group relative min-h-32 cursor-pointer !overflow-visible rounded-2xl border border-white/[0.06] bg-slate-900/70 p-5 text-left shadow-[0_18px_60px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.025] transition duration-300 hover:-translate-y-1 hover:border-blue-300/20 hover:shadow-[0_24px_70px_rgba(0,0,0,0.18)] focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:z-50 focus-within:z-50"
      onClick={onClick}
      type="button"
    >
      <span className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-20 blur-3xl transition group-hover:opacity-40" style={{ background: tone }} />
      <span className={labelClass}>
        <LabelWithHint hint={rule}>{title}</LabelWithHint>
      </span>
      <strong className="mt-3 block truncate text-2xl font-black text-slate-50">{value}</strong>
      <span className="mt-2 block text-sm leading-relaxed text-slate-400">{detail}</span>
    </button>
  );
}

function DetailStat({ label, value, color = 'text-slate-100', rule }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-4">
      <span className={labelClass}>
        <LabelWithHint hint={rule}>{label}</LabelWithHint>
      </span>
      <strong className={`mt-2 block text-2xl font-black tabular-nums ${color}`}>{value}</strong>
    </div>
  );
}

function DistrictDrawer({ district, onClose }) {
  if (!district) return null;

  const total = Math.max(1, district.total);
  const mix = [
    { label: 'Quente', value: district.hot, color: priorityColors.Hot },
    { label: 'Potencial', value: district.warm, color: priorityColors.Warm },
    { label: 'Morno', value: district.cool, color: priorityColors.Cool },
    { label: 'Frio', value: district.cold, color: priorityColors.Cold }
  ];

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm" onClick={onClose} type="button" aria-label="Fechar detalhe" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.08] bg-slate-950/96 p-6 shadow-[0_0_80px_rgba(0,0,0,0.55)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className={labelClass}>Análise Detalhada</span>
            <h3 className="mt-2 text-2xl font-black text-slate-50">{district.nome}</h3>
            <p className="mt-1 text-sm text-slate-400">Resumo operacional com base nos dados filtrados e prioridade ML.</p>
          </div>
          <button className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-xl font-bold text-slate-300 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10" onClick={onClose} type="button" aria-label="Fechar">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailStat label="Contatos" value={formatNumber(district.total)} />
          <DetailStat label="Pontuação Média" rule={rules.score} value={district.score_medio.toLocaleString('pt-BR')} color={district.score_medio >= 14 ? 'text-orange-400' : 'text-amber-400'} />
          <DetailStat label="WhatsApp" value={`${formatNumber(district.telefone)} (${pct(district.telefone, total)}%)`} color="text-emerald-300" />
          <DetailStat label="VIPs" value={`${formatNumber(district.vips)} (${pct(district.vips, total)}%)`} color="text-amber-300" />
          <DetailStat label="Estudos Ativos" value={`${formatNumber(district.estudos)} (${pct(district.estudos, total)}%)`} color="text-violet-300" />
          <DetailStat label="5+ anos sem contato" value={formatNumber(district.semContato5Anos)} color="text-red-300" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-black text-slate-100">Composição de Prioridade</h4>
            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-400">ML</span>
          </div>
          <div className="grid gap-3">
            {mix.map((item) => (
              <div className="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-3" key={item.label}>
                <span className="text-sm text-slate-400">{item.label}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-950 ring-1 ring-white/[0.05]">
                  <div className="h-full rounded-full" style={{ width: `${pct(item.value, total)}%`, background: item.color }} />
                </div>
                <strong className="text-right text-sm tabular-nums text-slate-100">{formatNumber(item.value)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-5">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">Próxima ação sugerida</span>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Priorize contatos quentes com WhatsApp disponível. Em seguida, trate os potenciais com maior tempo sem contato para recuperar oportunidades antigas.
          </p>
        </div>
      </aside>
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
      districts.set(row.d, {
        nome: row.d,
        total: 0,
        telefone: 0,
        hot: 0,
        warm: 0,
        cool: 0,
        cold: 0,
        vips: 0,
        estudos: 0,
        semContato2Anos: 0,
        semContato5Anos: 0,
        sumScore: 0
      });
    }
    const district = districts.get(row.d);
    district.total++;
    district.telefone += row.t;
    district.vips += row.v;
    district.estudos += row.e;
    if (row.c !== null && row.c > 730) district.semContato2Anos++;
    if (row.c !== null && row.c > 1825) district.semContato5Anos++;
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

export default function DashboardClient({ payload, onBack }) {
  const { records, meta } = payload;
  const districts = useMemo(() => Array.from(new Set(records.map((row) => row.d))).sort((a, b) => a.localeCompare(b)), [records]);
  const [filters, setFilters] = useState({ distrito: 'all', prioridade: 'all', vip: 'all', telefone: 'all', estudos: 'all', genero: 'all', search: '' });
  const [sort, setSort] = useState({ col: 'total', asc: false });
  const [pointer, setPointer] = useState({ x: 50, y: 20 });
  const [selectedDistrictName, setSelectedDistrictName] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const topAnchorRef = useRef(null);

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
  const selectedDistrict = useMemo(
    () => data.districtList.find((district) => district.nome === selectedDistrictName) || null,
    [data.districtList, selectedDistrictName]
  );

  useEffect(() => {
    setIsMounted(true);
    topAnchorRef.current?.scrollIntoView({ behavior: 'auto' });
    requestAnimationFrame(() => {
      topAnchorRef.current?.scrollIntoView({ behavior: 'auto' });
    });

  }, []);

  const handleScroll = (e) => {
    const scrollY = e.currentTarget.scrollTop || 0;
    setShowScrollTop(scrollY > 200);
  };

  const activeFilters = useMemo(() => (
    ['distrito', 'prioridade', 'vip', 'telefone', 'estudos', 'genero']
      .map((key) => ({ key, label: filterLabel(filters, key, districts) }))
      .filter((item) => item.label)
  ), [filters, districts]);
  const actionInsights = useMemo(() => {
    const byHot = [...data.districtList].sort((a, b) => b.hot - a.hot)[0];
    const byWarm = [...data.districtList].sort((a, b) => b.warm - a.warm)[0];
    const byVip = [...data.districtList].sort((a, b) => b.vips - a.vips)[0];
    const byDormant = [...data.districtList].sort((a, b) => b.semContato5Anos - a.semContato5Anos)[0];
    return [
      byHot && { title: 'Atacar agora', value: byHot.nome, detail: `${formatNumber(byHot.hot)} contatos quentes para priorizar`, tone: priorityColors.Hot, district: byHot.nome, rule: rules.actionHot },
      byWarm && { title: 'Maior potencial', value: byWarm.nome, detail: `${formatNumber(byWarm.warm)} contatos potenciais no funil`, tone: priorityColors.Warm, district: byWarm.nome, rule: rules.actionWarm },
      byVip && { title: 'Base VIP', value: byVip.nome, detail: `${formatNumber(byVip.vips)} VIPs para relacionamento`, tone: 'hsl(270, 70%, 62%)', district: byVip.nome, rule: rules.actionVip },
      byDormant && { title: 'Recuperação', value: byDormant.nome, detail: `${formatNumber(byDormant.semContato5Anos)} contatos há 5+ anos sem contato`, tone: 'hsl(0, 70%, 50%)', district: byDormant.nome, rule: rules.actionRecovery }
    ].filter(Boolean);
  }, [data.districtList]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ distrito: 'all', prioridade: 'all', vip: 'all', telefone: 'all', estudos: 'all', genero: 'all', search: '' });
  const clickSort = (col) => setSort((current) => current.col === col ? { col, asc: !current.asc } : { col, asc: col === 'nome' });
  const exportCsv = () => {
    const header = ['Distrito', 'Total', 'WhatsApp', 'Quente', 'Potencial', 'Morno', 'Frio', 'VIPs', 'Estudos Ativos', 'Pontuação Média'];
    const rows = sortedDistricts.map((district) => [
      district.nome,
      district.total,
      district.telefone,
      district.hot,
      district.warm,
      district.cool,
      district.cold,
      district.vips,
      district.estudos,
      district.score_medio
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'distritos-filtrados.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
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
    color: ['hsl(152,69%,53%)', 'hsl(80,60%,50%)', 'hsl(38,92%,50%)', 'hsl(14,100%,57%)', 'hsl(0,70%,50%)', 'hsl(220,15%,45%)'][index],
    description: `Quantidade de interessados filtrados na faixa "${label}" desde o último contato registrado.`
  }));

  return (
    <div className="relative flex h-screen w-full flex-col overflow-y-auto overflow-x-hidden silver-stage app-light details-light text-slate-100" onPointerMove={onPointerMove} onScroll={handleScroll}>
      <div ref={topAnchorRef} className="absolute top-0 h-1 w-full" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 transition duration-300"
        style={{
          background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.72), transparent 26%), linear-gradient(145deg, #f8fafc 0%, #e4e8ee 42%, #cfd6df 100%)`
        }}
      />

      <header className="sticky top-0 z-[70] flex items-center justify-between gap-4 border-b border-white/[0.06] bg-slate-950/80 px-8 py-4 backdrop-blur-2xl max-md:flex-col max-md:items-start max-md:px-4">
        <div className="flex items-center gap-4">
          {onBack ? (
            <button
              aria-label="Voltar para Associação Paulistana"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-lg font-black text-slate-300 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-200"
              onClick={onBack}
              type="button"
            >
              ←
            </button>
          ) : null}
          <img src="novo-tempo.jpg" alt="Novo Tempo" className="h-11 w-11 rounded-xl object-cover ring-1 ring-cyan-300/20" />
          <div>
            <h1 className="text-xl font-black tracking-normal text-slate-50">Detalhes dos interessados</h1>
            <p className="text-sm text-slate-400">Associação Paulistana - Campanha Escola Bíblica Novo Tempo</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-2 text-sm font-bold text-slate-400 max-md:w-full max-md:justify-center">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.10)]" />
          {formatNumber(data.kpis.total)} registros (Filtro Ativo)
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-8 py-6 max-md:px-4">
        <section data-dashboard-filterbar className="sticky top-[77px] z-[60] mb-6 rounded-2xl border border-white/[0.06] bg-slate-950/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl max-md:static">
          <div className="flex flex-wrap items-end gap-5 w-full">
            <FilterSelect label="Distrito" value={filters.distrito} onChange={(value) => setFilter('distrito', value)} active={filters.distrito !== 'all'}>
              <option value="all">Distritos</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </FilterSelect>
            <FilterSelect label="Prioridade ML" value={filters.prioridade} onChange={(value) => setFilter('prioridade', value)} active={filters.prioridade !== 'all'}>
              <option value="all">Prioridades</option>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>Prioridade: {label}</option>)}
            </FilterSelect>
            <FilterSelect label="Status VIP" value={filters.vip} onChange={(value) => setFilter('vip', value)} active={filters.vip !== 'all'}>
              <option value="all">Todos</option>
              <option value="1">Apenas VIPs</option>
              <option value="0">Não VIPs</option>
            </FilterSelect>
            <FilterSelect label="WhatsApp" value={filters.telefone} onChange={(value) => setFilter('telefone', value)} active={filters.telefone !== 'all'}>
              <option value="all">Todos</option>
              <option value="1">Com Telefone</option>
              <option value="0">Sem Telefone</option>
            </FilterSelect>
            <FilterSelect label="Estudos Ativos" value={filters.estudos} onChange={(value) => setFilter('estudos', value)} active={filters.estudos !== 'all'}>
              <option value="all">Todos</option>
              <option value="1">Em Andamento</option>
              <option value="0">Sem Estudo Ativo</option>
            </FilterSelect>
            <FilterSelect label="Gênero" value={filters.genero} onChange={(value) => setFilter('genero', value)} active={filters.genero !== 'all'}>
              <option value="all">Todos</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </FilterSelect>
            <div className="grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Ações
              <div className="flex gap-2">
                <button className="h-10 cursor-pointer rounded-lg bg-blue-500 px-5 text-sm font-bold text-white shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] transition hover:bg-blue-600 hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] focus:outline-none focus:ring-4 focus:ring-blue-500/30" onClick={resetFilters} type="button">Limpar</button>
                <button className="h-10 cursor-pointer rounded-lg bg-emerald-500 px-5 text-sm font-bold text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] transition hover:bg-emerald-600 hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] focus:outline-none focus:ring-4 focus:ring-emerald-500/30" onClick={exportCsv} type="button">Exportar</button>
              </div>
            </div>
            
            {onBack && (
              <div className="ml-auto mb-1 max-md:ml-0 max-md:w-full">
                <button className="interactive-card flex h-11 w-full items-center justify-center gap-2 cursor-pointer rounded-xl border border-white/[0.08] bg-slate-800/80 px-6 text-sm font-black text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-slate-700/80 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] focus:outline-none focus:ring-4 focus:ring-slate-500/20" onClick={onBack} type="button">
                  <span className="text-lg">←</span> Voltar
                </button>
              </div>
            )}
          </div>
          {activeFilters.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeFilters.map((item) => (
                <button
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500 px-3 py-1 text-xs font-bold text-white transition hover:border-blue-300/50 hover:bg-blue-600"
                  key={item.key}
                  onClick={() => setFilter(item.key, 'all')}
                  type="button"
                >
                  {item.label}
                  <span className="text-blue-300">×</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mb-6 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          <KpiCard accent="hsl(217, 91%, 60%)" label="Contatos (Filtrados)" rule={rules.total} value={data.kpis.total} sub={`em ${data.districtList.length} distritos`} onClick={resetFilters}>◎</KpiCard>
          <KpiCard accent="hsl(152, 69%, 53%)" label="Com Telefone" rule={rules.telefone} value={data.kpis.telefone} sub={`${pct(data.kpis.telefone, data.kpis.total)}% com zap`} onClick={() => setFilter('telefone', '1')}>☎</KpiCard>
          <KpiCard accent="hsl(14, 100%, 57%)" label="Contatos Quentes" rule={rules.hot} value={data.kpis.hot} sub={`${pct(data.kpis.hot, data.kpis.total)}% via ML`} onClick={() => setFilter('prioridade', 'Hot')}>△</KpiCard>
          <KpiCard accent="hsl(38, 92%, 50%)" label="VIPs" rule={rules.vip} value={data.kpis.vips} sub={`${pct(data.kpis.vips, data.kpis.total)}%`} onClick={() => setFilter('vip', '1')}>☆</KpiCard>
          <KpiCard accent="hsl(270, 70%, 62%)" label="Estudos Ativos" rule={rules.estudos} value={data.kpis.estudos} sub={`${pct(data.kpis.estudos, data.kpis.total)}%`} onClick={() => setFilter('estudos', '1')}>□</KpiCard>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-100">Prioridades de Ação</h2>
              <p className="mt-1 text-sm text-slate-500">Atalhos gerados a partir dos dados filtrados e da priorização operacional.</p>
            </div>
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">ML aplicado</span>
          </div>
          <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
            {actionInsights.map((item) => (
              <ActionCard
                detail={item.detail}
                key={item.title}
                onClick={() => setSelectedDistrictName(item.district)}
                rule={item.rule}
                title={item.title}
                tone={item.tone}
                value={item.value}
              />
            ))}
          </div>
        </section>

        <section className="mb-6 grid grid-cols-[1.6fr_1fr] gap-4 max-xl:grid-cols-1">
          <article className={`${cardClass} !overflow-visible min-w-0 hover:z-50 focus-within:z-50`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="inline-flex items-center gap-2 text-base font-black text-slate-100">Top 15 Distritos por Volume (Filtrado)<InfoHint text={rules.topDistricts} side="bottom" /></h2><span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Ranking</span></div>
            <BarChart data={data.districtList.slice(0, 15).map((d) => ({
              label: d.nome,
              value: d.total,
              description: rules.topDistricts,
              tooltipRows: [
                { label: 'Contatos', value: formatNumber(d.total) },
                { label: 'WhatsApp', value: `${formatNumber(d.telefone)} (${pct(d.telefone, d.total)}%)` },
                { label: 'Quentes', value: formatNumber(d.hot) },
                { label: 'Potenciais', value: formatNumber(d.warm) },
                { label: 'Mornos', value: formatNumber(d.cool) },
                { label: 'Frios', value: formatNumber(d.cold) },
                { label: 'VIPs', value: formatNumber(d.vips) },
                { label: 'Pontuação média', value: `${d.score_medio.toLocaleString('pt-BR')} - média dos scores ML dos contatos` }
              ]
            }))} />
          </article>
          <article className={`${cardClass} !overflow-visible min-w-0 hover:z-50 focus-within:z-50`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="inline-flex items-center gap-2 text-base font-black text-slate-100">Distribuição de Prioridade ML<InfoHint text={rules.priority} side="bottom" /></h2><span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Pontuação</span></div>
            <DonutChart values={priorityValues} />
          </article>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          <article className={`${cardClass} !overflow-visible min-w-0 hover:z-50 focus-within:z-50`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="inline-flex items-center gap-2 text-base font-black text-slate-100">Perfil Religioso<InfoHint text={rules.religion} side="bottom" /></h2><span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Top 10</span></div>
            <BarChart horizontal data={data.religionList.map((item, index) => ({ ...item, color: ['hsl(217,91%,60%)', 'hsl(195,80%,50%)', 'hsl(152,69%,53%)', 'hsl(38,92%,50%)', 'hsl(270,70%,62%)', 'hsl(340,70%,55%)'][index % 6], description: `Total de interessados filtrados com perfil religioso "${item.label}".` }))} />
          </article>
          <article className={`${cardClass} !overflow-visible min-w-0 hover:z-50 focus-within:z-50`}>
            <div className="mb-5 flex items-center justify-between gap-4"><h2 className="inline-flex items-center gap-2 text-base font-black text-slate-100">Tempo sem Contato<InfoHint text={rules.recency} side="bottom" /></h2><span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Recência</span></div>
            <BarChart data={tempoRows} />
          </article>
        </section>

        <section className={`${cardClass.replace('hover:-translate-y-1', '').replace('hover:z-50', '')} p-6 !overflow-visible focus-within:z-50`}>
          <div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
            <div>
              <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-100">Distritos (Dados Filtrados)<InfoHint text={rules.table} side="bottom" /></h2>
              <p className="mt-1 text-sm font-bold text-emerald-400">Dica: clique no nome do distrito para abrir a análise detalhada.</p>
            </div>
            <div className="flex w-full items-center gap-3 md:w-auto">
              <button className="flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 text-sm font-bold text-blue-500 transition hover:bg-blue-500/20 hover:text-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10" onClick={() => setShowRules(true)} type="button">
                <Info size={16} strokeWidth={2.5} /> Regras
              </button>
              <input className="h-11 w-full rounded-xl border border-white/[0.06] bg-slate-950/80 px-4 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 hover:border-blue-400/40 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 md:w-80" value={filters.search} onChange={(event) => setFilter('search', event.target.value.toLowerCase())} placeholder="Buscar distrito..." />
            </div>
          </div>
          <div className="max-h-[38rem] overflow-auto rounded-2xl">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {[
                    ['nome', 'Distrito', rules.district],
                    ['total', 'Total', rules.total],
                    ['telefone', 'WhatsApp', rules.telefone],
                    ['hot', 'Quente', rules.hot],
                    ['warm', 'Potencial', 'Contatos classificados como Potencial pelo modelo ML. Boa chance de abordagem, mas abaixo da prioridade Quente.'],
                    ['cool', 'Morno', 'Contatos classificados como Morno pelo modelo ML. Prioridade intermediaria para acompanhamento.'],
                    ['cold', 'Frio', 'Contatos classificados como Frio pelo modelo ML. Menor prioridade operacional no momento.'],
                    ['vips', 'VIPs', rules.vip],
                    ['score_medio', 'Pontuação Média', rules.score]
                  ].map(([key, label, hint]) => (
                    <th className="sticky top-0 z-[1] cursor-pointer whitespace-nowrap border-b border-white/[0.06] bg-slate-950/95 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 backdrop-blur-xl transition hover:text-blue-400" key={key} onClick={() => clickSort(key)}>
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sort.col === key ? <span className="text-blue-400">{sort.asc ? '↑' : '↓'}</span> : null}
                        <InfoHint text={hint} side={key === 'score_medio' || key === 'vips' ? 'bottom-right' : 'bottom'} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDistricts.map((d) => (
                  <tr className="transition hover:bg-white/[0.035]" key={d.nome}>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-black">
                      <button className="cursor-pointer text-blue-400 no-underline transition hover:text-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10" onClick={() => setSelectedDistrictName(d.nome)} type="button">{d.nome} ↗</button>
                    </td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.total)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.telefone)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-black tabular-nums text-orange-500">{formatNumber(d.hot)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-black tabular-nums text-amber-500">{formatNumber(d.warm)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.cool)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.cold)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4 font-bold tabular-nums">{formatNumber(d.vips)}</td>
                    <td className="whitespace-nowrap border-b border-white/[0.035] px-4 py-4">
                      <ScoreBadge district={d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-auto px-4 pb-4 pt-8 text-center text-sm text-slate-600">
          Escola Bíblica Novo Tempo | Prioridade via ML ({formatNumber(meta.mlRecords)} rankings do notebook)
        </footer>
      </main>
      <DistrictDrawer district={selectedDistrict} onClose={() => setSelectedDistrictName(null)} />
      {showRules && isMounted && createPortal(<RulesModal onClose={() => setShowRules(false)} />, document.body)}
      {isMounted && createPortal(
        <button
          className={`fixed bottom-8 right-8 z-[99999] grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all duration-300 hover:bg-blue-500 ${
            showScrollTop ? 'translate-y-0 opacity-100 hover:-translate-y-1 hover:scale-105' : 'pointer-events-none translate-y-10 opacity-0'
          }`}
          onClick={() => {
            if (topAnchorRef.current) {
              topAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
            } else {
              topAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          aria-label="Subir ao topo"
          title="Subir ao topo"
          type="button"
        >
          <ArrowUp size={24} strokeWidth={3} />
        </button>,
        document.body
      )}
    </div>
  );
}
