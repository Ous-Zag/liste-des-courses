// Stockage dans un dépôt GitHub : le fichier JSON est lu et écrit avec l’API « contents » de GitHub.
// Chaque modification relit la dernière version du fichier, applique le changement, puis l’enregistre
// par un commit. Si quelqu’un d’autre a enregistré entre-temps (conflit), on recommence avec sa version.
(function (root) {
"use strict";
const API = "https://api.github.com";

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
class StoreError extends Error { constructor(message, status) { super(message); this.status = status; } }

function GitHubStore(cfg, opts = {}) {
  const fetchFn = opts.fetch || ((...a) => fetch(...a));
  const seedLoader = opts.seed; // () => Promise<objet de départ>
  const c = { branch: "data", path: "data.json", ...cfg };
  const base = `${c.api || API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
  const headers = (json) => {
    const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (c.token) h.Authorization = "Bearer " + c.token;
    if (json) h["Content-Type"] = "application/json";
    return h;
  };
  async function gh(method, url, body) {
    let res;
    try { res = await fetchFn(base + url, { method, headers: headers(!!body), body: body ? JSON.stringify(body) : undefined, cache: "no-store" }); }
    catch { throw new StoreError("GitHub est injoignable. Vérifiez la connexion Internet.", 0); }
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json, res };
  }
  function explain(status, json, what) {
    const msg = json && json.message ? json.message : "";
    if (status === 401) return new StoreError("Jeton GitHub refusé (invalide ou expiré). Ouvrez « Connexion GitHub » pour le remplacer.", 401);
    if (status === 403 && /rate limit/i.test(msg)) return new StoreError("Limite de requêtes GitHub atteinte. Connectez un jeton, ou réessayez dans quelques minutes.", 403);
    if (status === 403) return new StoreError("Ce jeton n’a pas le droit d’écrire dans le dépôt. Il lui faut la permission « Contents : Read and write ».", 403);
    if (status === 404) return new StoreError(`Introuvable sur GitHub : ${what}. Vérifiez le propriétaire, le dépôt et le jeton.`, 404);
    return new StoreError(`Erreur GitHub ${status}${msg ? " : " + msg : ""}.`, status);
  }
  const contentsUrl = () => `/contents/${c.path.split("/").map(encodeURIComponent).join("/")}`;

  async function readRaw() {
    const r = await gh("GET", `${contentsUrl()}?ref=${encodeURIComponent(c.branch)}`);
    if (r.status === 200 && r.json && r.json.content !== undefined) {
      let text;
      if (r.json.encoding === "base64" && r.json.content) text = b64decode(r.json.content);
      else { // fichier de plus de 1 Mo : on passe par le blob
        const blob = await gh("GET", `/git/blobs/${r.json.sha}`);
        if (blob.status !== 200) throw explain(blob.status, blob.json, "le fichier de données");
        text = b64decode(blob.json.content);
      }
      return { data: JSON.parse(text), sha: r.json.sha };
    }
    if (r.status === 404) return null;
    throw explain(r.status, r.json, `${c.owner}/${c.repo}`);
  }
  async function ensureBranch() {
    const ref = await gh("GET", `/git/ref/heads/${encodeURIComponent(c.branch)}`);
    if (ref.status === 200) return;
    if (ref.status !== 404) throw explain(ref.status, ref.json, `la branche ${c.branch}`);
    const repo = await gh("GET", "");
    if (repo.status !== 200) throw explain(repo.status, repo.json, `le dépôt ${c.owner}/${c.repo}`);
    const main = await gh("GET", `/git/ref/heads/${encodeURIComponent(repo.json.default_branch)}`);
    if (main.status !== 200) throw explain(main.status, main.json, "la branche principale");
    const mk = await gh("POST", "/git/refs", { ref: "refs/heads/" + c.branch, sha: main.json.object.sha });
    if (mk.status !== 201 && mk.status !== 422) throw explain(mk.status, mk.json, `la branche ${c.branch}`);
  }
  async function write(data, sha, message) {
    data.updatedAt = new Date().toISOString();
    const body = { message: message || "Mise à jour des données", content: b64encode(JSON.stringify(data, null, 1) + "\n"), branch: c.branch };
    if (sha) body.sha = sha;
    const r = await gh("PUT", contentsUrl(), body);
    if (r.status === 200 || r.status === 201) return { sha: r.json.content.sha, commit: r.json.commit };
    if (r.status === 409 || (r.status === 422 && /sha/i.test((r.json && r.json.message) || ""))) return { conflict: true };
    throw explain(r.status, r.json, "le fichier de données");
  }

  return {
    config: c,
    canWrite: () => !!c.token,
    // Lecture : relit toujours le fichier sur GitHub. Crée la branche et le fichier au premier usage.
    async read() {
      const got = await readRaw();
      if (got) return got;
      if (!c.token) throw new StoreError(`Aucun fichier ${c.path} sur la branche « ${c.branch} ». Connectez un jeton GitHub pour le créer.`, 404);
      await ensureBranch();
      const seed = seedLoader ? await seedLoader() : {};
      const w = await write(seed, null, "Création du fichier de données");
      if (w.conflict) return readRaw();
      return { data: seed, sha: w.sha, created: true, commit: w.commit };
    },
    // Écriture : lire, modifier, enregistrer ; recommence en cas de conflit.
    async mutate(fn, message) {
      if (!c.token) throw new StoreError("Lecture seule : connectez un jeton GitHub pour enregistrer des modifications.", 401);
      for (let attempt = 1; attempt <= 4; attempt++) {
        const { data, sha } = await this.read();
        const msg = typeof message === "function" ? message(data) : message; // avant la modification, pour garder les noms
        const result = fn(data);
        const w = await write(data, sha, msg);
        if (!w.conflict) return { result, data, commit: w.commit };
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
      throw new StoreError("Le fichier a été modifié plusieurs fois en même temps. Réessayez.", 409);
    },
    historyUrl: () => `https://github.com/${c.owner}/${c.repo}/commits/${c.branch}/${c.path}`,
  };
}
const api = { GitHubStore, StoreError, b64encode, b64decode };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Store = api;
})(typeof window !== "undefined" ? window : globalThis);
