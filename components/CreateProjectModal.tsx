'use client';

import { useState } from 'react';
import styles from './AddTaskModal.module.css'; // Reuse existing modal styles

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (title: string) => Promise<void>;
}

export default function CreateProjectModal({
    isOpen,
    onClose,
    onSubmit,
}: CreateProjectModalProps) {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setError('Project title is required');
            return;
        }

        if (trimmedTitle.length > 100) {
            setError('Project title is too long (max 100 characters)');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit(trimmedTitle);
            setTitle('');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setTitle('');
            setError(null);
            onClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h2 className={styles.title}>Create New Project</h2>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label htmlFor="project-title">Project Title</label>
                        <input
                            id="project-title"
                            type="text"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                setError(null);
                            }}
                            placeholder="Enter project name..."
                            autoFocus
                            disabled={isSubmitting}
                            className={styles.input}
                            maxLength={100}
                        />
                        {error && (
                            <div style={{
                                color: 'var(--error, #ef4444)',
                                fontSize: '0.875rem',
                                marginTop: '0.5rem'
                            }}>
                                {error}
                            </div>
                        )}
                    </div>

                    <div className={styles.actions}>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className={styles.cancelButton}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={styles.submitButton}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
