'use client';

import { useEffect, useState, useCallback } from 'react';
import { Project, Task, TaskStatus } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import TreeView from '@/components/TreeView';
import WeeklyView from '@/components/WeeklyView';
import AddTaskModal from '@/components/AddTaskModal';
import Toast, { ToastMessage, ToastType } from '@/components/Toast';
import { triggerConfetti } from '@/lib/confetti';
import styles from './page.module.css';

type ViewType = 'tree' | 'weekly';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('tree');
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalParentTask, setModalParentTask] = useState<Task | undefined>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load projects');
      }
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !currentProjectId) {
        setCurrentProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to load projects');
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to toggle task');
      }

      await loadProjects();
      if (newStatus === 'done') {
        triggerConfetti();
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to toggle task');
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete task');
      }

      await loadProjects();
      showToast('success', 'Task deleted successfully');
    } catch (error) {
      console.error('Failed to delete task:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to delete task');
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      await loadProjects();
    } catch (error) {
      console.error('Failed to update task:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to update task');
    }
  };

  const handleTaskReorder = async (newTasks: Task[]) => {
    if (!currentProjectId) return;

    // Optimistic update (optional, but good for UX)
    // For now, we'll just call the API

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          projectId: currentProjectId,
          tasks: newTasks
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to reorder tasks');
      }

      await loadProjects();
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to reorder tasks');
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add task');
      }

      await loadProjects();
      showToast('success', 'Task added successfully');
    } catch (error) {
      console.error('Failed to add task:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to add task');
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
              onTaskReorder={handleTaskReorder}
            />
          )}
          {currentView === 'weekly' && currentProject && (
            <WeeklyView
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

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
