import {
    pgTable,
    text,
    timestamp,
    uuid,
    pgEnum,
    jsonb,
    boolean,
    index,
    integer
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Enums
export const conversationTypeEnum = pgEnum("conversation_type", ["DM", "GROUP", "PROJECT"]);
export const messageStatusEnum = pgEnum("message_status", ["SENT", "DELIVERED", "READ", "FAILED"]);
export const notificationTypeEnum = pgEnum("notification_type", ["MESSAGE", "MENTION", "PROJECT_UPDATE", "REMINDER", "SYSTEM"]);

// Conversations
export const conversations = pgTable("conversations", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: conversationTypeEnum("type").notNull(),
    title: text("title"), // For group conversations
    description: text("description"),
    avatarUrl: text("avatar_url"),
    isArchived: boolean("is_archived").notNull().default(false),
    lastMessageId: uuid("last_message_id"),
    lastMessageAt: timestamp("last_message_at"),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    typeIdx: index("conversations_type_idx").on(table.type),
    createdByIdx: index("conversations_created_by_idx").on(table.createdBy),
    lastMessageAtIdx: index("conversations_last_message_at_idx").on(table.lastMessageAt),
}));

export const conversationMembers = pgTable("conversation_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"), // 'ADMIN', 'MEMBER'
    lastReadMessageId: uuid("last_read_message_id").references(() => messages.id, { onDelete: "set null" }),
    isMuted: boolean("is_muted").notNull().default(false),
    mutedUntil: timestamp("muted_until"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    leftAt: timestamp("left_at"),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
    conversationIdIdx: index("conversation_members_conversation_id_idx").on(table.conversationId),
    userIdIdx: index("conversation_members_user_id_idx").on(table.userId),
    uniqueMembership: index("conversation_members_unique_idx").on(table.conversationId, table.userId),
}));

// Messages
export const messages = pgTable("messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentMessageId: uuid("parent_message_id").references(() => messages.id, { onDelete: "cascade" }), // For threads
    bodyRich: jsonb("body_rich").notNull(), // TipTap JSON format
    bodyPlain: text("body_plain").notNull(), // Plain text for search
    bodyHtml: text("body_html"), // Rendered HTML for preview
    messageType: text("message_type").notNull().default("TEXT"), // 'TEXT', 'MEMO', 'SYSTEM', 'FILE_SHARE'
    status: messageStatusEnum("status").notNull().default("SENT"),
    priority: text("priority").notNull().default("NORMAL"), // 'LOW', 'NORMAL', 'HIGH', 'URGENT'
    isEdited: boolean("is_edited").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    replyCount: integer("reply_count").notNull().default(0),
    reactionCount: integer("reaction_count").notNull().default(0),
    attachmentCount: integer("attachment_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    editedAt: timestamp("edited_at"),
}, (table) => ({
    conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
    senderIdIdx: index("messages_sender_id_idx").on(table.senderId),
    parentMessageIdIdx: index("messages_parent_message_id_idx").on(table.parentMessageId),
    conversationCreatedIdx: index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    // Full-text search
    bodyPlainSearchIdx: index("messages_body_plain_search_idx").using("gin", table.bodyPlain),
}));

// Message Reactions
export const messageReactions = pgTable("message_reactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    messageIdIdx: index("message_reactions_message_id_idx").on(table.messageId),
    userIdIdx: index("message_reactions_user_id_idx").on(table.userId),
    uniqueReaction: index("message_reactions_unique_idx").on(table.messageId, table.userId, table.emoji),
}));

// Typing Indicators
export const typingIndicators = pgTable("typing_indicators", {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
    conversationIdIdx: index("typing_indicators_conversation_id_idx").on(table.conversationId),
    userIdIdx: index("typing_indicators_user_id_idx").on(table.userId),
    uniqueTyping: index("typing_indicators_unique_idx").on(table.conversationId, table.userId),
    expiresAtIdx: index("typing_indicators_expires_at_idx").on(table.expiresAt),
}));

// Read Receipts
export const readReceipts = pgTable("read_receipts", {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").notNull().defaultNow(),
}, (table) => ({
    messageIdIdx: index("read_receipts_message_id_idx").on(table.messageId),
    userIdIdx: index("read_receipts_user_id_idx").on(table.userId),
    uniqueRead: index("read_receipts_unique_idx").on(table.messageId, table.userId),
}));

// Notifications
export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data"), // Additional data like conversation_id, message_id, etc.
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    priority: text("priority").notNull().default("NORMAL"),
    actionUrl: text("action_url"), // URL to navigate to when clicked
    isPushSent: boolean("is_push_sent").notNull().default(false),
    isEmailSent: boolean("is_email_sent").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    typeIdx: index("notifications_type_idx").on(table.type),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    userIdIsReadIdx: index("notifications_user_is_read_idx").on(table.userId, table.isRead),
}));