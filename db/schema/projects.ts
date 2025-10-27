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
export const projectRoleEnum = pgEnum("project_role", ["OWNER", "MAINTAINER", "CONTRIBUTOR", "VIEWER"]);
export const taskStatusEnum = pgEnum("task_status", ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]);
export const taskPriorityEnum = pgEnum("task_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);

// Projects
export const projects = pgTable("projects", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("ACTIVE"), // 'ACTIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED'
    visibility: text("visibility").notNull().default("TEAM"), // 'PUBLIC', 'TEAM', 'PRIVATE'
    avatarUrl: text("avatar_url"),
    color: text("color").notNull().default("#3B82F6"), // Hex color code
    progress: integer("progress").notNull().default(0), // 0-100 percentage
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    tags: jsonb("tags"), // Array of tag strings
    metadata: jsonb("metadata"), // Additional project metadata
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
}, (table) => ({
    createdByIdx: index("projects_created_by_idx").on(table.createdBy),
    statusIdx: index("projects_status_idx").on(table.status),
    nameIdx: index("projects_name_idx").on(table.name),
    tagsIdx: index("projects_tags_idx").using("gin", table.tags),
}));

// Project Members
export const projectMembers = pgTable("project_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull().default("CONTRIBUTOR"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
    projectIdIdx: index("project_members_project_id_idx").on(table.projectId),
    userIdIdx: index("project_members_user_id_idx").on(table.userId),
    uniqueMembership: index("project_members_unique_idx").on(table.projectId, table.userId),
}));

// Tasks
export const tasks = pgTable("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(() => tasks.id, { onDelete: "cascade" }), // For subtasks
    title: text("title").notNull(),
    description: text("description"),
    descriptionRich: jsonb("description_rich"), // Rich text description (TipTap JSON)
    status: taskStatusEnum("status").notNull().default("TODO"),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "set null" }),
    estimatedHours: integer("estimated_hours"),
    actualHours: integer("actual_hours"),
    dueDate: timestamp("due_date"),
    startDate: timestamp("start_date"),
    completedAt: timestamp("completed_at"),
    tags: jsonb("tags"), // Array of tag strings
    position: integer("position").notNull().default(0), // For Kanban board ordering
    metadata: jsonb("metadata"), // Additional task metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    projectIdIdx: index("tasks_project_id_idx").on(table.projectId),
    assigneeIdIdx: index("tasks_assignee_id_idx").on(table.assigneeId),
    reporterIdIdx: index("tasks_reporter_id_idx").on(table.reporterId),
    statusIdx: index("tasks_status_idx").on(table.status),
    priorityIdx: index("tasks_priority_idx").on(table.priority),
    dueDateIdx: index("tasks_due_date_idx").on(table.dueDate),
    parentIdIdx: index("tasks_parent_id_idx").on(table.parentId),
    tagsIdx: index("tasks_tags_idx").using("gin", table.tags),
}));

// Task Dependencies
export const taskDependencies = pgTable("task_dependencies", {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    dependencyType: text("dependency_type").notNull().default("FINISH_TO_START"), // 'FINISH_TO_START', 'START_TO_START', etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    taskIdIdx: index("task_dependencies_task_id_idx").on(table.taskId),
    dependsOnTaskIdIdx: index("task_dependencies_depends_on_task_id_idx").on(table.dependsOnTaskId),
    uniqueDependency: index("task_dependencies_unique_idx").on(table.taskId, table.dependsOnTaskId),
}));

// Task Comments (linked to conversations for unified messaging)
export const taskComments = pgTable("task_comments", {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").notNull(), // References conversations table
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    taskIdIdx: index("task_comments_task_id_idx").on(table.taskId),
    conversationIdIdx: index("task_comments_conversation_id_idx").on(table.conversationId),
    uniqueTaskComment: index("task_comments_unique_idx").on(table.taskId, table.conversationId),
}));

// Project Activity Log
export const projectActivity = pgTable("project_activity", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // 'TASK_CREATED', 'TASK_COMPLETED', 'MEMBER_ADDED', etc.
    details: jsonb("details"), // Action-specific details
    targetId: text("target_id"), // ID of affected resource (task, user, etc.)
    targetType: text("target_type"), // 'task', 'user', 'project', etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    projectIdIdx: index("project_activity_project_id_idx").on(table.projectId),
    userIdIdx: index("project_activity_user_id_idx").on(table.userId),
    actionIdx: index("project_activity_action_idx").on(table.action),
    createdAtIdx: index("project_activity_created_at_idx").on(table.createdAt),
}));