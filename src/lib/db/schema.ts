import {
  pgTable, uuid, text, integer, timestamp, jsonb, boolean, vector, index, uniqueIndex, primaryKey, customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const EMBED_DIM = 768;

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/** kind = 'library' (built-in sample book, ownerId null) or 'upload' (owned by a user). */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  slug: text("slug"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  authors: text("authors"),
  topic: text("topic"),
  license: text("license"),
  licenseUrl: text("license_url"),
  sourceUrl: text("source_url"),
  fileUrl: text("file_url").notNull(),
  fileBytes: integer("file_bytes"),
  pages: integer("pages").notNull().default(0),
  toc: jsonb("toc").$type<{ title: string; page: number }[]>().default([]),
  status: text("status").notNull().default("processing"),
  stage: text("stage").notNull().default("extract"),
  progress: integer("progress").notNull().default(0),
  usedOcr: boolean("used_ocr").notNull().default(false),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("documents_owner_idx").on(t.ownerId),
  uniqueIndex("documents_slug_idx").on(t.slug),
]);

export const pageTexts = pgTable("page_texts", {
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  page: integer("page").notNull(),
  text: text("text").notNull(),
}, (t) => [primaryKey({ columns: [t.documentId, t.page] })]);

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  page: integer("page").notNull(),
  idx: integer("idx").notNull(),
  section: text("section"),
  content: text("content").notNull(),
  flagged: boolean("flagged").notNull().default(false),
  tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', coalesce(section,'') || ' ' || content)`),
  embedding: vector("embedding", { dimensions: EMBED_DIM }),
}, (t) => [
  index("chunks_doc_idx").on(t.documentId),
  index("chunks_tsv_idx").using("gin", t.tsv),
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  documentIds: jsonb("document_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("conversations_user_idx").on(t.userId)]);

export type Citation = { n: number; documentId: string; title: string; page: number; excerpt: string };

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  status: text("status"),
  citations: jsonb("citations").$type<Citation[]>().default([]),
  steps: jsonb("steps").$type<{ label: string; detail?: string; ms?: number }[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("messages_conv_idx").on(t.conversationId)]);

export const readingProgress = pgTable("reading_progress", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  page: integer("page").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.documentId] })]);

export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
