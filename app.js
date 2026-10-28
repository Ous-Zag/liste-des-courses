"use strict";
/* Liste de courses – interface. Les données viennent du fichier JSON stocké sur GitHub (voir store.js). */

const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
let D = null; // données courantes (copie du fichier JSON)
const ui = { catTab: "ingredients", catQuery: "", dishQuery: "", showHidden: false };

// ---------- Couleurs et libellés ----------
const CAT_ORDER = ["Viandes, poissons et œufs", "Légumes et herbes", "Fruits", "Féculents, pâtes et légumes secs", "Huiles, condiments et épices", "Boissons", "Autres", "Hygiène corporelle", "Entretien de la maison"];
const CAT_COLOR = { "Viandes, poissons et œufs": "#E5383B", "Légumes et herbes": "#2BA84A", "Fruits": "#FF8A00", "Féculents, pâtes et légumes secs": "#E0A800", "Huiles, condiments et épices": "#C2185B", "Boissons": "#0FA3B1", "Hygiène corporelle": "#00A6D6", "Entretien de la maison": "#6A4CFF" };
const DAIRY_COLOR = "#3A86FF";
const colorOf = (c) => CAT_COLOR[c] || "#7D8597";
const catSort = (a, b) => { const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "fr"); };

// ---------- Format ----------
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });
const money = (v) => (v == null ? "–" : new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v) + " DT");
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtQty(q, unit) {
  if (unit === "g") return q >= 1000 ? nf.format(q / 1000) + " kg" : nf.format(q) + " g";
  if (unit === "ml") return q >= 1000 ? nf.format(q / 1000) + " L" : nf.format(q) + " ml";
  return nf.format(q) + " " + unit;
}
const isMetric = (u) => u === "g" || u === "ml";
const priceUnit = (u) => (u === "g" ? "kg" : u === "ml" ? "L" : u);
function cost(price, qty, unit) { if (price == null || qty == null) return null; return isMetric(unit) ? (qty / 1000) * price : qty * price; }
const sum = (arr) => arr.reduce((s, v) => s + (v || 0), 0);
const check = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const ICON = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

// ---------- Accès aux données ----------
const byId = (col, id) => D[col].find((x) => x.id === id);
const ing = (id) => byId("ingredients", id);
function dishCost(d) { const c = d.ingredients.map((x) => { const i = ing(x.ingredientId); return i ? cost(i.price, x.qty, i.unit) : null; }); return c.some((v) => v != null) ? sum(c) : null; }
function lineInfo(col, line) {
  if (col === "ingredientsToBuy") { const i = ing(line.ingredientId); return i && { item: i, group: "Ingrédients", color: colorOf(i.category), cost: cost(i.price, line.qty, i.unit) }; }
  if (col === "dairyToBuy") { const i = byId("dairy", line.dairyId); return i && { item: i, group: "Produits laitiers", color: DAIRY_COLOR, cost: cost(i.price, line.qty, i.unit) }; }
  const i = byId("hygiene", line.hygieneId); return i && { item: i, group: "Hygiène", color: colorOf(i.category), cost: cost(i.price, line.qty, i.unit) };
}

// ---------- Connexion GitHub et accès au fichier JSON ----------
const CFG_KEY = "courses-github-v1";
function detectRepo() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return {};
  const first = location.pathname.split("/").filter(Boolean)[0];
  return { owner: m[1], repo: first || m[0] };
}
function loadCfg() { let s = {}; try { s = JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); } catch {} return { branch: "data", path: "data.json", ...detectRepo(), ...s }; }
function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {} }
let cfg = loadCfg(), store = null, lastCommit = null;
const loadSeed = async () => { const r = await fetch("seed.json", { cache: "no-store" }); if (!r.ok) throw new Error("seed.json introuvable."); return r.json(); };
function makeStore() { store = cfg.owner && cfg.repo ? Store.GitHubStore(cfg, { seed: loadSeed }) : null; renderBanner(); }
const canWrite = () => !!(store && store.canWrite());

