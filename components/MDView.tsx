'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchRawMarkdown, saveRawMarkdown, getErrorMessage } from '@/lib/api';
import styles from './MDView.module.css';

interface MDViewProps {
    projectId: string;
    onSaveSuccess: () => void;
    onError: (message: string) => void;
}

export default function MDView({ projectId, onSaveSuccess, onError }: MDViewProps) {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load content when project changes
    useEffect(() => {
        let isMounted = true;

        async function loadContent() {
            setLoading(true);
            try {
                const rawContent = await fetchRawMarkdown(projectId);
                if (isMounted) {
                    setContent(rawContent);
                    setOriginalContent(rawContent);
                    setHasUnsavedChanges(false);
                }
            } catch (error) {
                if (isMounted) {
                    onError(getErrorMessage(error));
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadContent();

        return () => {
            isMounted = false;
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [projectId, onError]);

    // Save function
    const saveContent = useCallback(async (contentToSave: string) => {
        if (contentToSave === originalContent) {
            setHasUnsavedChanges(false);
            return;
        }

        setSaving(true);
        try {
            await saveRawMarkdown(projectId, contentToSave);
            setOriginalContent(contentToSave);
            setHasUnsavedChanges(false);
            onSaveSuccess();
        } catch (error) {
            onError(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    }, [projectId, originalContent, onSaveSuccess, onError]);

    // Handle content change with debounced autosave
    const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        setHasUnsavedChanges(newContent !== originalContent);

        // Clear existing debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Set new debounce for autosave (400ms)
        debounceRef.current = setTimeout(() => {
            saveContent(newContent);
        }, 400);
    }, [originalContent, saveContent]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl/Cmd + S to save immediately
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            saveContent(content);
        }
    }, [content, saveContent]);

    if (loading) {
        return (
            <div className={styles.mdView}>
                <div className={styles.loadingContainer}>
                    <span className={styles.loadingText}>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.mdView}>
            <div className={styles.header}>
                <div className={styles.statusIndicator}>
                    {saving && (
                        <span className={styles.savingStatus}>Saving...</span>
                    )}
                    {!saving && hasUnsavedChanges && (
                        <span className={styles.unsavedStatus}>Unsaved changes</span>
                    )}
                    {!saving && !hasUnsavedChanges && (
                        <span className={styles.savedStatus}>Saved</span>
                    )}
                </div>
                <div className={styles.hint}>
                    <kbd>Ctrl</kbd> + <kbd>S</kbd> to save immediately
                </div>
            </div>
            <textarea
                ref={textareaRef}
                className={styles.editor}
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                placeholder="Start writing your Markdown..."
            />
        </div>
    );
}

MDView.displayName = 'MDView';
