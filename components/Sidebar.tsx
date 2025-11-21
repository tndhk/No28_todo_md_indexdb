'use client';

import { Project } from '@/lib/types';
import { FileText, LayoutList, Calendar, Code, Plus } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    projects: Project[];
    currentView: 'tree' | 'weekly' | 'md';
    currentProjectId?: string;
    onViewChange: (view: 'tree' | 'weekly' | 'md') => void;
    onProjectSelect: (projectId: string) => void;
    onCreateProject: () => void;
}

export default function Sidebar({
    projects,
    currentView,
    currentProjectId,
    onViewChange,
    onProjectSelect,
    onCreateProject,
}: SidebarProps) {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <h1 className={styles.title}>Markdown Todo</h1>
            </div>

            <nav className={styles.nav}>
                <div className={styles.navSection}>
                    <h2 className={styles.navTitle}>Views</h2>
                    <button
                        className={`${styles.navItem} ${currentView === 'tree' ? styles.active : ''}`}
                        onClick={() => onViewChange('tree')}
                    >
                        <LayoutList size={18} />
                        <span>Tree</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${currentView === 'weekly' ? styles.active : ''}`}
                        onClick={() => onViewChange('weekly')}
                    >
                        <Calendar size={18} />
                        <span>Calendar</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${currentView === 'md' ? styles.active : ''}`}
                        onClick={() => onViewChange('md')}
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
                        <button
                            key={project.id}
                            className={`${styles.navItem} ${currentProjectId === project.id ? styles.active : ''}`}
                            onClick={() => onProjectSelect(project.id)}
                        >
                            <FileText size={18} />
                            <span>{project.title}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </aside>
    );
}
