import "dotenv/config";
import express from "express";
import { fal } from "@fal-ai/client";

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(express.static("public"));

fal.config({ credentials: process.env.FAL_KEY });
const { IMAGE_MODEL, VIDEO_MODEL, VOICE_ID, APP_PASSWORD, ELEVENLABS_API_KEY } = process.env;

app.use("/api", (req, res, next) => {
  if (!APP_PASSWORD || req.get("x-password") !== APP_PASSWORD)
    return res.status(401).json({ error: "Mot de passe incorrect" });
  next();
});

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
};

app.post("/api/image", wrap(async (req, res) => {
  const { prompt, size = "portrait_16_9" } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt manquant" });
  const r = await fal.subscribe(IMAGE_MODEL, { input: { prompt, image_size: size } });
  res.json({ url: r.data.images[0].url });
}));

app.post("/api/video", wrap(async (req, res) => {
  const { prompt, image } = req.body;
  if (!image) return res.status(400).json({ error: "Image manquante" });
  const r = await fal.subscribe(VIDEO_MODEL, {
    input: { prompt: prompt || "", image_url: image },
  });
  res.json({ url: r.data.video.url });
}));

app.post("/api/voice", wrap(async (req, res) => {
  const { text, voiceId = VOICE_ID } = req.body;
  if (!text) return res.status(400).json({ error: "Texte manquant" });
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) return res.status(r.status).json({ error: await r.text() });
  res.set("Content-Type", "audio/mpeg").send(Buffer.from(await r.arrayBuffer()));
}));

app.post("/api/sound", wrap(async (req, res) => {
  const { text, seconds = 5 } = req.body;
  if (!text) return res.status(400).json({ error: "Description manquante" });
  const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: Number(seconds) }),
  });
  if (!r.ok) return res.status(r.status).json({ error: await r.text() });
  res.set("Content-Type", "audio/mpeg").send(Buffer.from(await r.arrayBuffer()));
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Studio IA sur http://localhost:${port}`));
