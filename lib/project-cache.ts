/**
 * In-memory cache for parsed projects
 * @optimization Reduces file I/O by caching parsed markdown projects
 */

import { Project } from './types';

interface CacheEntry {
    project: Project;
    timestamp: number;
}

/**
 * Simple in-memory LRU cache for projects
 */
class ProjectCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly maxSize: number;
    private readonly ttlMs: number;

    /**
     * @param maxSize Maximum number of projects to cache (default: 100)
     * @param ttlMs Time-to-live in milliseconds (default: 5 minutes)
     */
    constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    /**
     * Generate cache key from dataDir and projectId
     */
    private getCacheKey(dataDir: string, projectId: string): string {
        return `${dataDir}:${projectId}`;
    }

    /**
     * Get a project from cache
     * @returns Project if found and not expired, null otherwise
     */
    get(dataDir: string, projectId: string): Project | null {
        const key = this.getCacheKey(dataDir, projectId);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if entry is expired
        const now = Date.now();
        if (now - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        return entry.project;
    }

    /**
     * Set a project in cache
     */
    set(dataDir: string, projectId: string, project: Project): void {
        const key = this.getCacheKey(dataDir, projectId);

        // Implement simple LRU eviction
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            project,
            timestamp: Date.now(),
        });
    }

    /**
     * Invalidate a specific project from cache
     * Call this after mutations (add, update, delete tasks)
     */
    invalidate(dataDir: string, projectId: string): void {
        const key = this.getCacheKey(dataDir, projectId);
        this.cache.delete(key);
    }

    /**
     * Invalidate all projects in a specific directory
     */
    invalidateAll(dataDir: string): void {
        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${dataDir}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => this.cache.delete(key));
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxSize: number; ttlMs: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttlMs: this.ttlMs,
        };
    }
}

// Singleton instance
// For file-based mode: 5 minute TTL (files can change externally)
// Max 100 projects in cache
export const projectCache = new ProjectCache(100, 5 * 60 * 1000);

/**
 * Helper to wrap project fetching with cache
 */
export async function getCachedProject(
    dataDir: string,
    projectId: string,
    fetchFn: () => Promise<Project | null>
): Promise<Project | null> {
    // Try cache first
    const cached = projectCache.get(dataDir, projectId);
    if (cached) {
        return cached;
    }

    // Fetch from source
    const project = await fetchFn();
    if (project) {
        projectCache.set(dataDir, projectId, project);
    }

    return project;
}
