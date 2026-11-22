const { GUILD, TYPES, verify, ptero, audit } = require("./_lib");

const FILE = encodeURIComponent("/database/ticketConfig.json");   // /home/container/database/ticketConfig.json
const ID = /^\d{17,20}$/;

async function readCfg() {
  const r = await ptero(`/files/contents?file=${FILE}`);
  if (!r.ok) return {};
  try { return JSON.parse(await r.text()); } catch { return {}; }
}

async function guildRoles() {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) return null;
  const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD}/roles`, { headers: { Authorization: `Bot ${t}` } });
  if (!r.ok) return null;
  return (await r.json()).filter((x) => x.id !== GUILD && !x.managed).sort((a, b) => b.position - a.position).map((x) => ({ id: x.id, name: x.name }));
}

module.exports = async (req, res) => {
  const user = verify(req);
  if (!user) return res.status(401).json({ error: "Session expired. Log in again." });
  try {
    if (req.method === "GET") {
      const [cfg, roles] = await Promise.all([readCfg(), guildRoles()]);
      const saved = cfg.staffRoles || {};
      return res.json({ roles, types: TYPES.map((t) => ({ key: t.key, label: t.label, roleId: (saved[t.key] && saved[t.key][0]) || t.def })) });
    }
    if (req.method === "POST") {
      const incoming = (req.body || {}).staffRoles || {};
      const cfg = await readCfg();
      cfg.staffRoles = cfg.staffRoles || {};
      const changes = [];
      for (const t of TYPES) {
        const id = incoming[t.key];
        if (id === undefined) continue;
        if (!ID.test(String(id))) return res.status(400).json({ error: `${t.label}: that isn't a valid role ID.` });
        const old = (cfg.staffRoles[t.key] && cfg.staffRoles[t.key][0]) || t.def;
        if (String(id) !== old) { cfg.staffRoles[t.key] = [String(id)]; changes.push(`${t.label}: <@&${old}> → <@&${id}>`); }
      }
      if (!changes.length) return res.json({ ok: true, changed: 0 });
      const w = await ptero(`/files/write?file=${FILE}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(cfg, null, 2) });
      if (!w.ok) return res.status(502).json({ error: `Couldn't write the config file (panel returned ${w.status}).` });
      await audit(user, "changed ticket staff roles:\n" + changes.join("\n"));
      return res.json({ ok: true, changed: changes.length });
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
};
