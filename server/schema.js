import { pgTable, text, boolean, timestamp, integer, doublePrecision, jsonb, index } from "drizzle-orm/pg-core"

export const members = pgTable("spaceship_members", {
  email: text("email").primaryKey(),
  userId: text("user_id").unique(),
  role: text("role").notNull().default("participant"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
export const sessions = pgTable(
  "spaceship_sessions",
  {
    hash: text("hash").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => members.email),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("spaceship_sessions_email_idx").on(t.email)],
)
export const settings = pgTable("spaceship_settings", {
  id: integer("id").primaryKey(),
  budget: doublePrecision("budget").notNull().default(0),
  paused: boolean("paused").notNull().default(false),
})
export const calls = pgTable(
  "spaceship_calls",
  {
    id: text("id").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => members.email),
    model: text("model").notNull(),
    operation: text("operation").notNull(),
    cost: doublePrecision("cost").notNull(),
    status: text("status").notNull().default("pending"),
    tokens: integer("tokens"),
    latency: integer("latency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("spaceship_calls_email_time_idx").on(t.email, t.createdAt)],
)
export const limits = pgTable("spaceship_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
})
export const audit = pgTable("spaceship_audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
