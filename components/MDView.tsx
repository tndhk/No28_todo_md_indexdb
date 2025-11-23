'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { fetchRawMarkdown, saveRawMarkdown, getErrorMessage } from '@/lib/api-indexeddb';
import styles from './MDView.module.css';

interface MDViewProps {
    projectId: string;
    onSaveSuccess: () => void;
    onError: (message: string) => void;
}

interface EditorState {
    content: string;
    saving: boolean;
    hasUnsavedChanges: boolean;
}

const Editor = memo(({ state, onContentChange, onKeyDown, textareaRef }: {
    state: EditorState;
    onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) => (
    <textarea
        ref={textareaRef}
        className={styles.editor}
        value={state.content}
        onChange={onContentChange}
        onKeyDown={onKeyDown}
        spellCheck={false}
        placeholder="Start writing your Markdown..."
    />
), (prevProps, nextProps) => {
    // Custom comparison: only rerender if content changes
    return prevProps.state.content === nextProps.state.content &&
           prevProps.onContentChange === nextProps.onContentChange &&
           prevProps.onKeyDown === nextProps.onKeyDown;
});
Editor.displayName = 'Editor';

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
            console.log('[MDView] Loading content for projectId:', projectId);
            try {
                const rawContent = await fetchRawMarkdown(projectId);
                if (isMounted) {
                    setContent(rawContent);
                    setOriginalContent(rawContent);
                    setHasUnsavedChanges(false);
                }
            } catch (error) {
                if (isMounted) {
                    console.error('[MDView] Error loading content:', error);
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

        // Set new debounce for autosave (5000ms)
        debounceRef.current = setTimeout(() => {
            saveContent(newContent);
        }, 5000);
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

    const editorState: EditorState = useMemo(() => ({
        content,
        saving,
        hasUnsavedChanges,
    }), [content, saving, hasUnsavedChanges]);

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
            <Editor
                state={editorState}
                onContentChange={handleContentChange}
                onKeyDown={handleKeyDown}
                textareaRef={textareaRef}
            />
        </div>
    );
}

MDView.displayName = 'MDView';
