// Règles métier de la liste de courses (catalogues, plats, listes à acheter).
// Ce module ne fait aucune lecture ni écriture : il modifie l’objet de données qu’on lui donne.
// Il tourne dans le navigateur (window.Core) et dans Node pour les tests (module.exports).
(function (root) {
"use strict";
const EMPTY = { version: 1, updatedAt: null, ingredients: [], dairy: [], hygiene: [], dishes: [], dishList: [], ingredientsToBuy: [], dairyToBuy: [], hygieneToBuy: [], shoppingList: [] };
function normalize(data) {
  for (const k of Object.keys(EMPTY)) if (data[k] === undefined) data[k] = Array.isArray(EMPTY[k]) ? [] : EMPTY[k];
  return data;
}
// ---------- Validation ----------
class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
const newId = (p) => p + "-" + ((globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10));
const str = (v) => (typeof v === "string" ? v.trim() : "");
function num(v, field, { min = 0, allowNull = false, strict = false } = {}) {
  if ((v === null || v === "" || v === undefined) && allowNull) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < min || (strict && n === min)) throw new AppError(400, `Valeur invalide pour « ${field} ».`);
  return Math.round(n * 1000) / 1000;
}
const same = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;

const CATALOGS = {
  ingredients: { prefix: "ing", label: "ingrédient", toBuy: "ingredientsToBuy", ref: "ingredientId" },
  dairy: { prefix: "lait", label: "produit laitier", toBuy: "dairyToBuy", ref: "dairyId" },
  hygiene: { prefix: "hyg", label: "produit d’hygiène", toBuy: "hygieneToBuy", ref: "hygieneId" },
};
const TOBUY = {
  ingredientsToBuy: { prefix: "ia", ref: "ingredientId", catalog: "ingredients" },
  dairyToBuy: { prefix: "la", ref: "dairyId", catalog: "dairy" },
  hygieneToBuy: { prefix: "ha", ref: "hygieneId", catalog: "hygiene" },
};

function catalogItem(data, col, body, existing) {
  const c = CATALOGS[col];
  const prev = existing || {};
  const name = body.name !== undefined ? str(body.name) : prev.name || "";
  const unit = body.unit !== undefined ? str(body.unit) : prev.unit || "";
  if (!name) throw new AppError(400, "Le nom est obligatoire.");
  if (!unit) throw new AppError(400, "L’unité est obligatoire.");
  const dup = data[col].find((x) => same(x.name, name) && (!existing || x.id !== existing.id));
  if (dup) throw new AppError(409, `Un ${c.label} nommé « ${dup.name} » existe déjà.`);
  return {
    id: existing ? existing.id : newId(c.prefix),
    name, unit,
    category: body.category !== undefined ? str(body.category) : (existing && existing.category) || "",
    ar: body.ar !== undefined ? str(body.ar) : (existing && existing.ar) || "",
    price: body.price !== undefined ? num(body.price, "prix", { allowNull: true }) : existing ? existing.price ?? null : null,
  };
}
function dishItem(data, body, existing) {
  const name = body.name !== undefined ? str(body.name) : (existing && existing.name) || "";
  if (!name) throw new AppError(400, "Le nom du plat est obligatoire.");
  const dup = data.dishes.find((x) => same(x.name, name) && (!existing || x.id !== existing.id));
  if (dup) throw new AppError(409, `Un plat nommé « ${dup.name} » existe déjà.`);
  let ingredients = existing ? existing.ingredients : [];
  if (body.ingredients !== undefined) {
    if (!Array.isArray(body.ingredients)) throw new AppError(400, "La liste des ingrédients est invalide.");
    const seen = new Set();
    ingredients = body.ingredients.map((x) => {
      const ing = data.ingredients.find((i) => i.id === x.ingredientId);
      if (!ing) throw new AppError(400, "Un ingrédient choisi n’existe plus dans le catalogue.");
      if (seen.has(ing.id)) throw new AppError(400, `« ${ing.name} » apparaît deux fois dans le plat.`);
      seen.add(ing.id);
      return { ingredientId: ing.id, qty: num(x.qty, "quantité de " + ing.name, { strict: true }) };
    });
  }
  return { id: existing ? existing.id : newId("plat"), name, hidden: body.hidden !== undefined ? !!body.hidden : !!(existing && existing.hidden), ingredients };
}

// ---------- Opérations ----------
function create(data, col, body) {
  if (CATALOGS[col]) { const it = catalogItem(data, col, body); data[col].push(it); return it; }
  if (col === "dishes") { const it = dishItem(data, body); data.dishes.push(it); return it; }
  if (col === "dishList") {
    const dish = data.dishes.find((d) => d.id === body.dishId);
    if (!dish) throw new AppError(400, "Ce plat n’existe pas.");
    if (dish.hidden) throw new AppError(400, `Le plat « ${dish.name} » est masqué : affichez-le d’abord.`);
    const it = { id: newId("pl"), dishId: dish.id, note: str(body.note) };
    data.dishList.push(it); return it;
  }
  if (TOBUY[col]) {
    const t = TOBUY[col];
    const ref = data[t.catalog].find((x) => x.id === body[t.ref]);
    if (!ref) throw new AppError(400, "Cet article n’existe pas dans le catalogue.");
    const qty = num(body.qty, "quantité");
    const line = data[col].find((x) => x[t.ref] === ref.id);
    if (line) { line.qty = Math.round((line.qty + qty) * 1000) / 1000; return line; } // déjà présent : on additionne
    const it = { id: newId(t.prefix), [t.ref]: ref.id, qty, checked: false };
    data[col].push(it); return it;
  }
  throw new AppError(404, "Collection inconnue.");
}
function update(data, col, id, body) {
  const list = data[col];
  if (!Array.isArray(list)) throw new AppError(404, "Collection inconnue.");
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new AppError(404, "Élément introuvable.");
  if (CATALOGS[col]) return (list[i] = catalogItem(data, col, body, list[i]));
  if (col === "dishes") return (list[i] = dishItem(data, body, list[i]));
  if (col === "dishList") { if (body.note !== undefined) list[i].note = str(body.note); return list[i]; }
  if (col === "shoppingList") { if (body.checked !== undefined) list[i].checked = !!body.checked; return list[i]; }
  if (TOBUY[col]) {
    if (body.qty !== undefined) list[i].qty = num(body.qty, "quantité");
    if (body.checked !== undefined) list[i].checked = !!body.checked;
    return list[i];
  }
  throw new AppError(404, "Collection inconnue.");
}
function remove(data, col, id) {
  const list = data[col];
  if (!Array.isArray(list)) throw new AppError(404, "Collection inconnue.");
  const item = list.find((x) => x.id === id);
  if (!item) throw new AppError(404, "Élément introuvable.");
  const notes = [];
  if (col === "ingredients") {
    const users = data.dishes.filter((d) => d.ingredients.some((x) => x.ingredientId === id)).map((d) => d.name);
    if (users.length) throw new AppError(409, `Impossible de supprimer « ${item.name} » : il est utilisé dans ${users.length > 1 ? "les plats" : "le plat"} ${users.map((n) => "« " + n + " »").join(", ")}.`);
    const before = data.ingredientsToBuy.length;
    data.ingredientsToBuy = data.ingredientsToBuy.filter((x) => x.ingredientId !== id);
    if (data.ingredientsToBuy.length < before) notes.push("Il a aussi été retiré des ingrédients à acheter.");
  }
  if (col === "dairy" || col === "hygiene") {
    const c = CATALOGS[col];
    if (data[c.toBuy].some((x) => x[c.ref] === id))
      throw new AppError(409, `Impossible de supprimer « ${item.name} » : il est dans la liste ${col === "dairy" ? "des produits laitiers" : "des produits d’hygiène"} à acheter. Retirez-le d’abord de cette liste.`);
  }
  if (col === "dishes") {
    const n = data.dishList.filter((x) => x.dishId === id).length;
    data.dishList = data.dishList.filter((x) => x.dishId !== id);
    if (n) notes.push(`Il a aussi été retiré ${n} fois de la liste des plats.`);
  }
  if (CATALOGS[col]) {
    const before = data.shoppingList.length;
    data.shoppingList = data.shoppingList.filter((l) => !(l.source === col && l.refId === id));
    if (data.shoppingList.length < before) notes.push("Il a aussi été retiré de la liste de courses.");
  }
  data[col] = data[col].filter((x) => x.id !== id);
  return { deleted: id, notes };
}
function generate(data) {
  const totals = new Map();
  for (const entry of data.dishList) {
    const dish = data.dishes.find((d) => d.id === entry.dishId);
    if (!dish) continue;
    for (const x of dish.ingredients) totals.set(x.ingredientId, Math.round(((totals.get(x.ingredientId) || 0) + x.qty) * 1000) / 1000);
  }
  const order = data.ingredients.map((i) => i.id).filter((id) => totals.has(id));
  data.ingredientsToBuy = order.map((id) => ({ id: newId("ia"), ingredientId: id, qty: totals.get(id), checked: false }));
  return { count: data.ingredientsToBuy.length };
}


// Liste de courses : générée à partir des trois listes « À acheter ».
// Les articles déjà cochés (dans le panier) le restent après une nouvelle génération.
const SOURCES = { ingredients: { toBuy: "ingredientsToBuy", ref: "ingredientId" }, dairy: { toBuy: "dairyToBuy", ref: "dairyId" }, hygiene: { toBuy: "hygieneToBuy", ref: "hygieneId" } };
function generateShopping(data) {
  const prev = new Map(data.shoppingList.map((l) => [l.source + "|" + l.refId, l]));
  const out = [];
  for (const [source, s] of Object.entries(SOURCES)) {
    for (const line of data[s.toBuy]) {
      if (!(line.qty > 0) || !data[source].some((x) => x.id === line[s.ref])) continue;
      const old = prev.get(source + "|" + line[s.ref]);
      out.push({ id: old ? old.id : newId("lc"), source, refId: line[s.ref], qty: line.qty, checked: !!(old && old.checked) });
    }
  }
  data.shoppingList = out;
  return { count: out.length, kept: out.filter((l) => l.checked).length };
}

// Une opération = { method, url, body }, comme une requête d’API.
function route(data, method, url, body = {}) {
  normalize(data);
  const [col, id] = url.split("/").filter(Boolean);
  if (method === "POST" && col === "generate") return generate(data);
  if (method === "POST" && col === "generateShopping") return generateShopping(data);
  if (method === "POST" && col === "uncheck") { for (const k of [...Object.keys(TOBUY), "shoppingList"]) data[k].forEach((x) => (x.checked = false)); return {}; }
  if (method === "POST" && col === "reset") { const seed = body.seed; if (!seed) throw new AppError(400, "Données de départ manquantes."); Object.keys(data).forEach((k) => delete data[k]); Object.assign(data, JSON.parse(JSON.stringify(seed))); return {}; }
  if (method === "POST" && col && !id) return create(data, col, body);
  if (method === "PUT" && col && id) return update(data, col, id, body);
  if (method === "DELETE" && col && id) return remove(data, col, id);
  throw new AppError(404, "Opération inconnue.");
}
const LABELS = { ingredients: "ingrédient", dairy: "produit laitier", hygiene: "produit d’hygiène", dishes: "plat", dishList: "plat à préparer", ingredientsToBuy: "ingrédient à acheter", dairyToBuy: "produit laitier à acheter", hygieneToBuy: "produit d’hygiène à acheter", shoppingList: "liste de courses" };
function describe(data, method, url, body = {}) {
  const [col, id] = url.split("/").filter(Boolean);
  if (col === "generate") return "Générer les ingrédients à acheter";
  if (col === "generateShopping") return "Générer la liste de courses";
  if (col === "uncheck") return "Tout décocher";
  if (col === "reset") return "Réinitialiser les données";
  const item = id && Array.isArray(data[col]) ? data[col].find((x) => x.id === id) : null;
  let name = body.name || (item && item.name) || "";
  if (!name && TOBUY[col]) { const t = TOBUY[col]; const ref = data[t.catalog].find((x) => x.id === (item ? item[t.ref] : body[t.ref])); name = ref ? ref.name : ""; }
  if (!name && col === "shoppingList" && item) { const ref = (data[item.source] || []).find((x) => x.id === item.refId); name = ref ? ref.name : ""; }
  if (!name && col === "dishList") { const d = data.dishes.find((x) => x.id === (item ? item.dishId : body.dishId)); name = d ? d.name : ""; }
  const verb = method === "POST" ? "Ajout" : method === "PUT" ? (body.checked !== undefined ? (body.checked ? "Coché" : "Décoché") : "Modification") : "Suppression";
  return `${verb} : ${LABELS[col] || col}${name ? " « " + name + " »" : ""}`;
}
const api = { route, describe, normalize, AppError, EMPTY, SOURCES };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== "undefined" ? window : globalThis);