let pending = 0;
function setSync(t) { $("#sync").textContent = t; }
async function api(method, url, body) {
  pending++; setSync(method === "GET" ? "Chargement…" : "Enregistrement…");
  try {
    if (!store) throw new Error("Connexion GitHub non configurée : ouvrez « GitHub » en haut de la page.");
    if (method === "GET") { const r = await store.read(); D = Core.normalize(r.data); if (r.created) toast("Fichier data.json créé sur la branche « " + cfg.branch + " »."); return; }
    if (url === "reset") body = { seed: await loadSeed() };
    const r = await store.mutate((d) => Core.route(d, method, url, body), (d) => Core.describe(d, method, url, body));
    D = Core.normalize(r.data); lastCommit = r.commit;
    return r.result;
  } finally {
    pending--; setSync(pending ? "Enregistrement…" : canWrite() ? "Enregistré" : "Lecture seule");
  }
}
function renderBanner() {
  const b = $("#banner"); if (!b) return;
  if (!store) { b.hidden = false; b.innerHTML = `Connectez votre dépôt GitHub pour charger les données. <button class="btn pop small" data-gh>Connexion GitHub</button>`; return; }
  if (!store.canWrite()) { b.hidden = false; b.innerHTML = `Lecture seule : connectez un jeton GitHub pour modifier les données. <button class="btn pop small" data-gh>Connexion GitHub</button>`; return; }
  b.hidden = true; b.innerHTML = "";
}
function ghDialog(note) {
  openDialog(`<div class="dlg-head"><h2 id="dlgTitle">Connexion GitHub</h2></div>
  <div class="dlg-body">${note ? `<p class="err" style="color:var(--ink)">${esc(note)}</p>` : ""}
    <p class="lead" style="margin:0">Les données sont dans le fichier <b>${esc(cfg.path || "data.json")}</b> de la branche <b>${esc(cfg.branch || "data")}</b> de votre dépôt. Chaque modification y est enregistrée par un commit.</p>
    <div class="two"><div class="field"><label for="g-owner">Propriétaire</label><input id="g-owner" value="${esc(cfg.owner || "")}" placeholder="ous-zag" autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label for="g-repo">Dépôt</label><input id="g-repo" value="${esc(cfg.repo || "")}" placeholder="liste-des-courses" autocapitalize="off" spellcheck="false"></div></div>
    <div class="two"><div class="field"><label for="g-branch">Branche des données</label><input id="g-branch" value="${esc(cfg.branch || "data")}" autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label for="g-path">Fichier</label><input id="g-path" value="${esc(cfg.path || "data.json")}" autocapitalize="off" spellcheck="false"></div></div>
    <div class="field"><label for="g-token">Jeton d’accès GitHub</label><input id="g-token" type="password" value="${esc(cfg.token || "")}" placeholder="github_pat_…" autocomplete="off" spellcheck="false">
      <span class="hint">Nécessaire pour modifier. Créez un <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">jeton « fine-grained »</a> limité à ce seul dépôt, avec la permission <b>Contents : Read and write</b>. Il reste enregistré sur cet appareil uniquement. Sans jeton, l’application est en lecture seule.</span></div>
    <p class="err" id="f-err"></p></div>
  <div class="dlg-foot">${cfg.token ? `<button type="button" class="btn danger" id="g-logout">Oublier le jeton</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" value="save">Tester et enregistrer</button></div>`,
  async () => {
    const next = { ...cfg, owner: $("#g-owner").value.trim(), repo: $("#g-repo").value.trim(), branch: $("#g-branch").value.trim() || "data", path: $("#g-path").value.trim() || "data.json", token: $("#g-token").value.trim() };
    if (!next.owner || !next.repo) throw new Error("Indiquez le propriétaire et le dépôt.");
    const test = Store.GitHubStore(next, { seed: loadSeed });
    const r = await test.read();
    cfg = next; saveCfg(cfg); makeStore(); D = Core.normalize(r.data); setSync(canWrite() ? "À jour" : "Lecture seule"); render();
    toast(r.created ? "Connecté. Fichier de données créé sur GitHub." : canWrite() ? "Connecté à GitHub." : "Connecté en lecture seule.");
  });
  const lo = $("#g-logout");
  if (lo) lo.onclick = () => { delete cfg.token; saveCfg(cfg); makeStore(); dlg.close(); setSync("Lecture seule"); render(); toast("Jeton oublié sur cet appareil."); };
}
async function act(fn, okMsg) {
  try { const r = await fn(); render(); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); return r; }
  catch (e) { toast(e.message, true); render(); throw e; }
}
let toastT;
function toast(msg, bad) { const t = $("#toast"); t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), bad ? 6500 : 2600); }

