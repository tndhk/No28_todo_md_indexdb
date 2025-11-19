'use client';

import { Project } from '@/lib/types';
import { FileText, LayoutList, Calendar } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    projects: Project[];
    currentView: 'tree' | 'weekly';
    currentProjectId?: string;
    onViewChange: (view: 'tree' | 'weekly') => void;
    onProjectSelect: (projectId: string) => void;
}

export default function Sidebar({
    projects,
    currentView,
    currentProjectId,
    onViewChange,
    onProjectSelect,
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
                        <span>Projects</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${currentView === 'weekly' ? styles.active : ''}`}
                        onClick={() => onViewChange('weekly')}
                    >
                        <Calendar size={18} />
                        <span>Weekly</span>
                    </button>
                </div>

                <div className={styles.navSection}>
                    <h2 className={styles.navTitle}>Projects</h2>
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
