'use client';

import { useEffect, useState } from 'react';
import { Project, Task, TaskStatus } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import TreeView from '@/components/TreeView';
import WeeklyView from '@/components/WeeklyView';
import KanbanView from '@/components/KanbanView';
import AddTaskModal from '@/components/AddTaskModal';
import styles from './page.module.css';

type ViewType = 'tree' | 'weekly' | 'kanban';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('tree');
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalParentTask, setModalParentTask] = useState<Task | undefined>();

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !currentProjectId) {
        setCurrentProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleTaskToggle = async (task: Task) => {
    if (!currentProjectId) return;

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateTask',
          projectId: currentProjectId,
          task: { lineNumber: task.lineNumber },
          updates: {
            status: newStatus,
          },
        }),
      });

      if (res.ok) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleTaskDelete = async (task: Task) => {
    if (!currentProjectId || !confirm('Are you sure you want to delete this task?')) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          projectId: currentProjectId,
          task: { lineNumber: task.lineNumber },
        }),
      });

      if (res.ok) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleTaskAdd = (parentTask?: Task) => {
    setModalParentTask(parentTask);
    setIsModalOpen(true);
  };

  const handleTaskUpdate = async (task: Task, updates: Partial<Task>) => {
    if (!currentProjectId) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateTask',
          projectId: currentProjectId,
          task: { lineNumber: task.lineNumber },
          updates: {
            content: updates.content,
            dueDate: updates.dueDate,
            status: updates.status,
          },
        }),
      });

      if (res.ok) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleModalAdd = async (content: string, status: TaskStatus, dueDate?: string) => {
    if (!currentProjectId) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          projectId: currentProjectId,
          content,
          status,
          dueDate,
          parentLineNumber: modalParentTask?.lineNumber,
        }),
      });

      if (res.ok) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  if (loading) {
    return (
      <main className={styles.loading}>
        <h1 className="animate-fade-in">Loading your workspace...</h1>
      </main>
    );
  }

  return (
    <div className={styles.container}>
      <Sidebar
        projects={projects}
        currentView={currentView}
        currentProjectId={currentProjectId}
        onViewChange={setCurrentView}
        onProjectSelect={setCurrentProjectId}
      />

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.projectTitle}>
            {currentProject?.title || 'Select a project'}
          </h1>
        </header>

        <div className={styles.content}>
          {currentView === 'tree' && currentProject && (
            <TreeView
              tasks={currentProject.tasks}
              onTaskToggle={handleTaskToggle}
              onTaskDelete={handleTaskDelete}
              onTaskAdd={handleTaskAdd}
              onTaskUpdate={handleTaskUpdate}
            />
          )}
          {currentView === 'weekly' && currentProject && (
            <WeeklyView
              tasks={currentProject.tasks}
              onTaskUpdate={handleTaskUpdate}
            />
          )}
          {currentView === 'kanban' && currentProject && (
            <KanbanView
              tasks={currentProject.tasks}
              onTaskUpdate={handleTaskUpdate}
            />
          )}
        </div>
      </main>

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalParentTask(undefined);
        }}
        onAdd={handleModalAdd}
        isSubtask={!!modalParentTask}
      />
    </div>
  );
}
