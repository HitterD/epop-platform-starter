import {
    pgTable,
    text,
    timestamp,
    uuid,
    pgEnum,
    index
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Enums
export const divisionRoleEnum = pgEnum("division_role", ["MANAGER", "MEMBER", "VIEWER"]);

// Organization Structure
export const divisions = pgTable("divisions", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id").references(() => divisions.id, { onDelete: "set null" }),
    level: text("level").notNull().default("0"), // For hierarchy depth
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    parentIdIdx: index("divisions_parent_id_idx").on(table.parentId),
    nameIdx: index("divisions_name_idx").on(table.name),
}));

export const divisionMembers = pgTable("division_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    divisionId: uuid("division_id").notNull().references(() => divisions.id, { onDelete: "cascade" }),
    role: divisionRoleEnum("role").notNull().default("MEMBER"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
    userIdIdx: index("division_members_user_id_idx").on(table.userId),
    divisionIdIdx: index("division_members_division_id_idx").on(table.divisionId),
    uniqueMembership: index("division_members_unique_idx").on(table.userId, table.divisionId),
}));

// Settings for system configuration
export const settings = pgTable("settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(), // JSON string for complex values
    description: text("description"),
    category: text("category").notNull().default("general"), // 'general', 'security', 'notifications', 'storage', etc.
    isPublic: boolean("is_public").notNull().default(false), // Whether setting is accessible by non-admin users
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    keyIdx: index("settings_key_idx").on(table.key),
    categoryIdx: index("settings_category_idx").on(table.category),
}));