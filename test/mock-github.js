// Faux GitHub en mémoire pour les tests : refs, contenu, sha, conflits.
const crypto = require("crypto");
function mockGitHub({ token = "secret", owner = "o", repo = "r" } = {}) {
  const st = { branches: { main: "c0" }, files: {}, commits: 0, writes: [] }; // files[branch/path] = {text, sha}
  const sha = (t) => crypto.createHash("sha1").update(t + Math.random()).digest("hex");
  const json = (status, body) => ({ status, json: async () => body });
  async function fetch(url, opts = {}) {
    const u = new URL(url); const m = opts.method || "GET";
    const auth = (opts.headers || {}).Authorization;
    const authed = auth === "Bearer " + token;
    if (auth && !authed) return json(401, { message: "Bad credentials" });
    const p = u.pathname.replace(`/repos/${owner}/${repo}`, "");
    if (m === "GET" && p === "") return json(200, { default_branch: "main" });
    let mm;
    if ((mm = p.match(/^\/git\/ref\/heads\/(.+)$/))) return st.branches[mm[1]] ? json(200, { object: { sha: st.branches[mm[1]] } }) : json(404, { message: "Not Found" });
    if (m === "POST" && p === "/git/refs") { if (!authed) return json(404, {}); const b = JSON.parse(opts.body); st.branches[b.ref.replace("refs/heads/", "")] = b.sha; return json(201, {}); }
    if ((mm = p.match(/^\/contents\/(.+)$/))) {
      const path = decodeURIComponent(mm[1]);
      if (m === "GET") { const br = u.searchParams.get("ref"); const f = st.files[br + "/" + path]; return f ? json(200, { sha: f.sha, encoding: "base64", content: Buffer.from(f.text).toString("base64") }) : json(404, { message: "Not Found" }); }
      if (m === "PUT") {
        if (!authed) return json(404, { message: "Not Found" });
        const b = JSON.parse(opts.body); const key = b.branch + "/" + path; const f = st.files[key];
        if (!st.branches[b.branch]) return json(404, { message: "Branch not found" });
        if (f && b.sha !== f.sha) return json(409, { message: "sha does not match" });
        if (!f && b.sha) return json(409, { message: "sha does not match" });
        const text = Buffer.from(b.content, "base64").toString("utf8"); const s = sha(text);
        st.files[key] = { text, sha: s }; st.commits++; st.writes.push(b.message);
        return json(f ? 200 : 201, { content: { sha: s }, commit: { sha: "k" + st.commits, html_url: "https://github.com/commit/" + st.commits } });
      }
    }
    return json(404, { message: "Not Found " + m + " " + p });
  }
  return { fetch, st, file: (branch = "data", path = "data.json") => JSON.parse(st.files[branch + "/" + path].text) };
}
module.exports = { mockGitHub };
