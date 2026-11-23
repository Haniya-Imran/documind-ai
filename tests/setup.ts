import { vi } from "vitest";

const jar = new Map<string, string>();
(globalThis as unknown as { __cookieJar: Map<string, string> }).__cookieJar = jar;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
