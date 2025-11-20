import { z } from 'zod';

/**
 * Zod schemas for API response validation
 * These schemas mirror the TypeScript types in lib/types.ts
 * and provide runtime type validation for API responses
 */

// Task status enum schema
export const TaskStatusSchema = z.enum(['todo', 'doing', 'done']);

// Base task schema (without subtasks for recursive definition)
const BaseTaskSchema = z.object({
    id: z.string(),
    content: z.string(),
    status: TaskStatusSchema,
    dueDate: z.string().optional(),
    parentId: z.string().optional(),
    parentContent: z.string().optional(),
    rawLine: z.string(),
    lineNumber: z.number().int().positive(),
});

// Recursive task schema with subtasks
export type TaskSchema = z.infer<typeof BaseTaskSchema> & {
    subtasks: TaskSchema[];
};

export const TaskSchema: z.ZodType<TaskSchema> = BaseTaskSchema.extend({
    subtasks: z.lazy(() => z.array(TaskSchema)),
});

// Project schema
export const ProjectSchema = z.object({
    id: z.string(),
    title: z.string(),
    tasks: z.array(TaskSchema),
    path: z.string(),
});

// Array of projects (main API response)
export const ProjectsArraySchema = z.array(ProjectSchema);

// Error response schema
export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// API response types
export type ValidatedTask = z.infer<typeof TaskSchema>;
export type ValidatedProject = z.infer<typeof ProjectSchema>;
export type ValidatedProjectsArray = z.infer<typeof ProjectsArraySchema>;
export type ValidatedErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Custom validation error class for API responses
 */
export class ApiValidationError extends Error {
    public readonly issues: z.ZodIssue[];

    constructor(error: z.ZodError) {
        const message = `API response validation failed: ${error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', ')}`;
        super(message);
        this.name = 'ApiValidationError';
        this.issues = error.issues;
    }
}

/**
 * Validates API response data against the projects array schema
 * @throws {ApiValidationError} if validation fails
 */
export function validateProjectsResponse(data: unknown): ValidatedProjectsArray {
    const result = ProjectsArraySchema.safeParse(data);
    if (!result.success) {
        throw new ApiValidationError(result.error);
    }
    return result.data;
}

/**
 * Validates API error response
 * @returns validated error response or null if not an error response
 */
export function parseErrorResponse(data: unknown): ValidatedErrorResponse | null {
    const result = ErrorResponseSchema.safeParse(data);
    return result.success ? result.data : null;
}
