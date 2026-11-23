// Runs the retrieval + refusal evaluation on a running DocuMind deployment and saves the results.
// Usage: EVAL_URL=https://your-site.vercel.app ADMIN_TOKEN=... node scripts/eval.mjs
import { mkdirSync, writeFileSync } from "node:fs";
const url = (process.env.EVAL_URL || "http://localhost:3000").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN;
if (!token) { console.error("Set ADMIN_TOKEN"); process.exit(1); }
const res = await fetch(`${url}/api/admin/eval?refusal=1`, { headers: { "x-admin-token": token } });
if (!res.ok) { console.error(`Eval failed: HTTP ${res.status}`, await res.text()); process.exit(1); }
const data = await res.json();
mkdirSync("notebooks", { recursive: true });
writeFileSync("notebooks/eval-results.json", JSON.stringify({ evaluatedAt: new Date().toISOString(), target: url, ...data }, null, 2));
console.table(Object.fromEntries(Object.entries(data.metrics).map(([k, v]) => [k, { "recall@5": v["recall@5"].toFixed(2), "precision@5": v["precision@5"].toFixed(2), MRR: v.mrr.toFixed(2) }])));
if (data.refusal) console.log("Refusal:", JSON.stringify({ ...data.refusal, items: undefined }));
console.log("Saved notebooks/eval-results.json");
