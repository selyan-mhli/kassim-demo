/* Kassim — moteur de démonstration déterministe, version 1.0.0.
   Les paramètres sont fictifs. Aucun cours observé ni probabilité implicite. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KassimEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const BASE = Object.freeze({ copperUSDPerTonne: 9000, usdPerEUR: 1.10, kgPerPart: 0.70, monthlyParts: 30000, months: 3 });
  const SUPPLIERS = [
    { id: 'A', name: 'Fournisseur A', conversion: 5.90, freight: 0.25, fixedMetal: 0, lag: 1, capacity: 18000, qualified: true },
    { id: 'B', name: 'Fournisseur B', conversion: 6.00, freight: 0.40, fixedMetal: 0.60, lag: 0, capacity: 12000, qualified: true },
    { id: 'C', name: 'Fournisseur C', conversion: 6.20, freight: 0.15, fixedMetal: 0, lag: 2, capacity: 15000, qualified: true }
  ];
  const defaults = () => ({ copper: 12, fx: -3, demand: 0, maxShare: 60, suppliers: SUPPLIERS.map(s => ({ ...s })) });
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  function validate(input) {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Le scénario doit être un objet avec ses paramètres et trois fournisseurs.'];
    [['copper', -30, 30], ['fx', -15, 15], ['demand', -40, 40], ['maxShare', 40, 100]].forEach(([k, lo, hi]) => {
      if (!finite(input[k]) || input[k] < lo || input[k] > hi) errors.push(`Paramètre ${k} hors limites (${lo} à ${hi}).`);
    });
    if (!Array.isArray(input.suppliers) || input.suppliers.length !== 3) return errors.concat('Trois fournisseurs sont nécessaires pour cette démonstration.');
    input.suppliers.forEach((s, i) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) { errors.push(`Fournisseur ${i + 1} : objet attendu.`); return; }
      if (s.id !== ['A', 'B', 'C'][i]) errors.push('Identifiants fournisseurs attendus : A, B, C dans cet ordre.');
      if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80) errors.push(`Nom fournisseur ${i + 1} invalide.`);
      [['conversion', 0, 1000], ['freight', 0, 1000], ['fixedMetal', 0, 1], ['lag', 0, 2], ['capacity', 0, 200000]].forEach(([k, lo, hi]) => {
        if (!finite(s[k]) || s[k] < lo || s[k] > hi) errors.push(`${s.id} : ${k} hors limites (${lo} à ${hi}).`);
      });
      if (!Number.isInteger(s.lag) || !Number.isInteger(s.capacity)) errors.push(`${s.id} : délai et capacité doivent être entiers.`);
      if (typeof s.qualified !== 'boolean') errors.push(`${s.id} : qualification invalide.`);
    });
    return errors;
  }
  function scenarios(input) {
    return [
      { id: 'low', name: 'Détente', copper: input.copper - 15, fx: input.fx + 5 },
      { id: 'base', name: 'Central', copper: input.copper, fx: input.fx },
      { id: 'high', name: 'Tension', copper: input.copper + 15, fx: input.fx - 5 }
    ];
  }
  function marketAt(month, scenario) {
    const fraction = Math.max(0, Math.min(BASE.months, month)) / BASE.months;
    return { copper: BASE.copperUSDPerTonne * (1 + scenario.copper / 100 * fraction), fx: BASE.usdPerEUR * (1 + scenario.fx / 100 * fraction) };
  }
  function unitCost(supplier, month, scenario) {
    const index = marketAt(month - supplier.lag, scenario);
    const baseMetal = BASE.kgPerPart / 1000 * BASE.copperUSDPerTonne / BASE.usdPerEUR;
    const floatingMetal = BASE.kgPerPart / 1000 * index.copper / index.fx;
    return supplier.conversion + supplier.freight + baseMetal * supplier.fixedMetal + floatingMetal * (1 - supplier.fixedMetal);
  }
  function feasible(shares, input) {
    const quantity = BASE.monthlyParts * (1 + input.demand / 100);
    if (Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > 1e-8 || shares.filter(s => s > 1e-8).length < 2) return false;
    return shares.every((share, i) => share >= -1e-8 && share <= input.maxShare / 100 + 1e-8 && (input.suppliers[i].qualified || share < 1e-8) && share * quantity <= input.suppliers[i].capacity + 1e-8);
  }
  function costOf(shares, input, scenario) {
    const quantity = BASE.monthlyParts * (1 + input.demand / 100);
    const monthly = Array.from({ length: BASE.months }, (_, t) => input.suppliers.reduce((total, supplier, i) => total + quantity * shares[i] * unitCost(supplier, t + 1, scenario), 0));
    return { monthly, total: monthly.reduce((a, b) => a + b, 0) };
  }
  function analyze(input) {
    const errors = validate(input);
    if (errors.length) return { errors, plans: [], feasibleCount: 0 };
    const paths = scenarios(input);
    const feasiblePlans = [];
    // Exhaustif sur la grille de 5 %, pas un optimum continu ou universel.
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20 - a; b++) {
      const shares = [a / 20, b / 20, (20 - a - b) / 20];
      if (feasible(shares, input)) feasiblePlans.push({ shares, costs: paths.map(p => costOf(shares, input, p)) });
    }
    const referenceShares = [0.60, 0.30, 0.10];
    const reference = { id: 'current', name: 'Mix actuel', shares: referenceShares, feasible: feasible(referenceShares, input), costs: paths.map(p => costOf(referenceShares, input, p)) };
    if (!feasiblePlans.length) return { errors: [], paths, reference, plans: [reference], feasibleCount: 0, quantity: BASE.monthlyParts * (1 + input.demand / 100), minimums: [] };
    const minimums = paths.map((_, j) => Math.min(...feasiblePlans.map(p => p.costs[j].total)));
    feasiblePlans.forEach(p => {
      p.regrets = p.costs.map((c, j) => Math.max(0, c.total - minimums[j]));
      p.maxRegret = Math.max(...p.regrets);
      p.worstCost = Math.max(...p.costs.map(c => c.total));
    });
    const center = [...feasiblePlans].sort((a, b) => a.costs[1].total - b.costs[1].total || a.maxRegret - b.maxRegret)[0];
    const robust = [...feasiblePlans].sort((a, b) => a.maxRegret - b.maxRegret || a.costs[1].total - b.costs[1].total)[0];
    reference.regrets = reference.feasible ? reference.costs.map((c, j) => Math.max(0, c.total - minimums[j])) : null;
    reference.maxRegret = reference.feasible ? Math.max(...reference.regrets) : null;
    reference.worstCost = Math.max(...reference.costs.map(c => c.total));
    return { version: VERSION, errors: [], paths, reference, plans: [reference, { ...center, id: 'central', name: 'Coût central minimal', feasible: true }, { ...robust, id: 'robust', name: 'Regret maximal limité', feasible: true }], minimums, feasibleCount: feasiblePlans.length, quantity: BASE.monthlyParts * (1 + input.demand / 100) };
  }
  function economics({ spend, improvement, realization, annualFee, internalCost }) {
    const values = [spend, improvement, realization, annualFee, internalCost];
    if (values.some(x => !finite(x) || x < 0) || realization > 1 || improvement > 1) throw new Error('Hypothèses économiques invalides.');
    const gross = spend * improvement;
    const captured = gross * realization;
    const fullCost = annualFee + internalCost;
    return { gross, captured, fullCost, net: captured - fullCost, roi: fullCost > 0 ? (captured - fullCost) / fullCost : null, breakEven: spend * realization > 0 ? fullCost / (spend * realization) : null };
  }
  return Object.freeze({ VERSION, BASE, defaults, validate, scenarios, marketAt, unitCost, feasible, costOf, analyze, economics });
});
