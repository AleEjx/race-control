

const GIST_ID = "746339b1b2924446563e6349ef89ce8a";
const GIST_FILE = "racecontrol-api.json";

let cachedUrl = null;
let cachedAt = 0;
const CACHE_MS = 10_000; 

async function resolveTunnelUrl() {
  const now = Date.now();
  if (cachedUrl && now - cachedAt < CACHE_MS) return cachedUrl;

  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`);
  if (!res.ok) throw new Error(`Gist fetch failed: ${res.status}`);
  const data = await res.json();
  const content = JSON.parse(data.files[GIST_FILE].content);
  if (!content.url) throw new Error("Gist has no url field");

  cachedUrl = content.url;
  cachedAt = now;
  return cachedUrl;
}


const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "transfer-encoding", "upgrade",
  "host", "content-length", "accept-encoding",
]);

module.exports = async (req, res) => {
  let tunnelUrl;
  try {
    tunnelUrl = await resolveTunnelUrl();
  } catch (err) {
    res.status(502).json({ error: "Could not resolve API tunnel URL", detail: err.message });
    return;
  }


  const pathSegments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const targetPath = "/" + pathSegments.join("/");


  const qs = new URLSearchParams(req.query);
  qs.delete("path");
  const qsString = qs.toString();
  const targetUrl = `${tunnelUrl}${targetPath}${qsString ? `?${qsString}` : ""}`;

  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) {
      forwardHeaders[key] = value;
    }
  }

  try {
    const init = {
      method: req.method,
      headers: forwardHeaders,
    };


    if (!["GET", "HEAD"].includes(req.method)) {
      init.body = req;
      init.duplex = "half"; 
    }

    const upstream = await fetch(targetUrl, init);


    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: "Upstream request failed", detail: err.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
