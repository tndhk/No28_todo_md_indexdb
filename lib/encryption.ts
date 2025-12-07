/**
 * Client-side encryption utilities using Web Crypto API
 * Implements AES-GCM encryption with PBKDF2 key derivation
 *
 * @security End-to-End Encryption (E2EE)
 * - Data is encrypted before being stored in IndexedDB
 * - Data is encrypted before being synced to Supabase
 * - Only the user with the correct password can decrypt the data
 * - Even if the database is compromised, data remains secure
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100000; // OWASP recommendation for 2024
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits (recommended for AES-GCM)

/**
 * Encrypted data structure
 */
export interface EncryptedData {
    ciphertext: string; // Base64 encoded
    iv: string; // Base64 encoded
    salt: string; // Base64 encoded
}

/**
 * In-memory key storage (cleared on page refresh)
 * For production, consider using sessionStorage for persistence during session
 */
let masterPassword: string | null = null;

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a cryptographically secure random IV (Initialization Vector)
 */
function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive a cryptographic key from a password using PBKDF2
 * @param password User's password
 * @param salt Random salt for key derivation
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    // Derive AES-GCM key using PBKDF2
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        {
            name: ALGORITHM,
            length: KEY_LENGTH,
        },
        false, // Not extractable for security
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data using AES-GCM
 * @param data Plain text data to encrypt
 * @param password User's password (optional, uses master password if not provided)
 */
export async function encryptData(data: string, password?: string): Promise<EncryptedData> {
    if (typeof window === 'undefined') {
        throw new Error('Encryption is only available in browser environment');
    }

    const pwd = password || masterPassword;
    if (!pwd) {
        throw new Error('No encryption password provided. Please set a master password first.');
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate random salt and IV
    const salt = generateSalt();
    const iv = generateIV();

    // Derive encryption key
    const key = await deriveKey(pwd, salt);

    // Encrypt data
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: ALGORITHM,
            iv: iv as BufferSource,
        },
        key,
        dataBuffer
    );

    // Convert to base64 for storage
    return {
        ciphertext: arrayBufferToBase64(ciphertext),
        iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
        salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    };
}

/**
 * Decrypt data using AES-GCM
 * @param encryptedData Encrypted data structure
 * @param password User's password (optional, uses master password if not provided)
 */
export async function decryptData(encryptedData: EncryptedData, password?: string): Promise<string> {
    if (typeof window === 'undefined') {
        throw new Error('Decryption is only available in browser environment');
    }

    const pwd = password || masterPassword;
    if (!pwd) {
        throw new Error('No decryption password provided. Please set a master password first.');
    }

    // Convert from base64
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = base64ToArrayBuffer(encryptedData.iv);
    const salt = base64ToArrayBuffer(encryptedData.salt);

    // Derive decryption key (same process as encryption)
    const key = await deriveKey(pwd, new Uint8Array(salt));

    // Decrypt data
    try {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: ALGORITHM,
                iv: new Uint8Array(iv) as BufferSource,
            },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (_error) {
        throw new Error('Decryption failed. Incorrect password or corrupted data.');
    }
}

/**
 * Set the master password for encryption/decryption
 * This password is kept in memory and used for all subsequent operations
 * @param password Master password
 */
export function setMasterPassword(password: string): void {
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    masterPassword = password;
}

/**
 * Get the current master password (for debugging only)
 * @returns Current master password or null
 */
export function getMasterPassword(): string | null {
    return masterPassword;
}

/**
 * Clear the master password from memory
 */
export function clearMasterPassword(): void {
    masterPassword = null;
}

/**
 * Check if a master password is set
 */
export function hasMasterPassword(): boolean {
    return masterPassword !== null;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Check if data is encrypted
 * @param data Data to check (should be a JSON string of EncryptedData)
 */
export function isEncrypted(data: unknown): data is EncryptedData {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
        typeof obj.ciphertext === 'string' &&
        typeof obj.iv === 'string' &&
        typeof obj.salt === 'string'
    );
}

/**
 * Validate password strength
 * @param password Password to validate
 * @returns Validation result with strength score
 */
export function validatePasswordStrength(password: string): {
    valid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    errors: string[];
} {
    const errors: string[] = [];
    let strength: 'weak' | 'medium' | 'strong' = 'weak';

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (password.length < 12) {
        strength = 'weak';
    } else if (password.length < 16) {
        strength = 'medium';
    } else {
        strength = 'strong';
    }

    // Check complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[^A-Za-z0-9]/.test(password);

    const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;

    if (complexityCount < 3) {
        errors.push('Password should include uppercase, lowercase, numbers, and special characters');
        strength = 'weak';
    }

    return {
        valid: errors.length === 0,
        strength,
        errors,
    };
}

/**
 * Store encrypted password hint in localStorage (optional)
 * This is NOT the password itself, just a hint for the user
 */
export function setPasswordHint(hint: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('encryption-password-hint', hint);
}

/**
 * Get password hint from localStorage
 */
export function getPasswordHint(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('encryption-password-hint');
}

/**
 * Clear password hint from localStorage
 */
export function clearPasswordHint(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('encryption-password-hint');
}
