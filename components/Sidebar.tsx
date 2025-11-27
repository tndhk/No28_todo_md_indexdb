'use client';

import { useState } from 'react';
import { Project } from '@/lib/types';
import { FileText, LayoutList, Calendar, Code, Plus, Menu, X } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    projects: Project[];
    currentView: 'tree' | 'weekly' | 'md';
    currentProjectId?: string;
    onViewChange: (view: 'tree' | 'weekly' | 'md') => void;
    onProjectSelect: (projectId: string) => void;
    onCreateProject: () => void;
    onProjectTitleUpdate: (projectId: string, newTitle: string) => Promise<void>;
}

export default function Sidebar({
    projects,
    currentView,
    currentProjectId,
    onViewChange,
    onProjectSelect,
    onCreateProject,
    onProjectTitleUpdate,
}: SidebarProps) {
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleDoubleClick = (project: Project) => {
        setEditingProjectId(project.id);
        setEditingTitle(project.title);
    };

    const handleSave = async () => {
        if (!editingProjectId || isSubmitting) return;

        const trimmedTitle = editingTitle.trim();
        if (!trimmedTitle) {
            // Cancel if empty
            setEditingProjectId(null);
            return;
        }

        setIsSubmitting(true);
        try {
            await onProjectTitleUpdate(editingProjectId, trimmedTitle);
            setEditingProjectId(null);
        } catch (error) {
            console.error('Failed to update project title:', error);
            // Keep editing mode open on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setEditingProjectId(null);
        setEditingTitle('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    return (
        <>
            <button
                className={styles.mobileMenuButton}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {isMobileMenuOpen && (
                <div
                    className={styles.mobileOverlay}
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Momentum</h1>
                </div>

                <nav className={styles.nav}>
                <div className={styles.navSection}>
                    <h2 className={styles.navTitle}>Views</h2>
                    <button
                        className={`${styles.navItem} ${currentView === 'tree' ? styles.active : ''}`}
                        onClick={() => {
                            onViewChange('tree');
                            setIsMobileMenuOpen(false);
                        }}
                    >
                        <LayoutList size={18} />
                        <span>Tree</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${currentView === 'weekly' ? styles.active : ''}`}
                        onClick={() => {
                            onViewChange('weekly');
                            setIsMobileMenuOpen(false);
                        }}
                    >
                        <Calendar size={18} />
                        <span>Calendar</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${currentView === 'md' ? styles.active : ''}`}
                        onClick={() => {
                            onViewChange('md');
                            setIsMobileMenuOpen(false);
                        }}
                    >
                        <Code size={18} />
                        <span>Markdown</span>
                    </button>
                </div>

                <div className={styles.navSection}>
                    <div className={styles.navSectionHeader}>
                        <h2 className={styles.navTitle}>Projects</h2>
                        <button
                            className={styles.addButton}
                            onClick={onCreateProject}
                            title="Create new project"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className={`${styles.navItem} ${currentProjectId === project.id ? styles.active : ''}`}
                        >
                            <FileText size={18} />
                            {editingProjectId === project.id ? (
                                <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={handleKeyDown}
                                    disabled={isSubmitting}
                                    autoFocus
                                    className={styles.editInput}
                                    maxLength={100}
                                />
                            ) : (
                                <span
                                    onClick={() => {
                                        onProjectSelect(project.id);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    onDoubleClick={() => handleDoubleClick(project)}
                                    className={styles.projectTitle}
                                >
                                    {project.title}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </nav>
        </aside>
        </>
    );
}
