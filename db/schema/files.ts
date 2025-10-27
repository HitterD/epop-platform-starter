import {
    pgTable,
    text,
    timestamp,
    uuid,
    integer,
    jsonb,
    boolean,
    index
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Files
export const files = pgTable("files", {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull().unique(), // MinIO object key
    storageProvider: text("storage_provider").notNull().default("minio"),
    bucket: text("bucket").notNull().default("epop-files"),
    path: text("path").notNull(), // Full path in storage
    hash: text("hash"), // SHA-256 hash for deduplication
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    isPublic: boolean("is_public").notNull().default(false),
    isEncrypted: boolean("is_encrypted").notNull().default(false),
    encryptionKey: text("encryption_key"), // Encrypted key for file access
    thumbnailKey: text("thumbnail_key"), // For image/video thumbnails
    previewKey: text("preview_key"), // For document previews
    metadata: jsonb("metadata"), // EXIF data, dimensions, etc.
    tags: jsonb("tags"), // Array of tag strings
    retentionExpiresAt: timestamp("retention_expires_at"), // For temporary files
    downloadCount: integer("download_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    uploadedByIdx: index("files_uploaded_by_idx").on(table.uploadedBy),
    mimeTypeIdx: index("files_mime_type_idx").on(table.mimeType),
    storageKeyIdx: index("files_storage_key_idx").on(table.storageKey),
    hashIdx: index("files_hash_idx").on(table.hash),
    filenameIdx: index("files_filename_idx").using("gin", table.filename.generate("gin_trgm_ops")),
    tagsIdx: index("files_tags_idx").using("gin", table.tags),
    createdAtIdx: index("files_created_at_idx").on(table.createdAt),
}));

// File Associations (link files to conversations, projects, tasks, etc.)
export const fileAssociations = pgTable("file_associations", {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // 'message', 'project', 'task', 'user_avatar', etc.
    entityId: uuid("entity_id").notNull(), // ID of the associated entity
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    fileIdIdx: index("file_associations_file_id_idx").on(table.fileId),
    entityIdx: index("file_associations_entity_idx").on(table.entityType, table.entityId),
    uploadedByIdx: index("file_associations_uploaded_by_idx").on(table.uploadedBy),
    uniqueAssociation: index("file_associations_unique_idx").on(table.fileId, table.entityType, table.entityId),
}));

// File Access Log (audit trail for file access)
export const fileAccessLogs = pgTable("file_access_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // 'UPLOAD', 'DOWNLOAD', 'VIEW', 'DELETE', 'SHARE'
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"), // Additional context
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    fileIdIdx: index("file_access_logs_file_id_idx").on(table.fileId),
    userIdIdx: index("file_access_logs_user_id_idx").on(table.userId),
    actionIdx: index("file_access_logs_action_idx").on(table.action),
    createdAtIdx: index("file_access_logs_created_at_idx").on(table.createdAt),
}));

// File Shares (for sharing files with external users)
export const fileShares = pgTable("file_shares", {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    shareToken: text("share_token").notNull().unique(),
    sharedBy: uuid("shared_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    shareType: text("share_type").notNull().default("LINK"), // 'LINK', 'EMAIL', 'USER'
    sharedWithEmail: text("shared_with_email"), // For email shares
    sharedWithUserId: uuid("shared_with_user_id").references(() => users.id, { onDelete: "cascade" }),
    permissions: text("permissions").notNull().default("READ"), // 'READ', 'WRITE', 'DOWNLOAD'
    password: text("password"), // For password-protected shares
    expiresAt: timestamp("expires_at"),
    maxDownloads: integer("max_downloads"),
    currentDownloads: integer("current_downloads").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at"),
}, (table) => ({
    fileIdIdx: index("file_shares_file_id_idx").on(table.fileId),
    sharedByIdx: index("file_shares_shared_by_idx").on(table.sharedBy),
    shareTokenIdx: index("file_shares_share_token_idx").on(table.shareToken),
    sharedWithUserIdIdx: index("file_shares_shared_with_user_id_idx").on(table.sharedWithUserId),
    expiresAtIdx: index("file_shares_expires_at_idx").on(table.expiresAt),
}));