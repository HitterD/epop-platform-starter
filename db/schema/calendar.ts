import {
    pgTable,
    text,
    timestamp,
    uuid,
    pgEnum,
    boolean,
    index,
    integer
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { projects } from "./projects";

// Calendar Event Source Enum
export const calendarEventSourceEnum = pgEnum("calendar_event_source", ["MANUAL", "MESSAGE_EXTRACT", "TASK_DUE", "SYSTEM"]);

// Calendar Events
export const calendarEvents = pgTable("calendar_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }), // Optional: project-specific events
    title: text("title").notNull(),
    description: text("description"),
    isAllDay: boolean("is_all_day").notNull().default(false),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    location: text("location"),
    color: text("color").notNull().default("#3B82F6"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurrenceRule: text("recurrence_rule"), // RRULE format for recurring events
    source: calendarEventSourceEnum("source").notNull().default("MANUAL"),
    sourceId: text("source_id"), // ID of source entity (message, task, etc.)
    sourceType: text("source_type"), // 'message', 'task', 'reminder', etc.
    reminderMinutes: integer("reminder_minutes").default(15), // Minutes before event to remind
    isPublic: boolean("is_public").notNull().default(false), // Whether event is visible to others
    attendees: text("attendees"), // JSON array of attendee emails/user IDs
    metadata: text("metadata"), // JSON string for additional event data
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index("calendar_events_user_id_idx").on(table.userId),
    projectIdIdx: index("calendar_events_project_id_idx").on(table.projectId),
    startsAtIdx: index("calendar_events_starts_at_idx").on(table.startsAt),
    endsAtIdx: index("calendar_events_ends_at_idx").on(table.endsAt),
    sourceIdx: index("calendar_events_source_idx").on(table.source),
    userTimeRangeIdx: index("calendar_events_user_time_range_idx").on(table.userId, table.startsAt, table.endsAt),
}));

// Event Attendance
export const eventAttendees = pgTable("event_attendees", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    email: text("email"), // For external attendees
    status: text("status").notNull().default("NEEDS_ACTION"), // 'ACCEPTED', 'DECLINED', 'TENTATIVE', 'NEEDS_ACTION'
    responseAt: timestamp("response_at"),
    isOptional: boolean("is_optional").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    eventIdIdx: index("event_attendees_event_id_idx").on(table.eventId),
    userIdIdx: index("event_attendees_user_id_idx").on(table.userId),
    uniqueAttendee: index("event_attendees_unique_idx").on(table.eventId, table.userId),
}));

// Recurring Event Instances
export const recurringEventInstances = pgTable("recurring_event_instances", {
    id: uuid("id").primaryKey().defaultRandom(),
    parentEventId: uuid("parent_event_id").notNull().references(() => calendarEvents.id, { onDelete: "cascade" }),
    instanceStartsAt: timestamp("instance_starts_at").notNull(),
    instanceEndsAt: timestamp("instance_ends_at").notNull(),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    parentEventIdIdx: index("recurring_event_instances_parent_event_id_idx").on(table.parentEventId),
    instanceTimeIdx: index("recurring_event_instances_instance_time_idx").on(table.instanceStartsAt),
}));