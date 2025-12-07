/**
 * Encryption Migration Utilities
 * Provides tools to enable/disable encryption on existing projects
 */

import { getProjectById, updateProject } from './indexeddb';
import { setMasterPassword, clearMasterPassword, hasMasterPassword } from './encryption';
import { Project } from './types';

/**
 * Enable encryption for an existing project
 * @param projectId Project ID to encrypt
 * @param password Master password for encryption
 * @returns Updated project with encryption enabled
 */
export async function enableEncryptionForProject(
    projectId: string,
    password: string
): Promise<Project> {
    // Validate password
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    // Set master password
    setMasterPassword(password);

    // Get existing project
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`Project not found: ${projectId}`);
    }

    // Check if already encrypted
    if (project.isEncrypted) {
        throw new Error('Project is already encrypted');
    }

    // Enable encryption flag
    const updatedProject = {
        ...project,
        isEncrypted: true,
        updated_at: new Date().toISOString(),
    };

    // Update project (will be automatically encrypted by indexeddb.ts)
    await updateProject(updatedProject);

    console.log(`✅ Encryption enabled for project: ${projectId}`);
    return updatedProject;
}

/**
 * Disable encryption for a project (convert back to plaintext)
 * @param projectId Project ID to decrypt
 * @param password Master password to verify decryption
 * @returns Updated project with encryption disabled
 */
export async function disableEncryptionForProject(
    projectId: string,
    password: string
): Promise<Project> {
    // Set master password for decryption
    setMasterPassword(password);

    // Get existing project (will be decrypted automatically)
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`Project not found: ${projectId}`);
    }

    // Check if encrypted
    if (!project.isEncrypted) {
        throw new Error('Project is not encrypted');
    }

    // Disable encryption flag
    const updatedProject = {
        ...project,
        isEncrypted: false,
        updated_at: new Date().toISOString(),
    };

    // Clear encrypted fields (they will be removed on next save)
    delete updatedProject.encryptedTitle;
    if (updatedProject.groups) {
        updatedProject.groups.forEach(group => {
            delete group.encryptedName;
            if (group.tasks) {
                const clearEncryptedContent = (tasks: typeof group.tasks) => {
                    tasks.forEach(task => {
                        delete task.encryptedContent;
                        if (task.subtasks) {
                            clearEncryptedContent(task.subtasks);
                        }
                    });
                };
                clearEncryptedContent(group.tasks);
            }
        });
    }

    // Update project (will be stored as plaintext)
    await updateProject(updatedProject);

    // Clear master password
    clearMasterPassword();

    console.log(`✅ Encryption disabled for project: ${projectId}`);
    return updatedProject;
}

/**
 * Check encryption status of a project
 * @param projectId Project ID to check
 * @returns Encryption status information
 */
export async function getEncryptionStatus(projectId: string): Promise<{
    projectId: string;
    isEncrypted: boolean;
    hasEncryptedFields: boolean;
    hasMasterPassword: boolean;
}> {
    // Temporarily get raw project without decryption
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MarkdownTodoDB', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const project = await new Promise<Project | null>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });

    if (!project) {
        throw new Error(`Project not found: ${projectId}`);
    }

    // Check for encrypted fields
    const hasEncryptedFields = !!(
        project.encryptedTitle ||
        project.groups?.some(g =>
            g.encryptedName ||
            g.tasks?.some(t => t.encryptedContent)
        )
    );

    return {
        projectId,
        isEncrypted: project.isEncrypted || false,
        hasEncryptedFields,
        hasMasterPassword: hasMasterPassword(),
    };
}

/**
 * Batch enable encryption for all projects
 * @param password Master password for encryption
 * @returns Array of updated projects
 */
export async function enableEncryptionForAllProjects(password: string): Promise<Project[]> {
    // Validate password
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    // Set master password
    setMasterPassword(password);

    // Get all projects
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MarkdownTodoDB', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const projects = await new Promise<Project[]>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const updatedProjects: Project[] = [];

    for (const project of projects) {
        if (!project.isEncrypted) {
            const updated = {
                ...project,
                isEncrypted: true,
                updated_at: new Date().toISOString(),
            };
            await updateProject(updated);
            updatedProjects.push(updated);
            console.log(`✅ Encrypted: ${project.id}`);
        }
    }

    console.log(`✅ Encryption enabled for ${updatedProjects.length} projects`);
    return updatedProjects;
}

/**
 * Simple helper to set up encryption for first-time users
 * This can be called from browser console
 */
export async function setupEncryption(password: string, projectId?: string): Promise<void> {
    console.log('🔐 Setting up encryption...');

    if (projectId) {
        // Enable for specific project
        await enableEncryptionForProject(projectId, password);
        const status = await getEncryptionStatus(projectId);
        console.log('📊 Encryption Status:', status);
    } else {
        // Enable for all projects
        await enableEncryptionForAllProjects(password);
        console.log('✅ All projects are now encrypted!');
    }

    console.log('\n⚠️  IMPORTANT: Remember your password!');
    console.log('Without it, you cannot decrypt your data.');
    console.log('\n💡 TIP: Reload the page to see encrypted data.');
}

// Export for browser console access
interface WindowWithEncryptionMigration extends Window {
    encryptionMigration?: {
        setupEncryption: typeof setupEncryption;
        enableEncryptionForProject: typeof enableEncryptionForProject;
        disableEncryptionForProject: typeof disableEncryptionForProject;
        getEncryptionStatus: typeof getEncryptionStatus;
        enableEncryptionForAllProjects: typeof enableEncryptionForAllProjects;
    };
}

if (typeof window !== 'undefined') {
    (window as WindowWithEncryptionMigration).encryptionMigration = {
        setupEncryption,
        enableEncryptionForProject,
        disableEncryptionForProject,
        getEncryptionStatus,
        enableEncryptionForAllProjects,
    };
}
