/**
 * Generates a unique project ID from a title
 * @param title - The project title
 * @returns A URL-safe, unique project ID
 */
export function generateProjectId(title: string): string {
    // Create slug from title: lowercase, replace spaces with hyphens, remove special chars
    const slug = title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')        // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '')  // Remove special characters
        .replace(/-+/g, '-')         // Replace multiple hyphens with single
        .replace(/^-|-$/g, '')       // Remove leading/trailing hyphens
        .substring(0, 50);           // Limit length

    // Add timestamp for uniqueness
    const timestamp = Date.now();

    // Combine slug and timestamp
    return slug ? `${slug}-${timestamp}` : `project-${timestamp}`;
}

/**
 * Sanitizes a project title for safe use in filenames
 * @param title - The project title to sanitize
 * @returns A sanitized title safe for filenames
 */
export function sanitizeFilename(title: string): string {
    return title
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid filename characters
        .replace(/\s+/g, '_')                   // Replace spaces with underscores
        .substring(0, 100);                     // Limit length
}
