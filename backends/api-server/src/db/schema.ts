import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("draft"),
  currentVersionId: integer("current_version_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  publishedAt: integer("published_at", { mode: "timestamp" }),
});

export const documentVersions = sqliteTable("document_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull(),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull(),
  source: text("source").notNull().default("manual"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  tokens: integer("tokens"),
  metadataJson: text("metadata_json"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const confusions = sqliteTable("confusions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  sessionId: integer("session_id"),
  sourceMessageId: integer("source_message_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  tagsJson: text("tags_json").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});

export const confusionResolutions = sqliteTable("confusion_resolutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  confusionId: integer("confusion_id").notNull(),
  resolvedByMessageId: integer("resolved_by_message_id"),
  resolutionMd: text("resolution_md").notNull(),
  confidence: integer("confidence").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const solutionDocs = sqliteTable("solution_docs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  periodKey: text("period_key").notNull(),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull(),
  statsJson: text("stats_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Anki-style note: tab-separated import (front / back / optional tags). */
export const ankiNotes = sqliteTable("anki_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  deckName: text("deck_name").notNull().default("Default"),
  front: text("front").notNull(),
  back: text("back").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  /** SM-2 ease × 1000 (e.g. 2500 = 2.5). */
  ease: integer("ease").notNull().default(2500),
  intervalDays: integer("interval_days").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  dueAt: integer("due_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
