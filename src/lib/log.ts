/** Structured JSON logs (visible in Vercel runtime logs). Never log secrets or document text. */
type Fields = Record<string, unknown>;
function emit(level: "info" | "warn" | "error", event: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === "test" && level === "info") return;
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
export const log = {
  info: (e: string, f?: Fields) => emit("info", e, f),
  warn: (e: string, f?: Fields) => emit("warn", e, f),
  error: (e: string, f?: Fields) => emit("error", e, f),
};
