// Export all schema tables
export * from './auth';
export * from './organization';
export * from './messaging';
export * from './projects';
export * from './calendar';
export * from './files';

// Export relations
import { relations } from 'drizzle-orm';
import {
    users,
    fcmTokens,
    refreshTokens,
    passwordResetTokens,
    auditLogs,
} from './auth';
import {
    divisions,
    divisionMembers,
    settings,
} from './organization';
import {
    conversations,
    conversationMembers,
    messages,
    messageReactions,
    typingIndicators,
    readReceipts,
    notifications,
} from './messaging';
import {
    projects,
    projectMembers,
    tasks,
    taskDependencies,
    taskComments,
    projectActivity,
} from './projects';
import {
    calendarEvents,
    eventAttendees,
    recurringEventInstances,
} from './calendar';
import {
    files,
    fileAssociations,
    fileAccessLogs,
    fileShares,
} from './files';

// Relations for auth tables
export const usersRelations = relations(users, ({ many }) => ({
    fcmTokens: many(fcmTokens),
    refreshTokens: many(refreshTokens),
    passwordResetTokens: many(passwordResetTokens),
    auditLogsAsActor: many(auditLogs),
    divisionMemberships: many(divisionMembers),
    conversationMemberships: many(conversationMembers),
    sentMessages: many(messages),
    messageReactions: many(messageReactions),
    readReceipts: many(readReceipts),
    notifications: many(notifications),
    projectMemberships: many(projectMembers),
    createdProjects: many(projects),
    reportedTasks: many(tasks),
    assignedTasks: many(tasks),
    projectActivities: many(projectActivity),
    calendarEvents: many(calendarEvents),
    eventAttendances: many(eventAttendees),
    uploadedFiles: many(files),
    fileAccessLogs: many(fileAccessLogs),
}));

export const fcmTokensRelations = relations(fcmTokens, ({ one }) => ({
    user: one(users, {
        fields: [fcmTokens.userId],
        references: [users.id],
    }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
    user: one(users, {
        fields: [refreshTokens.userId],
        references: [users.id],
    }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
    user: one(users, {
        fields: [passwordResetTokens.userId],
        references: [users.id],
    }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    actor: one(users, {
        fields: [auditLogs.actorId],
        references: [users.id],
    }),
}));

// Relations for organization tables
export const divisionsRelations = relations(divisions, ({ many, one }) => ({
    parent: one(divisions, {
        fields: [divisions.parentId],
        references: [divisions.id],
    }),
    children: many(divisions),
    members: many(divisionMembers),
}));

export const divisionMembersRelations = relations(divisionMembers, ({ one }) => ({
    user: one(users, {
        fields: [divisionMembers.userId],
        references: [users.id],
    }),
    division: one(divisions, {
        fields: [divisionMembers.divisionId],
        references: [divisions.id],
    }),
}));

// Relations for messaging tables
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [conversations.createdBy],
        references: [users.id],
    }),
    lastMessage: one(messages, {
        fields: [conversations.lastMessageId],
        references: [messages.id],
    }),
    members: many(conversationMembers),
    messages: many(messages),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
    conversation: one(conversations, {
        fields: [conversationMembers.conversationId],
        references: [conversations.id],
    }),
    user: one(users, {
        fields: [conversationMembers.userId],
        references: [users.id],
    }),
    lastReadMessage: one(messages, {
        fields: [conversationMembers.lastReadMessageId],
        references: [messages.id],
    }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
    sender: one(users, {
        fields: [messages.senderId],
        references: [users.id],
    }),
    parentMessage: one(messages, {
        fields: [messages.parentMessageId],
        references: [messages.id],
    }),
    replies: many(messages),
    reactions: many(messageReactions),
    readReceipts: many(readReceipts),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
    message: one(messages, {
        fields: [messageReactions.messageId],
        references: [messages.id],
    }),
    user: one(users, {
        fields: [messageReactions.userId],
        references: [users.id],
    }),
}));

