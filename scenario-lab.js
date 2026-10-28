/* Kassim — lecture des scénarios et comparaison conditionnelle de trois plans. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.KassimEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KassimLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  const TIE_EUROS = 1;
  const COPPER_GRID = [-30, -20, -10, 0, 10, 20, 30];
  const FX_GRID = [10, 5, 0, -5, -10];
  const names = { current: 'Mix actuel', central: 'Coût central minimal', robust: 'Regret maximal limité' };
  const shortNames = { current: 'Actuel', central: 'Coût central', robust: 'Regret limité' };
  function requireInput(input) {
    const errors = E.validate(input);
    if (errors.length) throw new Error(errors.join(' '));
  }
  function series(input, plan, metric) {
    requireInput(input);
    if (!['copper', 'fx', 'monthly', 'cumulative'].includes(metric)) throw new Error('Mesure inconnue.');
    const isCost = metric === 'monthly' || metric === 'cumulative';
    if (isCost && (!plan || !E.feasible(plan.shares, input))) return [];
    return E.scenarios(input).map(path => {
      let months = [0, 1, 2, 3], values;
      if (metric === 'copper' || metric === 'fx') {
        values = months.map(month => E.marketAt(month, path)[metric]);
      } else {
        const costs = E.costOf(plan.shares, input, path);
        if (metric === 'monthly') { months = [1, 2, 3]; values = costs.monthly; }
        else { let sum = 0; values = [0, ...costs.monthly.map(value => sum += value)]; }
      }
      return { id: path.id, name: path.name, months, values };
    });
  }
  function probe(input, plans, copper, fx) {
    requireInput(input);
    if (!Number.isFinite(copper) || copper < -30 || copper > 30 || !Number.isFinite(fx) || fx < -15 || fx > 15) throw new Error('Point de sensibilité hors limites.');
    const costs = plans.filter(plan => E.feasible(plan.shares, input)).map(plan => ({ id: plan.id, shares: [...plan.shares], total: E.costOf(plan.shares, input, { copper, fx }).total }));
    const minimum = costs.length ? Math.min(...costs.map(item => item.total)) : null;
    const winners = costs.filter(item => item.total - minimum <= TIE_EUROS).map(item => item.id);
    return { copper, fx, minimum, costs, winners };
  }
  function map(input, plans) {
    return FX_GRID.flatMap(fx => COPPER_GRID.map(copper => probe(input, plans, copper, fx)));
  }
  function mount(options) {
    const $ = id => document.getElementById(id);
    const money = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    const number = (n, digits = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
    const signed = n => `${n > 0 ? '+' : ''}${number(n)} %`;
    const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let metric = 'monthly', focusPath = 'all', month = 3, probePoint = { copper: 10, fx: 0 }, cachedMap = [], mapKey = '';
    let lastInput, lastAnalysis, lastPlan;
    const palette = ['var(--color-scenario-low)', 'var(--color-scenario-base)', 'var(--color-scenario-high)'];
    const metricLabels = { copper: 'Cuivre · USD par tonne', fx: 'Change · dollars pour un euro', monthly: 'Achats mensuels · milliers d’euros', cumulative: 'Achats cumulés · milliers d’euros' };
    const compact = value => metric === 'fx' ? number(value, 2) : metric === 'copper' ? number(value) : number(value / 1000, 0);
    function getSeries() { return lastInput ? series(lastInput, lastPlan, metric) : []; }
    function draw() {
      if (!lastInput || $('page-scenarios').hidden) return;
      const datasets = getSeries(), container = $('lab-chart');
      $('lab-chart-title').textContent = metricLabels[metric];
      $('lab-axis-note').textContent = metric === 'cumulative' ? 'Axe depuis zéro · cumul des trois mois.' : 'Axe vertical resserré pour lire les écarts · ne part pas nécessairement de zéro.';
      if (!datasets.length) {
        container.innerHTML = '<p class="lab-empty">Aucun plan faisable sur la grille. Les courbes cuivre et change restent consultables.</p>';
        $('lab-readout').textContent = 'Coûts indisponibles sous ces contraintes.';
        return;
      }
      const width = Math.max(240, container.clientWidth), height = width < 500 ? 280 : 360;
      const left = metric === 'fx' ? 48 : 62, right = 20, top = 30, bottom = 38;
      const values = datasets.flatMap(s => s.values), min = Math.min(...values), max = Math.max(...values);
      const spread = Math.max(max - min, Math.abs(max) * .005, .01);
      const lo = metric === 'cumulative' ? 0 : min - spread * .15;
      const hi = max + spread * .18;
      const months = datasets[0].months;
      const x = i => left + i / Math.max(1, months.length - 1) * (width - left - right);
      const y = value => height - bottom - (value - lo) / (hi - lo) * (height - top - bottom);
      const monthIndex = months.indexOf(month), currentIndex = monthIndex < 0 ? months.length - 1 : monthIndex;
      let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="lab-svg-title lab-svg-desc"><title id="lab-svg-title">${escape(metricLabels[metric])} — trois scénarios fictifs</title><desc id="lab-svg-desc">Détente en tirets, central en trait continu, tension en pointillés. ${metric === 'cumulative' ? 'Axe depuis zéro.' : 'Axe vertical resserré.'} Les montants exacts sont dans le tableau et la lecture par mois.</desc>`;
      for (let i = 0; i <= 4; i++) {
        const v = lo + (hi - lo) * i / 4;
        svg += `<line x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--color-rule)"/><text x="${left - 10}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
      }
      svg += `<line x1="${x(currentIndex)}" x2="${x(currentIndex)}" y1="${top}" y2="${height - bottom}" class="lab-cursor"/>`;
      months.forEach((m, i) => { svg += `<text x="${x(i)}" y="${height - 10}" text-anchor="${i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle'}">${m === 0 ? 'Base' : 'M+' + m}</text>`; });
      datasets.forEach((s, j) => {
        const opacity = focusPath === 'all' || focusPath === s.id ? 1 : .18;
        const dash = j === 0 ? '9 5' : j === 2 ? '2 5' : '';
        svg += `<g opacity="${opacity}"><path class="lab-line" d="${s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}" stroke="${palette[j]}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        s.values.forEach((v, i) => { svg += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === currentIndex ? 5 : 3}" fill="${palette[j]}"><title>${escape(s.name)} · M+${months[i]} · ${metric === 'fx' ? number(v, 4) + ' USD/EUR' : metric === 'copper' ? number(v) + ' USD/t' : money(v)}</title></circle>`; });
        svg += '</g>';
      });
      container.innerHTML = svg + '</svg>';
      $('lab-readout-title').textContent = month === 0 ? 'Base de démonstration' : `Lecture à M+${month}`;
      $('lab-readout').innerHTML = datasets.map((s, j) => `<div class="lab-readout-row"><span class="lab-path-name" data-path="${s.id}"><i aria-hidden="true"></i>${escape(s.name)}</span><strong class="num">${metric === 'fx' ? number(s.values[currentIndex], 4) + ' $/€' : metric === 'copper' ? number(s.values[currentIndex]) + ' $/t' : money(s.values[currentIndex])}</strong></div>`).join('');
      $('lab-values').innerHTML = `<table class="table"><caption class="offscreen">Valeurs exactes des courbes : ${escape(metricLabels[metric])}</caption><thead><tr><th>Scénario</th>${months.map(m => `<th class="num">${m === 0 ? 'Base' : 'M+' + m}</th>`).join('')}</tr></thead><tbody>${datasets.map(s => `<tr><td>${escape(s.name)}</td>${s.values.map(v => `<td class="num">${metric === 'fx' ? number(v, 4) : metric === 'copper' ? number(v) : money(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    function drawProbe() {
      const result = probe(lastInput, lastAnalysis.plans, probePoint.copper, probePoint.fx);
      $('lab-probe-copper').textContent = signed(probePoint.copper);
      $('lab-probe-fx').textContent = signed(probePoint.fx);
      if (!result.costs.length) { $('lab-probe-detail').textContent = 'Aucun plan faisable à comparer.'; return; }
      const leaders = result.winners.map(id => shortNames[id]).join(' / ');
      $('lab-probe-detail').innerHTML = `<strong>${escape(leaders)}</strong><span>${result.winners.length > 1 ? 'Plans au même coût à 1 € près.' : 'Coût le plus bas parmi les trois plans figés.'}</span><div class="lab-probe-prices">${result.costs.map(c => `<div><span>${escape(shortNames[c.id])}</span><strong>${money(c.total)}</strong><small>${c.total - result.minimum <= TIE_EUROS ? 'Minimum comparé' : '+' + money(c.total - result.minimum)}</small></div>`).join('')}</div><p class="small muted">Cuivre et change évoluent linéairement jusqu’à ces variations à M+3. Coûts sur 90 jours ; volumes, clauses et parts fournisseurs inchangés. Aucun autre plan n’est recherché dans cette grille.</p>`;
      $('lab-map').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.copper) === probePoint.copper && Number(button.dataset.fx) === probePoint.fx)));
    }
    function drawMap() {
      const key = JSON.stringify([lastInput, lastAnalysis.plans.map(p => p.shares)]);
      if (key !== mapKey) {
        cachedMap = map(lastInput, lastAnalysis.plans); mapKey = key;
        $('lab-map').innerHTML = `<table class="lab-map-table"><caption>Colonnes : cuivre à M+3. Lignes : dollars pour 1 € à M+3.</caption><thead><tr><th scope="col">Change</th>${COPPER_GRID.map(v => `<th scope="col">${signed(v)}</th>`).join('')}</tr></thead><tbody>${FX_GRID.map(fx => `<tr><th scope="row">${signed(fx)}</th>${COPPER_GRID.map(copper => {
          const point = cachedMap.find(p => p.copper === copper && p.fx === fx);
          const id = point.winners.length === 1 ? point.winners[0] : point.winners.length ? 'tie' : 'none';
          const label = id === 'tie' ? '≈' : id === 'none' ? '—' : { current: '1', central: '2', robust: '3' }[id];
          return `<td><button type="button" class="lab-map-cell" data-winner="${id}" data-copper="${copper}" data-fx="${fx}" aria-pressed="false" aria-label="Cuivre ${signed(copper)}, change ${signed(fx)} : ${point.winners.length ? point.winners.map(id => names[id]).join(' et ') : 'aucun plan faisable'}">${label}</button></td>`;
        }).join('')}</tr>`).join('')}</tbody></table>`;
        $('lab-map').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
          probePoint = { copper: Number(button.dataset.copper), fx: Number(button.dataset.fx) }; drawProbe();
        }));
      }
      drawProbe();
    }
    function render() {
      lastInput = options.getInput(); lastAnalysis = options.getAnalysis(); lastPlan = options.getPlan();
      const errors = E.validate(lastInput);
      $('lab-error').hidden = !errors.length && !!lastAnalysis?.feasibleCount;
      $('lab-error').textContent = errors.length ? errors.join(' ') : lastAnalysis?.feasibleCount ? '' : 'Aucun plan faisable sur la grille. Vérifiez capacités, qualification et concentration dans Fournisseurs. Les trajectoires matière restent des hypothèses.';
      $('lab-content').hidden = !!errors.length;
      if (errors.length || !lastAnalysis) return;
      ['copper', 'fx', 'demand', 'maxShare'].forEach(key => { $('lab-' + key).value = lastInput[key]; });
      $('lab-copper-value').textContent = signed(lastInput.copper);
      $('lab-fx-value').textContent = signed(lastInput.fx);
      $('lab-demand-value').textContent = number(lastAnalysis.quantity) + ' p./mois';
      $('lab-maxShare-value').textContent = number(lastInput.maxShare) + ' %';
      const select = $('lab-plan');
      select.querySelectorAll('option').forEach(option => { option.disabled = !lastAnalysis.plans.some(p => p.id === option.value && p.feasible); });
      select.disabled = !lastAnalysis.feasibleCount;
      if (lastPlan) select.value = lastPlan.id;
      $('lab-plan-note').textContent = lastPlan ? `Parts A / B / C : ${lastPlan.shares.map(s => number(s * 100)).join(' / ')} %. Mix constant sur les trois mois.` : 'Aucune allocation faisable à afficher.';
      $('lab-cards').innerHTML = lastAnalysis.paths.map((path, j) => {
        const end = E.marketAt(3, path);
        const cost = lastPlan?.costs[j];
        const delta = cost && lastAnalysis.reference?.feasible ? cost.total - lastAnalysis.reference.costs[j].total : null;
        return `<article class="lab-scenario" data-path="${path.id}"><div class="lab-scenario-head"><span class="lab-path-name" data-path="${path.id}"><i aria-hidden="true"></i>${escape(path.name)}</span><span class="small muted">À M+3</span></div><dl><div><dt>Cuivre</dt><dd>${signed(path.copper)} <small>${number(end.copper)} $/t</small></dd></div><div><dt>USD pour 1 €</dt><dd>${signed(path.fx)} <small>${number(end.fx, 4)} $/€</small></dd></div></dl><div class="lab-scenario-total"><span>Achats sur 90 jours</span><strong class="num">${cost ? money(cost.total) : '—'}</strong><small>${delta === null ? 'Référence non comparable' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${money(Math.abs(delta))} vs mix actuel`}</small></div></article>`;
      }).join('');
      $('lab-map-section').hidden = !lastAnalysis.feasibleCount;
      if (lastAnalysis.feasibleCount) drawMap();
      draw();
    }
    ['copper', 'fx', 'demand', 'maxShare'].forEach(key => $('lab-' + key).addEventListener('input', event => options.onInput(key, Number(event.target.value))));
    $('lab-plan').addEventListener('change', event => options.onPlan(event.target.value));
    $('lab-reset').addEventListener('click', () => $('reset').click());
    document.querySelectorAll('[data-lab-metric]').forEach(button => button.addEventListener('click', () => {
      metric = button.dataset.labMetric; if (metric === 'monthly' && month === 0) month = 1;
      document.querySelectorAll('[data-lab-metric]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      syncMonths(); draw();
    }));
    document.querySelectorAll('[data-lab-path]').forEach(button => button.addEventListener('click', () => {
      focusPath = button.dataset.labPath;
      document.querySelectorAll('[data-lab-path]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      draw();
    }));
    document.querySelectorAll('[data-lab-month]').forEach(button => button.addEventListener('click', () => { month = Number(button.dataset.labMonth); syncMonths(); draw(); }));
    function syncMonths() {
      document.querySelectorAll('[data-lab-month]').forEach(button => { button.disabled = metric === 'monthly' && button.dataset.labMonth === '0'; button.setAttribute('aria-pressed', String(Number(button.dataset.labMonth) === month)); });
    }
    let resizeFrame;
    new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(draw); }).observe($('lab-chart'));
    syncMonths();
    return { render };
  }
  return Object.freeze({ series, probe, map, TIE_EUROS, COPPER_GRID, FX_GRID, mount });
});
