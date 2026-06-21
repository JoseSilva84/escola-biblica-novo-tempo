/* ═══════════════════════════════════════════════════════════
   SEVENFLOW Painel Geral — Lógica Dinâmica
   Filtros · Agregações Nacionais · Interações
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  let filteredData = RAW_DATA;
  let chartInstances = {};

  // ─── Estado dos Filtros ───
  const filters = {
    distrito: 'all',
    prioridade: 'all',
    vip: 'all',
    telefone: 'all',
    estudos: 'all',
    genero: 'all',
    search: ''
  };

  // ─── Popular Dropdown de Distritos ───
  const selectDistrito = document.getElementById('filter-distrito');
  const distritosUnicos = [...new Set(RAW_DATA.map(r => r.d))].sort();
  distritosUnicos.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      selectDistrito.appendChild(opt);
  });

  // ─── Elementos DOM ───
  const els = {
    kpiTotal: document.getElementById('kpi-total-val'),
    kpiTelefone: document.getElementById('kpi-telefone-val'),
    kpiHot: document.getElementById('kpi-hot-val'),
    kpiVip: document.getElementById('kpi-vip-val'),
    kpiEstudos: document.getElementById('kpi-estudos-val'),
    pctTelefone: document.getElementById('kpi-telefone-pct'),
    kpiDistritos: document.getElementById('kpi-distritos-pct'),
    filteredCount: document.getElementById('filtered-count'),
    tbody: document.getElementById('table-body')
  };

  // ─── Eventos de Filtro ───
  document.getElementById('filter-distrito').addEventListener('change', e => { filters.distrito = e.target.value; updateDashboard(); });
  document.getElementById('filter-prioridade').addEventListener('change', e => { filters.prioridade = e.target.value; updateDashboard(); });
  document.getElementById('filter-vip').addEventListener('change', e => { filters.vip = e.target.value; updateDashboard(); });
  document.getElementById('filter-telefone').addEventListener('change', e => { filters.telefone = e.target.value; updateDashboard(); });
  document.getElementById('filter-estudos').addEventListener('change', e => { filters.estudos = e.target.value; updateDashboard(); });
  document.getElementById('filter-genero').addEventListener('change', e => { filters.genero = e.target.value; updateDashboard(); });
  document.getElementById('search-input').addEventListener('input', e => { filters.search = e.target.value.toLowerCase(); updateDashboard(); });
  
  document.getElementById('btn-reset').addEventListener('click', resetFilters);

  function resetFilters() {
    ['distrito','prioridade','vip','telefone','estudos','genero'].forEach(id => {
        document.getElementById(`filter-${id}`).value = 'all';
        filters[id] = 'all';
    });
    document.getElementById('search-input').value = '';
    filters.search = '';
    updateDashboard();
  }

  // ─── Eventos dos Cards Interativos (KPIs) ───
  document.getElementById('card-hot').addEventListener('click', () => {
      resetFilters();
      document.getElementById('filter-prioridade').value = 'Hot';
      filters.prioridade = 'Hot';
      updateDashboard();
  });
  document.getElementById('card-vip').addEventListener('click', () => {
      resetFilters();
      document.getElementById('filter-vip').value = '1';
      filters.vip = '1';
      updateDashboard();
  });
  document.getElementById('card-telefone').addEventListener('click', () => {
      resetFilters();
      document.getElementById('filter-telefone').value = '1';
      filters.telefone = '1';
      updateDashboard();
  });
  document.getElementById('card-estudos').addEventListener('click', () => {
      resetFilters();
      document.getElementById('filter-estudos').value = '1';
      filters.estudos = '1';
      updateDashboard();
  });
  document.getElementById('card-total').addEventListener('click', resetFilters);

  // ─── Auxiliar: Animação ───
  function setCounter(el, val) {
    el.textContent = val.toLocaleString('pt-BR');
  }

  // ─── Lógica Principal: Filtrar e Agregar ───
  function updateDashboard() {
    console.time('Filter & Aggregate');
    
    // 1. Filtrar
    filteredData = RAW_DATA.filter(row => {
      if (filters.distrito !== 'all' && row.d !== filters.distrito) return false;
      if (filters.prioridade !== 'all' && row.p !== filters.prioridade) return false;
      if (filters.vip !== 'all' && row.v !== parseInt(filters.vip)) return false;
      if (filters.telefone !== 'all' && row.t !== parseInt(filters.telefone)) return false;
      if (filters.estudos !== 'all' && row.e !== parseInt(filters.estudos)) return false;
      if (filters.genero !== 'all' && row.g !== filters.genero) return false;
      if (filters.search && !row.d.toLowerCase().includes(filters.search)) return false;
      return true;
    });

    // 2. Agregar
    let kpis = { total: 0, telefone: 0, hot: 0, warm: 0, cool: 0, cold: 0, vips: 0, estudos: 0 };
    let distritosMap = {};
    let religioesMap = {};
    let tempoMap = { 'Até 3 meses': 0, '3m a 1 ano': 0, '1 a 2 anos': 0, '2 a 5 anos': 0, '5+ anos': 0, 'Não Informado': 0 };

    for (let i = 0; i < filteredData.length; i++) {
      const r = filteredData[i];
      kpis.total++;
      if (r.t) kpis.telefone++;
      if (r.v) kpis.vips++;
      if (r.e) kpis.estudos++;
      if (r.p === 'Hot') kpis.hot++;
      else if (r.p === 'Warm') kpis.warm++;
      else if (r.p === 'Cool') kpis.cool++;
      else if (r.p === 'Cold') kpis.cold++;

      if (!distritosMap[r.d]) {
        distritosMap[r.d] = { nome: r.d, total: 0, telefone: 0, hot: 0, warm: 0, cool: 0, cold: 0, vips: 0, sumScore: 0 };
      }
      let d = distritosMap[r.d];
      d.total++;
      d.sumScore += r.s;
      if (r.t) d.telefone++;
      if (r.v) d.vips++;
      if (r.p === 'Hot') d.hot++;
      else if (r.p === 'Warm') d.warm++;
      else if (r.p === 'Cool') d.cool++;
      else if (r.p === 'Cold') d.cold++;

      religioesMap[r.r] = (religioesMap[r.r] || 0) + 1;

      let faixa = 'Não Informado';
      if (r.c !== null) {
        if (r.c <= 90) faixa = 'Até 3 meses';
        else if (r.c <= 365) faixa = '3m a 1 ano';
        else if (r.c <= 730) faixa = '1 a 2 anos';
        else if (r.c <= 1825) faixa = '2 a 5 anos';
        else faixa = '5+ anos';
      }
      tempoMap[faixa]++;
    }

    const distritosList = Object.values(distritosMap).map(d => {
      d.score_medio = d.total > 0 ? Number((d.sumScore / d.total).toFixed(1)) : 0;
      return d;
    }).sort((a, b) => b.total - a.total);

    const religioesList = Object.entries(religioesMap)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.timeEnd('Filter & Aggregate');

    // 3. Atualizar Interface
    updateDOM(kpis, distritosList.length);
    renderTable(distritosList);
    updateCharts(kpis, distritosList, religioesList, tempoMap);
  }

  // ─── Atualizar DOM ───
  function updateDOM(kpis, distritosCount) {
    setCounter(els.kpiTotal, kpis.total);
    setCounter(els.kpiTelefone, kpis.telefone);
    setCounter(els.kpiHot, kpis.hot);
    setCounter(els.kpiVip, kpis.vips);
    setCounter(els.kpiEstudos, kpis.estudos);
    
    let pctTel = kpis.total > 0 ? Math.round((kpis.telefone / kpis.total) * 100) : 0;
    els.pctTelefone.textContent = pctTel + '% com zap';
    els.kpiDistritos.textContent = 'em ' + distritosCount + ' distritos';
    els.filteredCount.textContent = kpis.total.toLocaleString('pt-BR') + ' registros (Filtro Ativo)';
  }

  // ─── Tabela Interativa ───
  let sortCol = 'total';
  let sortAsc = false;
  let currentTableData = [];

  function renderTable(data) {
    currentTableData = data;
    
    const sorted = [...currentTableData].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });

    els.tbody.innerHTML = sorted.map(d => `
      <tr>
        <td>
            <a href="/dashboard-geral/distrito?id=${encodeURIComponent(d.nome)}" style="color:var(--accent-blue); text-decoration:none; font-weight:700;">
                ${d.nome} ↗
            </a>
        </td>
        <td>${d.total.toLocaleString('pt-BR')}</td>
        <td>${d.telefone.toLocaleString('pt-BR')}</td>
        <td class="hot-count">${d.hot}</td>
        <td class="warm-count">${d.warm}</td>
        <td>${d.cool}</td>
        <td>${d.cold}</td>
        <td>${d.vips}</td>
        <td><span class="score-badge" style="background:${d.score_medio >= 12 ? 'var(--accent-hot-soft)' : d.score_medio >= 10 ? 'var(--accent-amber-soft)' : 'var(--accent-cool-soft)'};color:${d.score_medio >= 12 ? 'var(--accent-hot)' : d.score_medio >= 10 ? 'var(--accent-amber)' : 'var(--accent-cool)'}">${d.score_medio}</span></td>
      </tr>
    `).join('');
  }

  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = col === 'nome'; }
      renderTable(currentTableData);
    });
  });

  // ─── Tema dos Gráficos ───
  const chartTheme = {
    chart: { background: 'transparent', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, animations: { enabled: true, dynamicAnimation: { speed: 300 } } },
    theme: { mode: 'dark' },
    grid: { borderColor: 'rgba(255,255,255,0.04)', strokeDashArray: 3, padding: { left: 10, right: 10 } },
    tooltip: { theme: 'dark', style: { fontSize: '12px' }, y: { formatter: val => val.toLocaleString('pt-BR') } }
  };

  // ─── Atualizar Gráficos ───
  function updateCharts(kpis, distritos, religioes, tempoMap) {
    const top15 = distritos.slice(0, 15);

    // 1. Distritos
    if (!chartInstances.distritos) {
      chartInstances.distritos = new ApexCharts(document.getElementById('chart-distritos'), {
        ...chartTheme,
        series: [{ name: 'Contatos', data: top15.map(d => d.total) }],
        chart: { ...chartTheme.chart, type: 'bar', height: 340 },
        plotOptions: { bar: { borderRadius: 6, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: v => v.toLocaleString('pt-BR'), offsetY: -22, style: { fontSize: '11px', colors: ['hsl(0,0%,55%)'] } },
        xaxis: { categories: top15.map(d => d.nome.length > 14 ? d.nome.substring(0, 14) + '…' : d.nome), labels: { style: { colors: '#888' }, rotate: -45, rotateAlways: true }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: '#888' }, formatter: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v } },
        colors: ['hsl(217,91%,60%)']
      });
      chartInstances.distritos.render();
    } else {
      chartInstances.distritos.updateOptions({ xaxis: { categories: top15.map(d => d.nome.length > 14 ? d.nome.substring(0, 14) + '…' : d.nome) } });
      chartInstances.distritos.updateSeries([{ data: top15.map(d => d.total) }]);
    }

    // 2. Prioridades
    const prioData = [kpis.hot, kpis.warm, kpis.cool, kpis.cold];
    if (!chartInstances.prioridades) {
      chartInstances.prioridades = new ApexCharts(document.getElementById('chart-prioridades'), {
        ...chartTheme,
        series: prioData,
        chart: { ...chartTheme.chart, type: 'donut', height: 340 },
        labels: ['Quente', 'Potencial', 'Morno', 'Frio'],
        colors: ['hsl(14, 100%, 57%)', 'hsl(38, 92%, 50%)', 'hsl(210, 70%, 55%)', 'hsl(220, 15%, 45%)'],
        plotOptions: { pie: { donut: { size: '70%', labels: { show: true, name: { color: '#fff' }, value: { color: '#fff', fontSize: '24px', formatter: v => parseInt(v).toLocaleString('pt-BR') }, total: { show: true, label: 'Total', color: '#888' } } } } },
        dataLabels: { enabled: false },
        stroke: { width: 2, colors: ['#1c1f26'] },
        legend: { position: 'bottom', labels: { colors: '#888' } }
      });
      chartInstances.prioridades.render();
    } else {
      chartInstances.prioridades.updateSeries(prioData);
    }

    // 3. Religião
    if (!chartInstances.religiao) {
      chartInstances.religiao = new ApexCharts(document.getElementById('chart-religiao'), {
        ...chartTheme,
        series: [{ name: 'Pessoas', data: religioes.map(r => r.count) }],
        chart: { ...chartTheme.chart, type: 'bar', height: 340 },
        plotOptions: { bar: { borderRadius: 5, horizontal: true, distributed: true } },
        dataLabels: { enabled: true, formatter: v => v.toLocaleString('pt-BR') },
        xaxis: { categories: religioes.map(r => r.nome), labels: { style: { colors: '#888' } } },
        yaxis: { labels: { style: { colors: '#888' }, maxWidth: 160 } },
        colors: ['hsl(217,91%,60%)','hsl(195,80%,50%)','hsl(152,69%,53%)','hsl(38,92%,50%)','hsl(270,70%,62%)','hsl(340,70%,55%)'],
        legend: { show: false }
      });
      chartInstances.religiao.render();
    } else {
      chartInstances.religiao.updateOptions({ xaxis: { categories: religioes.map(r => r.nome) } });
      chartInstances.religiao.updateSeries([{ data: religioes.map(r => r.count) }]);
    }

    // 4. Tempo
    const ordemTempo = ['Até 3 meses', '3m a 1 ano', '1 a 2 anos', '2 a 5 anos', '5+ anos', 'Não Informado'];
    const tempoData = ordemTempo.map(nome => tempoMap[nome] || 0);

    if (!chartInstances.tempo) {
      chartInstances.tempo = new ApexCharts(document.getElementById('chart-tempo'), {
        ...chartTheme,
        series: [{ name: 'Pessoas', data: tempoData }],
        chart: { ...chartTheme.chart, type: 'bar', height: 340 },
        plotOptions: { bar: { borderRadius: 6, distributed: true } },
        dataLabels: { enabled: true, offsetY: -22, formatter: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v },
        xaxis: { categories: ordemTempo, labels: { style: { colors: '#888' } } },
        yaxis: { labels: { style: { colors: '#888' } } },
        colors: ['hsl(152,69%,53%)', 'hsl(80,60%,50%)', 'hsl(38,92%,50%)', 'hsl(14,100%,57%)', 'hsl(0,70%,50%)', 'hsl(220,15%,45%)'],
        legend: { show: false }
      });
      chartInstances.tempo.render();
    } else {
      chartInstances.tempo.updateSeries([{ data: tempoData }]);
    }
  }

  updateDashboard();
});
