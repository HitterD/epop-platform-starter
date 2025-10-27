import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    jsonb,
    uuid,
    pgEnum,
    index,
    unique
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "USER"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const sessionTypeEnum = pgEnum("session_type", ["WEB", "MOBILE"]);

// Core Tables
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("USER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at"),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerificationToken: text("email_verification_token"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpires: timestamp("password_reset_expires"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    nameIdx: index("users_name_idx").on(table.name),
}));

export const fcmTokens = pgTable("fcm_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(), // 'web', 'ios', 'android'
    deviceInfo: jsonb("device_info"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index("fcm_tokens_user_id_idx").on(table.userId),
    tokenIdx: index("fcm_tokens_token_idx").on(table.token),
}));

// Refresh token management for JWT
export const refreshTokens = pgTable("refresh_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    deviceFingerprint: text("device_fingerprint"),
    expiresAt: timestamp("expires_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
}, (table) => ({
    userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
    tokenIdx: index("refresh_tokens_token_idx").on(table.token),
    expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
}));

// Audit logging for security
export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // 'LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'USER_CREATED', etc.
    targetId: text("target_id"), // ID of affected resource
    targetResource: text("target_resource"), // 'user', 'conversation', 'project', etc.
    metadata: jsonb("metadata"), // Additional context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull().default(true),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    actorIdIdx: index("audit_logs_actor_id_idx").on(table.actorId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

// Keep existing tables for compatibility with better-auth
export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified")
        .$defaultFn(() => false)
        .notNull(),
    image: text("image"),
    createdAt: timestamp("created_at")
        .$defaultFn(() => /* @__PURE__ */ new Date())
        .notNull(),
    updatedAt: timestamp("updated_at")
        .$defaultFn(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").$defaultFn(
        () => /* @__PURE__ */ new Date(),
    ),
    updatedAt: timestamp("updated_at").$defaultFn(
        () => /* @__PURE__ */ new Date(),
    ),
});
