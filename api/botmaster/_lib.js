// Shared helpers for /api/botmaster/*  (underscore prefix = not exposed as a route)
const crypto = require("crypto");

const GUILD     = "1464788232263700687";
const GATE_ROLE = "1464966733554126959";   // role that unlocks /botmaster
const DEV_ID    = "790254318389166111";    // always allowed
const LOG_CHANNEL = "1465105099113107631";

// Must mirror DEFAULT_STAFF_ROLES in ticketModule.js
const TYPES = [
  { key: "committee",      label: "Committee",         def: "1487493211952910406" },
  { key: "moderation",     label: "Moderation",        def: "1464789545580232950" },
  { key: "juniormgmt",     label: "Junior management", def: "1487493211952910406" },
  { key: "publicsessions", label: "Public sessions",   def: "1564433474780274788" },
  { key: "stewardappeals", label: "Steward appeals",   def: "1510621069864603718" },
];

const sign = (p) => crypto.createHmac("sha256", process.env.BOTMASTER_SESSION_SECRET || "").update(p).digest("base64url");

function issue(user) {
  const p = Buffer.from(JSON.stringify({ id: user.id, name: user.username, exp: Date.now() + 4 * 3600e3 })).toString("base64url");
  return p + "." + sign(p);
}

function verify(req) {
  try {
    if (!process.env.BOTMASTER_SESSION_SECRET) return null;
    const h = req.headers.authorization || "";
    const [p, s] = (h.startsWith("Bearer ") ? h.slice(7) : "").split(".");
    if (!p || !s) return null;
    const good = sign(p);
    if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

// Pterodactyl client API (OriHost panel). Key stays server-side.
function ptero(path, opts = {}) {
  const base = (process.env.PTERO_URL || "").replace(/\/$/, "");
  return fetch(`${base}/api/client/servers/${process.env.PTERO_SERVER_ID}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.PTERO_API_KEY}`, Accept: "Application/vnd.pterodactyl.v1+json", ...(opts.headers || {}) },
  });
}

// Best-effort audit line in your log channel (needs DISCORD_BOT_TOKEN)
async function audit(user, text) {
  if (!process.env.DISCORD_BOT_TOKEN) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${LOG_CHANNEL}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**Botmaster:** <@${user.id}> ${text}`, allowed_mentions: { parse: [] } }),
    });
  } catch {}
}

module.exports = { GUILD, GATE_ROLE, DEV_ID, TYPES, issue, verify, ptero, audit };
