// node test/run.js – teste les règles métier (core.js) et le stockage GitHub (store.js) avec un faux GitHub.
const assert = require("assert");
const fs = require("fs"), path = require("path");
globalThis.atob ||= (b) => Buffer.from(b, "base64").toString("binary");
globalThis.btoa ||= (s) => Buffer.from(s, "binary").toString("base64");
const Core = require("../core.js");
const { GitHubStore, b64encode, b64decode } = require("../store.js");
const { mockGitHub } = require("./mock-github.js");
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "seed.json"), "utf8"));
const ok = (n) => console.log("  ok –", n);

(async () => {
  try {
    assert.equal(b64decode(b64encode("Œufs « tounsi » عظم")), "Œufs « tounsi » عظم"); ok("encodage UTF-8 (français et arabe)");
    const gh = mockGitHub();
    const ro = GitHubStore({ owner: "o", repo: "r" }, { fetch: gh.fetch, seed: async () => seed });
    await assert.rejects(ro.read(), /Connectez un jeton/); ok("sans jeton et sans fichier : message clair");
    const s = GitHubStore({ owner: "o", repo: "r", token: "secret" }, { fetch: gh.fetch, seed: async () => JSON.parse(JSON.stringify(seed)) });
    let r = await s.read(); assert.ok(r.created); assert.ok(gh.st.branches.data); assert.equal(gh.file().ingredients.length, seed.ingredients.length); ok("premier usage : branche « data » et data.json créés depuis seed.json");
    r = await ro.read(); assert.equal(r.data.dishes.length, seed.dishes.length); ok("lecture seule possible sans jeton");
    await assert.rejects(ro.mutate((d) => d), /Lecture seule/); ok("écriture refusée sans jeton");
    const bad = GitHubStore({ owner: "o", repo: "r", token: "faux" }, { fetch: gh.fetch });
    await assert.rejects(bad.read(), /Jeton GitHub refusé/); ok("jeton invalide : message clair");

    const op = (m, u, b) => s.mutate((d) => Core.route(d, m, u, b), (d) => Core.describe(d, m, u, b));
    let x = await op("POST", "ingredients", { name: "Safran", unit: "g", price: 900 }); const saf = x.result;
    assert.ok(gh.file().ingredients.some((i) => i.id === saf.id)); assert.equal(gh.st.writes.at(-1), "Ajout : ingrédient « Safran »"); ok("chaque ajout = un commit dans data.json (« " + gh.st.writes.at(-1) + " »)");
    await assert.rejects(op("POST", "ingredients", { name: "safran", unit: "g" }), /existe déjà/); ok("doublon refusé, rien n’est écrit");
    const dish = (await op("POST", "dishes", { name: "Riz au safran", ingredients: [{ ingredientId: saf.id, qty: 1 }] })).result;
    await assert.rejects(op("DELETE", "ingredients/" + saf.id), /utilisé dans le plat « Riz au safran »/); ok("suppression d’un ingrédient utilisé : bloquée, plat nommé");
    await op("PUT", "dishes/" + dish.id, { hidden: true });
    await assert.rejects(op("POST", "dishList", { dishId: dish.id }), /masqué/); ok("plat masqué non proposé");
    await op("PUT", "dishes/" + dish.id, { hidden: false });
    await op("POST", "dishList", { dishId: dish.id }); await op("POST", "dishList", { dishId: dish.id });
    await op("POST", "generate"); assert.equal(gh.file().ingredientsToBuy.find((l) => l.ingredientId === saf.id).qty, 2); ok("générer additionne les quantités");
    x = await op("DELETE", "dishes/" + dish.id); assert.ok(gh.file().dishList.every((e) => e.dishId !== dish.id)); assert.equal(gh.st.writes.at(-1), "Suppression : plat « Riz au safran »"); ok("message de commit garde le nom à la suppression");

    // conflit : deux appareils écrivent en même temps
    const s2 = GitHubStore({ owner: "o", repo: "r", token: "secret" }, { fetch: gh.fetch });
    const before = gh.file().hygiene.length;
    await Promise.all([
      s.mutate((d) => Core.route(d, "POST", "hygiene", { name: "Appareil A", unit: "pièce" })),
      s2.mutate((d) => Core.route(d, "POST", "hygiene", { name: "Appareil B", unit: "pièce" })),
    ]);
    assert.equal(gh.file().hygiene.length, before + 2); ok("deux appareils en même temps : conflit détecté, aucune modification perdue");
    // Liste de courses générée depuis « À acheter »
    let f = gh.file();
    await op("POST", "generateShopping");
    f = gh.file(); const nBuy = f.ingredientsToBuy.filter((l) => l.qty > 0).length + f.dairyToBuy.filter((l) => l.qty > 0).length + f.hygieneToBuy.filter((l) => l.qty > 0).length;
    assert.equal(f.shoppingList.length, nBuy); ok(`liste de courses générée depuis « À acheter » (${nBuy} articles)`);
    const first = f.shoppingList[0];
    await op("PUT", "shoppingList/" + first.id, { checked: true });
    const dl = f.dairyToBuy[0]; await op("DELETE", "dairyToBuy/" + dl.id);
    assert.ok(gh.file().shoppingList.some((l) => l.refId === dl.dairyId)); ok("modifier « À acheter » ne change pas la liste de courses avant régénération");
    x = await op("POST", "generateShopping"); f = gh.file();
    assert.ok(f.shoppingList.find((l) => l.id === first.id).checked); assert.ok(!f.shoppingList.some((l) => l.refId === dl.dairyId)); ok("régénérer garde les articles cochés et retire ceux enlevés de « À acheter »");
    const hl = f.shoppingList.find((l) => l.source === "hygiene"); const hline = f.hygieneToBuy.find((l) => l.hygieneId === hl.refId);
    await op("DELETE", "hygieneToBuy/" + hline.id); x = await op("DELETE", "hygiene/" + hl.refId);
    assert.ok(!gh.file().shoppingList.some((l) => l.refId === hl.refId)); ok("supprimer un produit du catalogue le retire aussi de la liste de courses");
    await op("POST", "uncheck"); assert.ok(gh.file().shoppingList.every((l) => !l.checked)); ok("tout décocher dans la liste de courses");
    await op("POST", "reset", { seed }); assert.equal(gh.file().hygiene.length, seed.hygiene.length); ok("réinitialisation");
    console.log(`\nTous les tests sont passés (${gh.st.commits} commits simulés).`);
  } catch (e) { console.error("\nÉCHEC :", e); process.exitCode = 1; }
})();
