const { GUILD, TYPEKEYS, verify, audit, readCfg, writeCfg, ptero, discord } = require("./_lib");

const ID = /^\d{17,20}$/, HEX = /^#[0-9a-fA-F]{6}$/, HTTPS = /^https:\/\/\S+$/;
const FEATURES = ["AI_ENABLED", "MESSAGE_BATCHING", "SPAM_DETECTION", "COMMUNITY_DB", "NOTES_SUMMARY", "TICKETS_ENABLED", "AI_CHANNEL_TOOLS"];
const bad = (m) => { throw Object.assign(new Error(m), { status: 400 }); };

function validate(c) {
  const out = {};
  if (c.staffRoles) {
    out.staffRoles = {};
    for (const k of TYPEKEYS) {
      if (c.staffRoles[k] === undefined) continue;
      const a = [].concat(c.staffRoles[k]).map(String);
      if (!a.length || !a.every((x) => ID.test(x))) bad(`Staff role for ${k} isn't a valid role ID.`);
      out.staffRoles[k] = a;
    }
  }
  if (c.categories) {
    out.categories = {};
    for (const k of TYPEKEYS) if (c.categories[k] !== undefined) { if (!ID.test(String(c.categories[k]))) bad(`Category for ${k} isn't a valid ID.`); out.categories[k] = String(c.categories[k]); }
  }
  if (c.channelPrefixes) {
    out.channelPrefixes = {};
    for (const k of TYPEKEYS) if (c.channelPrefixes[k] !== undefined) { if (!/^[a-z0-9-]{1,20}$/.test(c.channelPrefixes[k])) bad(`Channel name prefix for ${k}: use 1–20 lowercase letters, numbers or dashes.`); out.channelPrefixes[k] = c.channelPrefixes[k]; }
  }
  if (c.logChannelId !== undefined) { if (!ID.test(String(c.logChannelId))) bad("Log channel isn't a valid ID."); out.logChannelId = String(c.logChannelId); }
  if (c.features) { out.features = {}; for (const k of FEATURES) if (c.features[k] !== undefined) out.features[k] = !!c.features[k]; }
  if (c.panel) {
    const p = c.panel, q = {};
    if (!HEX.test(p.color)) bad("Panel colour must look like #db85c5.");
    q.color = p.color;
    for (const [k, max] of [["title", 256], ["description", 4096], ["placeholder", 150]]) { const v = String(p[k] ?? ""); if (v.length > max) bad(`Panel ${k} is too long (max ${max}).`); q[k] = v; }
    for (const k of ["bannerImage", "image"]) { const v = String(p[k] || "").trim(); if (v && !HTTPS.test(v)) bad("Image links must start with https://"); q[k] = v; }
    q.fields = (p.fields || []).slice(0, 5).map((f, i) => { const v = String(f.value || "").trim(); if (!v || v.length > 1024) bad(`Column ${i + 1} needs 1–1024 characters.`); return { value: v, inline: !!f.inline }; });
    q.options = (p.options || []).slice(0, 25).map((o) => {
      if (!TYPEKEYS.includes(o.value)) bad("Unknown ticket type in the dropdown.");
      const label = String(o.label || "").trim(), description = String(o.description || "").trim(), emoji = String(o.emoji || "").trim();
      if (!label || label.length > 100 || description.length > 100 || emoji.length > 80) bad(`Dropdown entry "${o.value}": label 1–100 chars, description up to 100.`);
      return { value: o.value, label, description, emoji, enabled: o.enabled !== false };
    });
    if (!q.options.some((o) => o.enabled)) bad("Keep at least one ticket type in the dropdown.");
    out.panel = q;
  }
  return out;
}

async function guildLists() {
  if (!process.env.DISCORD_BOT_TOKEN) return {};
  const [r, c] = await Promise.all([discord(`/guilds/${GUILD}/roles`), discord(`/guilds/${GUILD}/channels`)]);
  const roles = r.ok ? (await r.json()).filter((x) => x.id !== GUILD && !x.managed).sort((a, b) => b.position - a.position).map((x) => ({ id: x.id, name: x.name })) : null;
  const ch = c.ok ? await c.json() : [];
  const list = (t) => ch.filter((x) => x.type === t).sort((a, b) => a.position - b.position).map((x) => ({ id: x.id, name: (t === 0 ? "#" : "") + x.name }));
  return { roles, categories: c.ok ? list(4) : null, channels: c.ok ? list(0) : null };
}

module.exports = async (req, res) => {
  const user = verify(req);
  if (!user) return res.status(401).json({ error: "Session expired. Log in again." });
  try {
    if (req.method === "GET") return res.json({ config: await readCfg(), ...(await guildLists()) });
    if (req.method === "POST") {
      const incoming = validate((req.body || {}).config || {});
      const cfg = await readCfg(), changed = [];
      for (const [k, v] of Object.entries(incoming)) {
        const next = k === "panel" || typeof v !== "object" || Array.isArray(v) ? v : { ...(cfg[k] || {}), ...v };
        if (JSON.stringify(next) !== JSON.stringify(cfg[k])) { cfg[k] = next; changed.push(k); }
      }
      if (!changed.length) return res.json({ ok: true, changed: 0 });
      const w = await writeCfg(cfg);
      if (!w.ok) return res.status(502).json({ error: `Couldn't write the config file (panel returned ${w.status}).` });
      await audit(user, "changed ticket settings: " + changed.join(", "));
      return res.json({ ok: true, changed: changed.length });
    }
    res.status(405).end();
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
};