// ---------- Routage ----------
const VIEWS = { courses: renderCourses, acheter: renderToBuy, planning: renderPlanning, plats: renderDishes, catalogues: renderCatalogues };
const current = () => (VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "courses");
function render() {
  if (!D) return;
  const v = current();
  document.querySelectorAll(".tabs a").forEach((a) => (a.dataset.view === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const active = document.activeElement, keep = active && active.id;
  const sel = active && "selectionStart" in active ? active.selectionStart : null;
  view.innerHTML = VIEWS[v]();
  if (keep) { const el = document.getElementById(keep); if (el) { el.focus(); if (sel != null && el.setSelectionRange) try { el.setSelectionRange(sel, sel); } catch {} } }
}
window.addEventListener("hashchange", () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

// ================= Vue 1 : liste de courses (US-10) =================
const GROUPS = [["ingredientsToBuy", "Ingrédients"], ["dairyToBuy", "Produits laitiers"], ["hygieneToBuy", "Hygiène et entretien"]];
function shopItem(col, line, info) {
  const it = info.item;
  return `<li class="item" style="--c:${info.color}"><label style="display:contents"><input type="checkbox" data-shop="${col}" data-id="${line.id}" ${line.checked ? "checked" : ""} aria-label="${esc(it.name)}"><span class="box">${check}</span>
  <span><span class="name">${esc(it.name)}</span>${it.ar ? `<span class="ar">${esc(it.ar)}</span>` : ""}</span>
  <span class="qty"><b>${esc(fmtQty(line.qty, it.unit))}</b><em>${money(info.cost)}</em></span></label></li>`;
}
function renderCourses() {
  let todoHtml = "", doneHtml = "", n = 0, nDone = 0, total = 0, spent = 0;
  for (const [col, label] of GROUPS) {
    const lines = D[col].map((l) => ({ l, info: lineInfo(col, l) })).filter((x) => x.info && x.l.qty > 0);
    lines.forEach(({ l, info }) => { n++; total += info.cost || 0; if (l.checked) { nDone++; spent += info.cost || 0; } });
    const todo = lines.filter((x) => !x.l.checked), done = lines.filter((x) => x.l.checked);
    if (todo.length) {
      if (col === "ingredientsToBuy") {
        const cats = [...new Set(todo.map((x) => x.info.item.category || "Autres"))].sort(catSort);
        todoHtml += `<section class="card grp"><div class="card-head"><h2>${label}</h2><span class="count">${todo.length}</span></div>` +
          cats.map((c) => `<div class="grp" style="--c:${colorOf(c)}"><h3><span class="dot"></span>${esc(c)}</h3><ul class="rows shop">${todo.filter((x) => (x.info.item.category || "Autres") === c).map((x) => shopItem(col, x.l, x.info)).join("")}</ul></div>`).join("") + `</section>`;
      } else {
        todoHtml += `<section class="card grp" style="--c:${col === "dairyToBuy" ? DAIRY_COLOR : "#00A6D6"}"><div class="card-head"><h2>${label}</h2><span class="count">${todo.length}</span></div><ul class="rows shop">${todo.map((x) => shopItem(col, x.l, x.info)).join("")}</ul></section>`;
      }
    }
    if (done.length) doneHtml += `<div class="grp"><p class="meta">${label}</p><ul class="rows shop">${done.map((x) => shopItem(col, x.l, x.info)).join("")}</ul></div>`;
  }
  if (!n) todoHtml = `<section class="card"><p class="empty">La liste de courses est vide. Générez les ingrédients depuis <a href="#planning">les plats à préparer</a>, ou ajoutez des articles dans <a href="#acheter">À acheter</a>.</p></section>`;
  else if (!todoHtml) todoHtml = `<section class="card" style="background:var(--ok);color:#fff"><p class="empty" style="color:#fff;font-weight:700">Tout est dans le panier. Les courses sont terminées.</p></section>`;
  return `<div class="vhead"><div><h1>Liste de courses</h1><p class="lead">Ingrédients, produits laitiers et produits d’hygiène à acheter. Cochez un article pour le mettre dans le panier.</p></div>
    <button class="btn ghost" data-act="uncheck" ${nDone ? "" : "disabled"}>Tout décocher</button></div>
  <div class="totals"><div class="stat hero"><small>Reste à acheter</small><b>${money(total - spent)}</b></div><div class="stat"><small>Dans le panier</small><b>${nDone} / ${n}</b></div><div class="stat"><small>Total des courses</small><b>${money(total)}</b></div></div>
  <div class="grid2"><div>${todoHtml}</div><aside class="card basket sticky" aria-label="Dans le panier"><div class="card-head"><h2>Dans le panier</h2><span class="meta">${money(spent)}</span></div>${doneHtml || `<p class="empty" style="color:inherit;opacity:.7">Cochez un article pour le mettre ici.</p>`}</aside></div>`;
}

// ================= Vue 2 : listes à acheter (US-07, 08, 09) =================
function toBuyCard(col, title, catalogCol, refKey, color, extraHead = "") {
  const lines = D[col].map((l) => ({ l, info: lineInfo(col, l) })).filter((x) => x.info);
  const tot = sum(lines.map((x) => x.info.cost));
  const used = new Set(D[col].map((l) => l[refKey]));
  const avail = D[catalogCol].filter((x) => !used.has(x.id));
  let options;
  if (catalogCol === "ingredients") {
    const cats = [...new Set(avail.map((x) => x.category || "Autres"))].sort(catSort);
    options = cats.map((c) => `<optgroup label="${esc(c)}">${avail.filter((x) => (x.category || "Autres") === c).map((x) => `<option value="${x.id}">${esc(x.name)} (${esc(x.unit)})</option>`).join("")}</optgroup>`).join("");
  } else options = avail.map((x) => `<option value="${x.id}">${esc(x.name)} (${esc(x.unit)})</option>`).join("");
  return `<section class="card" style="--c:${color}"><div class="card-head"><h2>${title}</h2><span class="count">${lines.length}</span><div class="right"><b>${money(tot)}</b>${extraHead}</div></div>
  ${lines.length ? `<ul class="rows">${lines.map(({ l, info }) => `<li class="row"><div class="main"><span class="name">${esc(info.item.name)}</span>${info.item.ar ? `<span class="ar">${esc(info.item.ar)}</span>` : ""}${info.item.category && catalogCol === "ingredients" ? `<span class="meta">${esc(info.item.category)}</span>` : ""}</div>
    <div class="ctrl"><input type="number" min="0" step="any" inputmode="decimal" id="q-${l.id}" value="${l.qty}" data-qty="${col}" data-id="${l.id}" aria-label="Quantité de ${esc(info.item.name)}"><span class="unit">${esc(info.item.unit)}</span><span class="money">${money(info.cost)}</span><button class="icon-btn del" data-del="${col}" data-id="${l.id}" aria-label="Retirer ${esc(info.item.name)}">${ICON.del}</button></div></li>`).join("")}</ul>` : `<p class="empty">Aucun article pour l’instant.</p>`}
  ${avail.length ? `<div class="addline"><select id="add-${col}" aria-label="Article à ajouter">${options}</select><input type="number" min="0" step="any" inputmode="decimal" id="addq-${col}" placeholder="Qté" aria-label="Quantité"><button class="btn primary" data-addline="${col}" data-ref="${refKey}">${ICON.plus}Ajouter</button></div>` : `<p class="meta" style="margin-top:10px">Tous les articles du catalogue sont dans la liste.</p>`}
  </section>`;
}
function renderToBuy() {
  return `<div class="vhead"><div><h1>À acheter</h1><p class="lead">Les ingrédients viennent des plats à préparer ; vous pouvez les ajuster. Les produits laitiers et d’hygiène se choisissent directement dans leur catalogue.</p></div></div>
  ${toBuyCard("ingredientsToBuy", "Ingrédients à acheter", "ingredients", "ingredientId", "#2BA84A", `<button class="btn pop small" data-act="generate">Générer depuis les plats</button>`)}
  ${toBuyCard("dairyToBuy", "Produits laitiers à acheter", "dairy", "dairyId", DAIRY_COLOR)}
  ${toBuyCard("hygieneToBuy", "Produits d’hygiène à acheter", "hygiene", "hygieneId", "#00A6D6")}`;
}

// ================= Vue 3 : liste des plats (US-06) =================
function renderPlanning() {
  const entries = D.dishList.map((e) => ({ e, d: byId("dishes", e.dishId) })).filter((x) => x.d);
  const visible = D.dishes.filter((d) => !d.hidden).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const tot = sum(entries.map((x) => dishCost(x.d)));
  return `<div class="vhead"><div><h1>Plats à préparer</h1><p class="lead">Votre liste unique de plats. Un même plat peut y figurer plusieurs fois. Générez ensuite les ingrédients à acheter.</p></div>
    <button class="btn pop" data-act="generate" ${entries.length ? "" : "disabled"}>Générer les ingrédients à acheter</button></div>
  <div class="totals"><div class="stat hero"><small>Coût estimé des plats</small><b>${money(tot)}</b></div><div class="stat"><small>Plats prévus</small><b>${entries.length}</b></div></div>
  <section class="card"><div class="card-head"><h2>Liste des plats</h2><span class="count">${entries.length}</span></div>
  ${entries.length ? `<ul class="rows">${entries.map(({ e, d }) => `<li class="row"><div class="main"><span class="name">${esc(d.name)}</span>${d.hidden ? `<span class="badge warn">masqué</span>` : ""}<span class="meta" style="display:block">${d.ingredients.length} ingrédients, ${money(dishCost(d))}</span></div>
    <div class="ctrl"><input id="n-${e.id}" value="${esc(e.note)}" placeholder="Note (jour, repas…)" data-note="${e.id}" aria-label="Note pour ${esc(d.name)}" style="width:190px"><button class="icon-btn del" data-del="dishList" data-id="${e.id}" aria-label="Retirer ${esc(d.name)} de la liste">${ICON.del}</button></div></li>`).join("")}</ul>` : `<p class="empty">Aucun plat prévu. Ajoutez-en ci-dessous.</p>`}
  ${visible.length ? `<div class="addline"><select id="add-dish" aria-label="Plat à ajouter">${visible.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select><input id="add-note" placeholder="Note (facultatif)" aria-label="Note"><button class="btn primary" data-act="addEntry">${ICON.plus}Ajouter</button></div>` : `<p class="meta" style="margin-top:10px">Aucun plat visible. Créez ou affichez des plats dans l’onglet <a href="#plats">Plats</a>.</p>`}
  </section>`;
}

// ================= Vue 4 : plats (US-04, 05) =================
function renderDishes() {
  const q = ui.dishQuery.toLowerCase();
  const list = D.dishes.filter((d) => (ui.showHidden || !d.hidden) && (!q || d.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const nHidden = D.dishes.filter((d) => d.hidden).length;
  const card = (d) => {
    const ings = d.ingredients.map((x) => ing(x.ingredientId)).filter(Boolean);
    const main = ings.map((i) => i.category).find((c) => ["Viandes, poissons et œufs", "Légumes et herbes", "Fruits", "Boissons"].includes(c)) || "Féculents, pâtes et légumes secs";
    const uses = D.dishList.filter((e) => e.dishId === d.id).length;
    return `<article class="dish ${d.hidden ? "hidden" : ""}" style="--c:${colorOf(main)}"><h3>${esc(d.name)}${d.hidden ? `<span class="badge warn">masqué</span>` : ""}</h3>
      <p class="meta" style="margin:0">${ings.length} ingrédients${uses ? `, prévu ${uses} fois` : ""}</p>
      <div class="chips">${ings.slice(0, 8).map((i) => `<span class="chip">${esc(i.name)}</span>`).join("")}${ings.length > 8 ? `<span class="chip">+${ings.length - 8}</span>` : ""}</div>
      <div class="foot"><span class="money">${money(dishCost(d))}</span>
      <button class="icon-btn" data-dish-edit="${d.id}" aria-label="Modifier ${esc(d.name)}" title="Modifier">${ICON.edit}</button>
      <button class="icon-btn" data-dish-hide="${d.id}" aria-label="${d.hidden ? "Afficher" : "Masquer"} ${esc(d.name)}" title="${d.hidden ? "Afficher" : "Masquer"}">${d.hidden ? ICON.eye : ICON.eyeOff}</button>
      <button class="icon-btn del" data-dish-del="${d.id}" aria-label="Supprimer ${esc(d.name)}" title="Supprimer">${ICON.del}</button></div></article>`;
  };
  return `<div class="vhead"><div><h1>Plats</h1><p class="lead">Composez vos plats à partir du catalogue d’ingrédients. Un plat masqué n’est plus proposé dans les plats à préparer.</p></div>
    <button class="btn primary" data-act="newDish">${ICON.plus}Nouveau plat</button></div>
  <div class="toolbar"><input class="search" type="search" id="dishSearch" placeholder="Rechercher un plat" value="${esc(ui.dishQuery)}" aria-label="Rechercher un plat">
    <label class="check"><input type="checkbox" id="showHidden" ${ui.showHidden ? "checked" : ""}>Afficher les plats masqués (${nHidden})</label></div>
  ${list.length ? `<div class="dishes">${list.map(card).join("")}</div>` : `<section class="card"><p class="empty">Aucun plat ne correspond.</p></section>`}`;
}
function dishDialog(d) {
  const rows = (d ? d.ingredients : [{ ingredientId: "", qty: "" }]);
  const cats = [...new Set(D.ingredients.map((x) => x.category || "Autres"))].sort(catSort);
  const opts = (sel) => `<option value="">Choisir…</option>` + cats.map((c) => `<optgroup label="${esc(c)}">${D.ingredients.filter((x) => (x.category || "Autres") === c).sort((a, b) => a.name.localeCompare(b.name, "fr")).map((x) => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`).join("");
  const row = (r) => `<div class="ingrow"><select data-ing aria-label="Ingrédient">${opts(r.ingredientId)}</select><input type="number" min="0" step="any" inputmode="decimal" data-q value="${r.qty}" aria-label="Quantité"><span class="unit" data-u>${r.ingredientId && ing(r.ingredientId) ? esc(ing(r.ingredientId).unit) : ""}</span><button type="button" class="icon-btn del" data-rmrow aria-label="Retirer la ligne">${ICON.del}</button></div>`;
  openDialog(`<div class="dlg-head"><h2 id="dlgTitle">${d ? "Modifier le plat" : "Nouveau plat"}</h2></div>
    <div class="dlg-body"><div class="field"><label for="f-name">Nom du plat</label><input id="f-name" required value="${esc(d ? d.name : "")}"></div>
    <label class="check"><input type="checkbox" id="f-hidden" ${d && d.hidden ? "checked" : ""}>Plat masqué</label>
    <div class="field"><span class="lab">Ingrédients et quantités</span><span class="hint">Quantités dans l’unité de l’ingrédient (g, ml ou pièces) pour 4 personnes.</span><div class="ingrows" id="ingrows">${rows.map(row).join("")}</div>
    <button type="button" class="btn ghost small" id="addrow" style="justify-self:start">${ICON.plus}Ajouter un ingrédient</button></div><p class="err" id="f-err"></p></div>
    <div class="dlg-foot"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" value="save">Enregistrer</button></div>`,
    async () => {
      const name = $("#f-name").value.trim();
      const ingredients = [...document.querySelectorAll("#ingrows .ingrow")].map((r) => ({ ingredientId: $("[data-ing]", r).value, qty: $("[data-q]", r).value })).filter((x) => x.ingredientId || x.qty);
      if (!name) throw new Error("Le nom du plat est obligatoire.");
      if (ingredients.some((x) => !x.ingredientId)) throw new Error("Choisissez un ingrédient sur chaque ligne, ou retirez la ligne.");
      if (ingredients.some((x) => !(Number(String(x.qty).replace(",", ".")) > 0))) throw new Error("Chaque ingrédient doit avoir une quantité supérieure à 0.");
      const body = { name, hidden: $("#f-hidden").checked, ingredients };
      await act(() => (d ? api("PUT", "dishes/" + d.id, body) : api("POST", "dishes", body)), d ? "Plat modifié." : "Plat créé.");
    });
  const box = $("#ingrows");
  $("#addrow").onclick = () => { box.insertAdjacentHTML("beforeend", row({ ingredientId: "", qty: "" })); box.lastElementChild.querySelector("select").focus(); };
  box.addEventListener("change", (e) => { if (e.target.matches("[data-ing]")) { const i = ing(e.target.value); e.target.closest(".ingrow").querySelector("[data-u]").textContent = i ? i.unit : ""; } });
  box.addEventListener("click", (e) => { const b = e.target.closest("[data-rmrow]"); if (b) b.closest(".ingrow").remove(); });
}

// ================= Vue 5 : catalogues (US-01, 02, 03) =================
const CATS = { ingredients: { title: "Ingrédients", one: "ingrédient", hasCat: true }, dairy: { title: "Produits laitiers", one: "produit laitier", hasCat: false }, hygiene: { title: "Produits d’hygiène", one: "produit d’hygiène", hasCat: true } };
function renderCatalogues() {
  const col = ui.catTab, cfg = CATS[col], q = ui.catQuery.toLowerCase();
  const list = D[col].filter((x) => !q || (x.name + " " + x.ar + " " + (x.category || "")).toLowerCase().includes(q));
  const groups = cfg.hasCat ? [...new Set(list.map((x) => x.category || "Autres"))].sort(catSort) : [null];
  const usage = (x) => {
    if (col === "ingredients") { const n = D.dishes.filter((d) => d.ingredients.some((i) => i.ingredientId === x.id)).length; return n ? `utilisé dans ${n} plat${n > 1 ? "s" : ""}` : "non utilisé"; }
    const tb = col === "dairy" ? D.dairyToBuy.some((l) => l.dairyId === x.id) : D.hygieneToBuy.some((l) => l.hygieneId === x.id);
    return tb ? "dans la liste à acheter" : "";
  };
  const row = (x) => `<li class="row"><div class="main"><span class="name">${esc(x.name)}</span>${x.ar ? `<span class="ar">${esc(x.ar)}</span>` : ""}<span class="meta">Unité : ${esc(x.unit)}${x.price != null ? `, ${money(x.price)} / ${esc(priceUnit(x.unit))}` : ""}${usage(x) ? `, ${usage(x)}` : ""}</span></div>
    <div class="ctrl"><button class="icon-btn" data-cat-edit="${x.id}" aria-label="Modifier ${esc(x.name)}">${ICON.edit}</button><button class="icon-btn del" data-cat-del="${x.id}" aria-label="Supprimer ${esc(x.name)}">${ICON.del}</button></div></li>`;
  return `<div class="vhead"><div><h1>Catalogues</h1><p class="lead">Les ingrédients servent à composer les plats. Les produits laitiers et d’hygiène s’ajoutent directement aux listes à acheter.</p></div>
    <button class="btn primary" data-act="newCat">${ICON.plus}Nouvel ${cfg.one.startsWith("ingr") ? "ingrédient" : "article"}</button></div>
  <div class="toolbar"><div class="seg" role="group" aria-label="Catalogue">${Object.entries(CATS).map(([k, c]) => `<button data-cattab="${k}" aria-pressed="${k === col}">${c.title} (${D[k].length})</button>`).join("")}</div>
    <input class="search" type="search" id="catSearch" placeholder="Rechercher (français ou tounsi)" value="${esc(ui.catQuery)}" aria-label="Rechercher dans le catalogue"></div>
  ${list.length ? groups.map((g) => `<section class="card" style="--c:${g ? colorOf(g) : DAIRY_COLOR}"><div class="card-head"><h3><span class="dot"></span>${esc(g || cfg.title)}</h3><span class="count">${list.filter((x) => !g || (x.category || "Autres") === g).length}</span></div><ul class="rows">${list.filter((x) => !g || (x.category || "Autres") === g).map(row).join("")}</ul></section>`).join("") : `<section class="card"><p class="empty">Aucun article ne correspond.</p></section>`}
  <p class="meta" style="margin-top:24px">Données enregistrées dans <b>${esc(cfg.path)}</b>, branche <b>${esc(cfg.branch)}</b> du dépôt <b>${esc(cfg.owner)}/${esc(cfg.repo)}</b>${D.updatedAt ? `, dernière modification le ${new Date(D.updatedAt).toLocaleString("fr-FR")}` : ""}.
    <a href="${store ? store.historyUrl() : "#"}" target="_blank" rel="noopener">Historique des modifications</a></p>
  <p class="toolbar"><button class="btn ghost small" data-gh>Connexion GitHub</button>${canWrite() ? `<button class="btn ghost small" data-act="reset">Réinitialiser toutes les données</button>` : ""}</p>`;
}
function catDialog(col, x) {
  const cfg = CATS[col];
  const cats = [...new Set(D[col].map((i) => i.category).filter(Boolean))].sort(catSort);
  openDialog(`<div class="dlg-head"><h2 id="dlgTitle">${x ? "Modifier" : "Nouveau"} : ${cfg.one}</h2></div>
    <div class="dlg-body"><div class="field"><label for="f-name">Nom</label><input id="f-name" required value="${esc(x ? x.name : "")}"></div>
    <div class="two"><div class="field"><label for="f-unit">Unité</label><input id="f-unit" list="units" required value="${esc(x ? x.unit : "")}"><span class="hint">${col === "ingredients" ? "g, ml, pièce, botte… C’est l’unité des quantités dans les plats." : "Format d’achat : pot, bouteille 1 L, paquet…"}</span></div>
    <div class="field"><label for="f-price">Prix (DT) <span class="hint" id="f-pu"></span></label><input id="f-price" type="number" min="0" step="any" inputmode="decimal" value="${x && x.price != null ? x.price : ""}"><span class="hint">Facultatif. Sert à estimer les coûts.</span></div></div>
    ${cfg.hasCat ? `<div class="field"><label for="f-cat">Catégorie</label><input id="f-cat" list="cats" value="${esc(x ? x.category : "")}"></div>` : ""}
    <div class="field"><label for="f-ar">Nom en tounsi</label><input id="f-ar" dir="auto" value="${esc(x ? x.ar : "")}"></div><p class="err" id="f-err"></p>
    <datalist id="units">${(col === "ingredients" ? ["g", "ml", "pièce", "botte", "boîte", "paquet", "œuf", "sachet", "baguette", "pot"] : ["pièce", "pot", "bouteille 1 L", "paquet", "flacon", "boîte"]).map((u) => `<option value="${u}">`).join("")}</datalist>
    <datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
    <div class="dlg-foot"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" value="save">Enregistrer</button></div>`,
    async () => {
      const body = { name: $("#f-name").value, unit: $("#f-unit").value, ar: $("#f-ar").value, price: $("#f-price").value === "" ? null : $("#f-price").value };
      if (cfg.hasCat) body.category = $("#f-cat").value;
      if (!body.name.trim()) throw new Error("Le nom est obligatoire.");
      if (!body.unit.trim()) throw new Error("L’unité est obligatoire.");
      await act(() => (x ? api("PUT", col + "/" + x.id, body) : api("POST", col, body)), x ? "Modifications enregistrées." : "Article ajouté.");
    });
  const pu = () => { const u = $("#f-unit").value.trim(); $("#f-pu").textContent = u ? "par " + priceUnit(u) : ""; };
  $("#f-unit").addEventListener("input", pu); pu();
}

// ---------- Dialogue générique ----------
const dlg = $("#dlg"), dlgForm = $("#dlgForm");
let onSave = null;
function openDialog(html, save) { dlgForm.innerHTML = html; onSave = save; dlg.showModal(); const f = dlgForm.querySelector("input,select"); if (f) f.focus(); }
dlgForm.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) dlg.close(); });
dlgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = dlgForm.querySelector('button[value="save"]'); btn.disabled = true;
  try { await onSave(); dlg.close(); }
  catch (err) { const el = $("#f-err"); if (el) el.textContent = err.message; }
  finally { btn.disabled = false; }
});

// ---------- Événements ----------
view.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.shop) {
    const li = t.closest(".item"); li.classList.add("leaving");
    setTimeout(() => act(() => api("PUT", t.dataset.shop + "/" + t.dataset.id, { checked: t.checked })).catch(() => {}), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200);
  } else if (t.dataset.qty) {
    act(() => api("PUT", t.dataset.qty + "/" + t.dataset.id, { qty: t.value }), "Quantité enregistrée.").catch(() => {});
  } else if (t.dataset.note !== undefined) {
    act(() => api("PUT", "dishList/" + t.dataset.note, { note: t.value }), "Note enregistrée.").catch(() => {});
  } else if (t.id === "showHidden") { ui.showHidden = t.checked; render(); }
});
view.addEventListener("input", (e) => {
  if (e.target.id === "dishSearch") { ui.dishQuery = e.target.value; render(); }
  if (e.target.id === "catSearch") { ui.catQuery = e.target.value; render(); }
});
view.addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  try {
    if (d.act === "uncheck") await act(() => api("POST", "uncheck"), "Tous les articles sont de nouveau à acheter.");
    else if (d.act === "generate") {
      if (D.ingredientsToBuy.length && !confirm("Remplacer la liste actuelle des ingrédients à acheter (et vos ajustements) par celle calculée depuis les plats à préparer ?")) return;
      await act(() => api("POST", "generate"), (r) => `${r.count} ingrédients générés depuis ${D.dishList.length} plats.`);
    }
    else if (d.act === "addEntry") await act(() => api("POST", "dishList", { dishId: $("#add-dish").value, note: $("#add-note").value }), "Plat ajouté à la liste.");
    else if (d.addline) {
      const col = d.addline, q = $("#addq-" + col).value;
      if (q === "" || !(Number(q.replace(",", ".")) >= 0)) { toast("Indiquez une quantité.", true); $("#addq-" + col).focus(); return; }
      await act(() => api("POST", col, { [d.ref]: $("#add-" + col).value, qty: q }), "Article ajouté.");
    }
    else if (d.del) await act(() => api("DELETE", d.del + "/" + d.id), (r) => ["Retiré.", ...(r.notes || [])].join(" "));
    else if (d.act === "newDish") dishDialog(null);
    else if (d.dishEdit) dishDialog(byId("dishes", d.dishEdit));
    else if (d.dishHide) { const x = byId("dishes", d.dishHide); await act(() => api("PUT", "dishes/" + x.id, { hidden: !x.hidden }), x.hidden ? "Plat affiché." : "Plat masqué."); }
    else if (d.dishDel) { const x = byId("dishes", d.dishDel); if (confirm(`Supprimer le plat « ${x.name} » ?`)) await act(() => api("DELETE", "dishes/" + x.id), (r) => ["Plat supprimé.", ...(r.notes || [])].join(" ")); }
    else if (d.cattab) { ui.catTab = d.cattab; render(); }
    else if (d.act === "newCat") catDialog(ui.catTab, null);
    else if (d.catEdit) catDialog(ui.catTab, byId(ui.catTab, d.catEdit));
    else if (d.catDel) { const x = byId(ui.catTab, d.catDel); if (confirm(`Supprimer « ${x.name} » du catalogue ?`)) await act(() => api("DELETE", ui.catTab + "/" + x.id), (r) => ["Supprimé.", ...(r.notes || [])].join(" ")); }
    else if (d.act === "reset") { if (confirm("Remettre toutes les données comme au départ ? Vos modifications seront perdues.")) await act(() => api("POST", "reset"), "Données réinitialisées."); }
  } catch { /* message déjà affiché */ }
});

// ---------- Démarrage : lecture du fichier JSON sur GitHub ----------
document.addEventListener("click", (e) => { if (e.target.closest("[data-gh]")) { e.preventDefault(); ghDialog(); } });
(async function start() {
  makeStore();
  if (!store) { view.innerHTML = `<section class="card"><h2>Bienvenue</h2><p class="lead">Indiquez le dépôt GitHub qui contient vos données pour commencer.</p><p><button class="btn primary" data-gh>Connexion GitHub</button></p></section>`; ghDialog(); return; }
  try { await api("GET", "data"); setSync(canWrite() ? "À jour" : "Lecture seule"); render(); }
  catch (e) { view.innerHTML = `<section class="card"><h2>Impossible de charger les données</h2><p class="lead">${esc(e.message)}</p><p><button class="btn primary" data-gh>Connexion GitHub</button> <button class="btn ghost" onclick="location.reload()">Réessayer</button></p></section>`; }
})();
