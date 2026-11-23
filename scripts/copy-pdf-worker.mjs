// Copies the pdf.js worker that matches the installed react-pdf version into /public.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const pdfjsDir = dirname(require.resolve("pdfjs-dist/package.json", { paths: [dirname(require.resolve("react-pdf/package.json"))] }));
mkdirSync("public", { recursive: true });
copyFileSync(join(pdfjsDir, "build", "pdf.worker.min.mjs"), join("public", "pdf.worker.min.mjs"));
console.log("pdf.worker.min.mjs copied");
