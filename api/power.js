const { verify, ptero, audit } = require("./_lib");

// GET -> { state }   POST { action: "start" | "restart" }
module.exports = async (req, res) => {
  const user = verify(req);
  if (!user) return res.status(401).json({ error: "Session expired. Log in again." });
  try {
    if (req.method === "GET") {
      const r = await ptero("/resources");
      if (!r.ok) return res.status(502).json({ error: `Panel returned ${r.status}.` });
      return res.json({ state: (await r.json()).attributes.current_state });
    }
    if (req.method === "POST") {
      const action = (req.body || {}).action;
      if (!["start", "restart"].includes(action)) return res.status(400).json({ error: "Unknown action." });
      const r = await ptero("/power", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signal: action }) });
      if (!r.ok) return res.status(502).json({ error: `Panel refused the ${action} (status ${r.status}).` });
      await audit(user, `pressed **${action}** on the bot.`);
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
};
