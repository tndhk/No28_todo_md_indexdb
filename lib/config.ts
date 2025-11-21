import fs from 'fs';
import path from 'path';

/**
 * Configuration validation errors
 */
export class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Application configuration interface
 */
export interface AppConfig {
    /** Directory where markdown data files are stored */
    dataDir: string;
    /** File encoding for reading/writing files */
    fileEncoding: BufferEncoding;
    /** Number of spaces per indentation level for nested tasks */
    indentSpaces: number;
    /** Valid task statuses */
    validStatuses: readonly string[];
    /** Due date format regex pattern */
    dueDatePattern: RegExp;
    /** Maximum content length for tasks */
    maxContentLength: number;
    /** Maximum project ID length */
    maxProjectIdLength: number;
}

/**
 * Load and validate a single environment variable
 */
function getEnvVar(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * Load and validate a numeric environment variable
 */
function getNumericEnvVar(key: string, defaultValue: number, min?: number, max?: number): number {
    const value = process.env[key];
    if (!value) {
        return defaultValue;
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new ConfigurationError(
            `Invalid value for ${key}: "${value}" is not a valid number`
        );
    }

    if (min !== undefined && parsed < min) {
        throw new ConfigurationError(
            `Invalid value for ${key}: ${parsed} is less than minimum ${min}`
        );
    }

    if (max !== undefined && parsed > max) {
        throw new ConfigurationError(
            `Invalid value for ${key}: ${parsed} is greater than maximum ${max}`
        );
    }

    return parsed;
}

/**
 * Validate the data directory exists and is accessible
 */
function validateDataDir(dataDir: string): void {
    const resolvedPath = path.resolve(dataDir);

    // Create directory if it doesn't exist
    if (!fs.existsSync(resolvedPath)) {
        try {
            fs.mkdirSync(resolvedPath, { recursive: true });
        } catch (error) {
            throw new ConfigurationError(
                `Failed to create data directory "${resolvedPath}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    // Check if it's a directory
    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
        throw new ConfigurationError(
            `DATA_DIR "${resolvedPath}" exists but is not a directory`
        );
    }

    // Check read/write permissions
    try {
        fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
        throw new ConfigurationError(
            `DATA_DIR "${resolvedPath}" is not readable/writable`
        );
    }
}

/**
 * Validate file encoding is supported
 */
function validateFileEncoding(encoding: string): BufferEncoding {
    const validEncodings: BufferEncoding[] = [
        'utf-8', 'utf8', 'ascii', 'utf16le', 'ucs2', 'ucs-2',
        'base64', 'latin1', 'binary', 'hex'
    ];

    if (!validEncodings.includes(encoding as BufferEncoding)) {
        throw new ConfigurationError(
            `Invalid FILE_ENCODING "${encoding}". Valid options: ${validEncodings.join(', ')}`
        );
    }

    return encoding as BufferEncoding;
}

/**
 * Load and validate all configuration from environment variables
 */
function loadConfig(): AppConfig {
    // Load raw values from environment
    const dataDirRaw = getEnvVar('DATA_DIR', path.join(process.cwd(), 'data'));
    const fileEncodingRaw = getEnvVar('FILE_ENCODING', 'utf-8');
    const indentSpaces = getNumericEnvVar('INDENT_SPACES', 4, 1, 8);
    const maxContentLength = getNumericEnvVar('MAX_CONTENT_LENGTH', 500, 10, 10000);
    const maxProjectIdLength = getNumericEnvVar('MAX_PROJECT_ID_LENGTH', 100, 1, 500);

    // Resolve and validate data directory (skip validation in Supabase-only mode)
    const dataDir = path.resolve(dataDirRaw);
    const useSupabase = process.env.USE_SUPABASE === 'true';
    if (!useSupabase) {
        validateDataDir(dataDir);
    }

    // Validate file encoding
    const fileEncoding = validateFileEncoding(fileEncodingRaw);

    return {
        dataDir,
        fileEncoding,
        indentSpaces,
        validStatuses: ['todo', 'doing', 'done'] as const,
        dueDatePattern: /^\d{4}-\d{2}-\d{2}$/,
        maxContentLength,
        maxProjectIdLength,
    };
}

// Export singleton config instance
// Note: Config is loaded once at module initialization
let _config: AppConfig | null = null;

/**
 * Get the application configuration
 * Configuration is loaded and validated once on first access
 */
export function getConfig(): AppConfig {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
    _config = null;
}

/**
 * Validate configuration without loading it into the singleton
 * Useful for checking configuration before application startup
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
        loadConfig();
    } catch (error) {
        if (error instanceof ConfigurationError) {
            errors.push(error.message);
        } else {
            errors.push(`Unknown configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// Export individual config values for convenience
export const config = new Proxy({} as AppConfig, {
    get(_, prop: keyof AppConfig) {
        return getConfig()[prop];
    },
});
