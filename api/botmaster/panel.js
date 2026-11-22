const { verify, audit, readCfg, writeCfg, discord, panelToPayload } = require("./_lib");

// POST { channelId } -> posts the saved ticket panel there, or edits the one it posted before
module.exports = async (req, res) => {
  const user = verify(req);
  if (!user) return res.status(401).json({ error: "Session expired. Log in again." });
  if (req.method !== "POST") return res.status(405).end();
  try {
    if (!process.env.DISCORD_BOT_TOKEN) return res.status(400).json({ error: "Add DISCORD_BOT_TOKEN in Vercel to post the panel." });
    const channelId = String((req.body || {}).channelId || "");
    if (!/^\d{17,20}$/.test(channelId)) return res.status(400).json({ error: "Pick a channel first." });
    const cfg = await readCfg();
    if (!cfg.panel) return res.status(400).json({ error: "No panel settings yet. Restart the bot once so it can load them." });
    const payload = panelToPayload(cfg.panel), prev = cfg.panelMessage;
    let r, edited = false;
    if (prev && prev.channelId === channelId) { r = await discord(`/channels/${channelId}/messages/${prev.messageId}`, { method: "PATCH", body: JSON.stringify(payload) }); edited = r.ok; }
    if (!edited) r = await discord(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: `Discord refused the panel: ${d.message || r.status}` });
    cfg.panelMessage = { channelId, messageId: d.id };
    await writeCfg(cfg);
    await audit(user, `${edited ? "updated" : "posted"} the ticket panel in <#${channelId}>.`);
    res.json({ ok: true, edited });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
