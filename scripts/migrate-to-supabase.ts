#!/usr/bin/env ts-node
/**
 * Data Migration Script: File-based Markdown -> Supabase
 *
 * Usage:
 *   ts-node scripts/migrate-to-supabase.ts --user-id=<user-id> [--data-dir=./data]
 *
 * Example:
 *   ts-node scripts/migrate-to-supabase.ts --user-id=user_123abc
 */

import { createClient } from '@supabase/supabase-js';
import { getAllProjectsFromDir } from '../lib/markdown';
import { Task } from '../lib/types';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const dataDirArg = args.find(arg => arg.startsWith('--data-dir='));

if (!userIdArg) {
    console.error('❌ Error: --user-id argument is required');
    console.error('Usage: ts-node scripts/migrate-to-supabase.ts --user-id=<user-id> [--data-dir=./data]');
    process.exit(1);
}

const userId = userIdArg.split('=')[1];
const dataDir = dataDirArg ? dataDirArg.split('=')[1] : path.join(process.cwd(), 'data');

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL environment variable is required');
    process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

interface MigrationStats {
    projectsProcessed: number;
    tasksInserted: number;
    errors: string[];
}

async function migrate() {
    console.log('🚀 Starting migration from files to Supabase...');
    console.log(`📁 Data directory: ${dataDir}`);
    console.log(`👤 User ID: ${userId}`);
    console.log('');

    const stats: MigrationStats = {
        projectsProcessed: 0,
        tasksInserted: 0,
        errors: [],
    };

    try {
        // Read all markdown files
        console.log('📖 Reading markdown files...');
        const projects = await getAllProjectsFromDir(dataDir);
        console.log(`✅ Found ${projects.length} projects\n`);

        if (projects.length === 0) {
            console.log('⚠️  No projects found. Nothing to migrate.');
            return;
        }

        for (const project of projects) {
            console.log(`📦 Migrating project: "${project.title}" (${project.id})`);

            try {
                // Check if project already exists
                const { data: existingProject } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('id', project.id)
                    .eq('user_id', userId)
                    .single();

                if (existingProject) {
                    console.log(`   ⚠️  Project already exists, skipping...`);
                    continue;
                }

                // Insert project
                const { error: projectError } = await supabase
                    .from('projects')
                    .insert({
                        id: project.id,
                        user_id: userId,
                        title: project.title,
                    });

                if (projectError) {
                    throw new Error(`Failed to insert project: ${projectError.message}`);
                }

                // Insert tasks recursively
                let displayOrder = 0;
                const insertTasks = async (tasks: Task[], parentId?: string, indentLevel = 0) => {
                    for (const task of tasks) {
                        const taskData = {
                            id: task.id,
                            project_id: project.id,
                            parent_id: parentId || null,
                            content: task.content,
                            status: task.status,
                            completed: task.status === 'done',
                            due_date: task.dueDate || null,
                            repeat_frequency: task.repeatFrequency || null,
                            indent_level: indentLevel,
                            display_order: displayOrder++,
                            line_number: task.lineNumber,
                        };

                        const { error: taskError } = await supabase
                            .from('tasks')
                            .insert(taskData);

                        if (taskError) {
                            throw new Error(`Failed to insert task "${task.content}": ${taskError.message}`);
                        }

                        stats.tasksInserted++;

                        // Insert subtasks
                        if (task.subtasks.length > 0) {
                            await insertTasks(task.subtasks, task.id, indentLevel + 1);
                        }
                    }
                };

                await insertTasks(project.tasks);

                console.log(`   ✅ Migrated ${stats.tasksInserted} tasks`);
                stats.projectsProcessed++;

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`   ❌ Error migrating project: ${errorMsg}`);
                stats.errors.push(`Project "${project.title}": ${errorMsg}`);
            }

            console.log('');
        }

        // Print summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Migration Summary');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Projects migrated: ${stats.projectsProcessed}/${projects.length}`);
        console.log(`✅ Tasks inserted: ${stats.tasksInserted}`);

        if (stats.errors.length > 0) {
            console.log(`\n❌ Errors encountered: ${stats.errors.length}`);
            stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        } else {
            console.log('\n🎉 Migration completed successfully!');
        }

        // Backup recommendation
        console.log('\n💡 Recommendation:');
        console.log('   Keep your original markdown files as backup until you verify');
        console.log('   the migration was successful. You can create a backup with:');
        console.log(`   tar -czf markdown-backup-$(date +%Y%m%d).tar.gz ${dataDir}`);

    } catch (error) {
        console.error('\n❌ Fatal error during migration:', error);
        process.exit(1);
    }
}

// Run migration
migrate().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
