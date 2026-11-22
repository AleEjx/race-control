const { GUILD, GATE_ROLE, DEV_ID, issue } = require("./_lib");

// POST { code, redirectUri } -> { token, user }
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const { code, redirectUri } = req.body || {};
  const allowed = process.env.BOTMASTER_REDIRECT || "https://race-control-one.vercel.app/botmaster";
  if (!code || redirectUri !== allowed) return res.status(400).json({ error: "Bad login request." });
  try {
    const t = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "1467595519718195473",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code", code, redirect_uri: redirectUri,
      }),
    });
    const tok = await t.json();
    if (!t.ok) return res.status(400).json({ error: "Discord rejected the login. Try again." });

    // Roles come straight from Discord using the user's own token, so this works even when the bot is offline.
    const m = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GUILD}/member`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!m.ok) return res.status(403).json({ error: "Could not read your roles. Make sure you are in the RaceLeague server." });
    const member = await m.json();
    const user = member.user;
    if (!member.roles.includes(GATE_ROLE) && user.id !== DEV_ID) return res.status(403).json({ error: "You don't have the Botmaster role." });

    res.json({ token: issue(user), user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
