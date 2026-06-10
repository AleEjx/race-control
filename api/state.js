export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  // Fetch the current tunnel URL from your Gist
  const gistRes = await fetch(
    "https://api.github.com/gists/746339b1b2924446563e6349ef89ce8a",
    { headers: { "Accept": "application/vnd.github+json" } }
  );
  const gist = await gistRes.json();
  const tunnelUrl = JSON.parse(
    gist.files["racecontrol-api.json"].content
  ).url;

  // Forward the request to your actual server
  const upstream = await fetch(`${tunnelUrl}/driver/state`, {
    headers: { "x-discord-id": req.headers["x-discord-id"] || "" }
  });
  const data = await upstream.json();
  res.status(upstream.status).json(data);
}
