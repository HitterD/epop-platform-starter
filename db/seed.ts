import 'dotenv/config';
import { db } from './index';
import {
    users,
    divisions,
    divisionMembers,
    settings,
    projects,
    projectMembers,
    conversations,
    conversationMembers,
    tasks,
    messages,
    notifications,
} from './schema';

async function seed() {
    console.log('🌱 Starting database seeding...');

    try {
        // Create demo users
        console.log('Creating demo users...');
        const adminUser = await db.insert(users).values({
            email: 'admin@epop.com',
            passwordHash: await hashPassword('Admin123!@#'), // In production, use proper hashing
            name: 'System Administrator',
            role: 'ADMIN',
            status: 'ACTIVE',
            emailVerified: true,
        }).returning();

        const demoUser = await db.insert(users).values({
            email: 'john.doe@epop.com',
            passwordHash: await hashPassword('User123!@#'), // In production, use proper hashing
            name: 'John Doe',
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true,
        }).returning();

        const managerUser = await db.insert(users).values({
            email: 'jane.smith@epop.com',
            passwordHash: await hashPassword('Manager123!@#'), // In production, use proper hashing
            name: 'Jane Smith',
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true,
        }).returning();

        // Create organizational structure
        console.log('Creating organizational structure...');
        const techDivision = await db.insert(divisions).values({
            name: 'Technology',
            description: 'Technology and Development Division',
            level: '0',
        }).returning();

        const engDivision = await db.insert(divisions).values({
            name: 'Engineering',
            description: 'Software Engineering Team',
            parentId: techDivision[0].id,
            level: '1',
        }).returning();

        const productDivision = await db.insert(divisions).values({
            name: 'Product',
            description: 'Product Management Division',
            level: '0',
        }).returning();

        // Assign users to divisions
        console.log('Assigning users to divisions...');
        await db.insert(divisionMembers).values([
            { userId: adminUser[0].id, divisionId: techDivision[0].id, role: 'MANAGER' },
            { userId: demoUser[0].id, divisionId: engDivision[0].id, role: 'MEMBER' },
            { userId: managerUser[0].id, divisionId: productDivision[0].id, role: 'MANAGER' },
        ]);

        // Create system settings
        console.log('Creating system settings...');
        await db.insert(settings).values([
            { key: 'max_file_size_user', value: '104857600', description: 'Max file size for regular users (100MB)', category: 'storage' },
            { key: 'max_file_size_admin', value: '524288000', description: 'Max file size for admins (500MB)', category: 'storage' },
            { key: 'message_retention_days', value: '365', description: 'Message retention period in days', category: 'security' },
            { key: 'file_retention_days', value: '730', description: 'File retention period in days', category: 'storage' },
            { key: 'max_login_attempts', value: '5', description: 'Maximum failed login attempts before lockout', category: 'security' },
            { key: 'lockout_duration_minutes', value: '30', description: 'Account lockout duration in minutes', category: 'security' },
            { key: 'jwt_access_expiry_minutes', value: '15', description: 'JWT access token expiry in minutes', category: 'security' },
            { key: 'jwt_refresh_expiry_days', value: '7', description: 'JWT refresh token expiry in days', category: 'security' },
        ]);

        // Create demo projects
        console.log('Creating demo projects...');
        const project1 = await db.insert(projects).values({
            name: 'EPOP Platform Development',
            description: 'Development of the Enterprise Platform for Operational Performance',
            status: 'ACTIVE',
            visibility: 'TEAM',
            color: '#3B82F6',
            progress: 35,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            tags: ['development', 'platform', 'enterprise'],
            createdBy: adminUser[0].id,
        }).returning();

        const project2 = await db.insert(projects).values({
            name: 'Customer Portal Redesign',
            description: 'Redesign of the customer-facing portal',
            status: 'ACTIVE',
            visibility: 'TEAM',
            color: '#10B981',
            progress: 60,
            startDate: new Date('2024-02-01'),
            endDate: new Date('2024-08-31'),
            tags: ['design', 'customer', 'portal'],
            createdBy: managerUser[0].id,
        }).returning();

        // Assign users to projects
        console.log('Assigning users to projects...');
        await db.insert(projectMembers).values([
            { userId: adminUser[0].id, projectId: project1[0].id, role: 'OWNER' },
            { userId: demoUser[0].id, projectId: project1[0].id, role: 'CONTRIBUTOR' },
            { userId: managerUser[0].id, projectId: project1[0].id, role: 'MAINTAINER' },
            { userId: managerUser[0].id, projectId: project2[0].id, role: 'OWNER' },
            { userId: demoUser[0].id, projectId: project2[0].id, role: 'CONTRIBUTOR' },
        ]);

        // Create demo conversations
        console.log('Creating demo conversations...');
        const generalConversation = await db.insert(conversations).values({
            type: 'GROUP',
            title: 'General Chat',
            description: 'General team communication',
            createdBy: adminUser[0].id,
        }).returning();

        const projectConversation = await db.insert(conversations).values({
            type: 'PROJECT',
            title: 'EPOP Development',
            description: 'Discussion about EPOP platform development',
            createdBy: adminUser[0].id,
        }).returning();

        // Add members to conversations
        console.log('Adding members to conversations...');
        await db.insert(conversationMembers).values([
            { conversationId: generalConversation[0].id, userId: adminUser[0].id, role: 'ADMIN' },
            { conversationId: generalConversation[0].id, userId: demoUser[0].id, role: 'MEMBER' },
            { conversationId: generalConversation[0].id, userId: managerUser[0].id, role: 'MEMBER' },
            { conversationId: projectConversation[0].id, userId: adminUser[0].id, role: 'ADMIN' },
            { conversationId: projectConversation[0].id, userId: demoUser[0].id, role: 'MEMBER' },
            { conversationId: projectConversation[0].id, userId: managerUser[0].id, role: 'MEMBER' },
        ]);

        // Create demo tasks
        console.log('Creating demo tasks...');
        const task1 = await db.insert(tasks).values({
            projectId: project1[0].id,
            title: 'Implement Authentication System',
            description: 'Build complete authentication system with JWT, password reset, and user management',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            assigneeId: demoUser[0].id,
            reporterId: adminUser[0].id,
            dueDate: new Date('2024-06-15'),
            tags: ['authentication', 'backend', 'security'],
            position: 0,
        }).returning();

        const task2 = await db.insert(tasks).values({
            projectId: project1[0].id,
            title: 'Design UI Components',
            description: 'Create reusable UI components for the platform',
            status: 'TODO',
            priority: 'MEDIUM',
            assigneeId: managerUser[0].id,
            reporterId: adminUser[0].id,
            dueDate: new Date('2024-06-30'),
            tags: ['design', 'frontend', 'components'],
            position: 1,
        }).returning();

        const task3 = await db.insert(tasks).values({
            projectId: project2[0].id,
            title: 'User Research',
            description: 'Conduct user research for portal redesign',
            status: 'DONE',
            priority: 'HIGH',
            assigneeId: managerUser[0].id,
            reporterId: managerUser[0].id,
            dueDate: new Date('2024-05-01'),
            tags: ['research', 'ux', 'design'],
            position: 0,
        }).returning();

        // Create demo messages
        console.log('Creating demo messages...');
        await db.insert(messages).values([
            {
                conversationId: generalConversation[0].id,
                senderId: adminUser[0].id,
                bodyRich: { type: 'doc', content: [{ type: 'paragraph', content: [{ text: 'Welcome to the EPOP platform! 🚀 This is our internal communication and project management system.' }] }],
                bodyPlain: 'Welcome to the EPOP platform! 🚀 This is our internal communication and project management system.',
                messageType: 'TEXT',
                status: 'SENT',
                priority: 'NORMAL',
            },
            {
                conversationId: generalConversation[0].id,
                senderId: managerUser[0].id,
                bodyRich: { type: 'doc', content: [{ type: 'paragraph', content: [{ text: 'Excited to start using this platform! The project management features look great.' }] }],
                bodyPlain: 'Excited to start using this platform! The project management features look great.',
                messageType: 'TEXT',
                status: 'SENT',
                priority: 'NORMAL',
            },
            {
                conversationId: projectConversation[0].id,
                senderId: demoUser[0].id,
                bodyRich: { type: 'doc', content: [{ type: 'paragraph', content: [{ text: 'Working on the authentication system. The JWT implementation is complete and tested.' }] }],
                bodyPlain: 'Working on the authentication system. The JWT implementation is complete and tested.',
                messageType: 'TEXT',
                status: 'SENT',
                priority: 'NORMAL',
            },
            {
                conversationId: projectConversation[0].id,
                senderId: adminUser[0].id,
                bodyRich: { type: 'doc', content: [{ type: 'paragraph', content: [{ text: 'Great work! Please update the task status and mark it as in progress.' }] }],
                bodyPlain: 'Great work! Please update the task status and mark it as in progress.',
                messageType: 'TEXT',
                status: 'SENT',
                priority: 'NORMAL',
            },
        ]);

        // Create demo notifications
        console.log('Creating demo notifications...');
        await db.insert(notifications).values([
            {
                userId: demoUser[0].id,
                type: 'MENTION',
                title: 'Mentioned in conversation',
                body: 'You were mentioned in EPOP Development conversation',
                data: { conversationId: projectConversation[0].id },
                priority: 'NORMAL',
            },
            {
                userId: managerUser[0].id,
                type: 'PROJECT_UPDATE',
                title: 'Task assigned',
                body: 'You have been assigned to "Design UI Components" task',
                data: { taskId: task2[0].id, projectId: project1[0].id },
                priority: 'HIGH',
            },
            {
                userId: adminUser[0].id,
                type: 'SYSTEM',
                title: 'System Update',
                body: 'EPOP platform has been successfully deployed',
                data: { version: '1.0.0' },
                priority: 'NORMAL',
            },
        ]);

        console.log('✅ Database seeding completed successfully!');
        console.log('\n👤 Demo Users:');
        console.log('  Admin: admin@epop.com / Admin123!@#');
        console.log('  User: john.doe@epop.com / User123!@#');
        console.log('  Manager: jane.smith@epop.com / Manager123!@#');

    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        throw error;
    }
}

// Helper function to hash passwords (simplified for seeding)
async function hashPassword(password: string): Promise<string> {
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');

    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}:100000`);
        });
    });
}

// Run the seed script if called directly
if (require.main === module) {
    seed()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { seed };