export const readReceiptsRelations = relations(readReceipts, ({ one }) => ({
    message: one(messages, {
        fields: [readReceipts.messageId],
        references: [messages.id],
    }),
    user: one(users, {
        fields: [readReceipts.userId],
        references: [users.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

// Relations for projects tables
export const projectsRelations = relations(projects, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [projects.createdBy],
        references: [users.id],
    }),
    members: many(projectMembers),
    tasks: many(tasks),
    activities: many(projectActivity),
    calendarEvents: many(calendarEvents),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
    project: one(projects, {
        fields: [projectMembers.projectId],
        references: [projects.id],
    }),
    user: one(users, {
        fields: [projectMembers.userId],
        references: [users.id],
    }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    project: one(projects, {
        fields: [tasks.projectId],
        references: [projects.id],
    }),
    assignee: one(users, {
        fields: [tasks.assigneeId],
        references: [users.id],
    }),
    reporter: one(users, {
        fields: [tasks.reporterId],
        references: [users.id],
    }),
    parent: one(tasks, {
        fields: [tasks.parentId],
        references: [tasks.id],
    }),
    children: many(tasks),
    dependencies: many(taskDependencies),
    dependents: many(taskDependencies),
    comments: many(taskComments),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
    task: one(tasks, {
        fields: [taskDependencies.taskId],
        references: [tasks.id],
    }),
    dependsOnTask: one(tasks, {
        fields: [taskDependencies.dependsOnTaskId],
        references: [tasks.id],
    }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
    task: one(tasks, {
        fields: [taskComments.taskId],
        references: [tasks.id],
    }),
}));

export const projectActivityRelations = relations(projectActivity, ({ one }) => ({
    project: one(projects, {
        fields: [projectActivity.projectId],
        references: [projects.id],
    }),
    user: one(users, {
        fields: [projectActivity.userId],
        references: [users.id],
    }),
}));

// Relations for calendar tables
export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
    user: one(users, {
        fields: [calendarEvents.userId],
        references: [users.id],
    }),
    project: one(projects, {
        fields: [calendarEvents.projectId],
        references: [projects.id],
    }),
    attendees: many(eventAttendees),
    instances: many(recurringEventInstances),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
    event: one(calendarEvents, {
        fields: [eventAttendees.eventId],
        references: [calendarEvents.id],
    }),
    user: one(users, {
        fields: [eventAttendees.userId],
        references: [users.id],
    }),
}));

export const recurringEventInstancesRelations = relations(recurringEventInstances, ({ one }) => ({
    parentEvent: one(calendarEvents, {
        fields: [recurringEventInstances.parentEventId],
        references: [calendarEvents.id],
    }),
}));

// Relations for files tables
export const filesRelations = relations(files, ({ one, many }) => ({
    uploadedBy: one(users, {
        fields: [files.uploadedBy],
        references: [users.id],
    }),
    associations: many(fileAssociations),
    accessLogs: many(fileAccessLogs),
    shares: many(fileShares),
}));

export const fileAssociationsRelations = relations(fileAssociations, ({ one }) => ({
    file: one(files, {
        fields: [fileAssociations.fileId],
        references: [files.id],
    }),
    uploadedBy: one(users, {
        fields: [fileAssociations.uploadedBy],
        references: [users.id],
    }),
}));

export const fileAccessLogsRelations = relations(fileAccessLogs, ({ one }) => ({
    file: one(files, {
        fields: [fileAccessLogs.fileId],
        references: [files.id],
    }),
    user: one(users, {
        fields: [fileAccessLogs.userId],
        references: [users.id],
    }),
}));

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
    file: one(files, {
        fields: [fileShares.fileId],
        references: [files.id],
    }),
    sharedBy: one(users, {
        fields: [fileShares.sharedBy],
        references: [users.id],
    }),
    sharedWithUser: one(users, {
        fields: [fileShares.sharedWithUserId],
        references: [users.id],
    }),
}));