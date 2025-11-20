'use client';

import { useEffect, useState, useCallback } from 'react';
import { Project, Task, TaskStatus } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import TreeView from '@/components/TreeView';
import WeeklyView from '@/components/WeeklyView';
import AddTaskModal from '@/components/AddTaskModal';
import Toast, { ToastMessage, ToastType } from '@/components/Toast';
import { triggerConfetti } from '@/lib/confetti';
import {
  fetchProjects,
  addTask as apiAddTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  reorderTasks as apiReorderTasks,
  getErrorMessage,
} from '@/lib/api';
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

  // Helper function to update task status recursively
  const updateTaskInTree = useCallback((tasks: Task[], taskId: string, updates: Partial<Task>): Task[] => {
    return tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, ...updates };
      }
      if (task.subtasks.length > 0) {
        return { ...task, subtasks: updateTaskInTree(task.subtasks, taskId, updates) };
      }
      return task;
    });
  }, []);

  // Helper function to delete task from tree recursively
  const deleteTaskFromTree = useCallback((tasks: Task[], taskId: string): Task[] => {
    return tasks
      .filter(task => task.id !== taskId)
      .map(task => {
        if (task.subtasks.length > 0) {
          return { ...task, subtasks: deleteTaskFromTree(task.subtasks, taskId) };
        }
        return task;
      });
  }, []);

  // Helper function to update current project's tasks
  const updateCurrentProjectTasks = useCallback((updater: (tasks: Task[]) => Task[]) => {
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return { ...project, tasks: updater(project.tasks) };
      }
      return project;
    }));
  }, [currentProjectId]);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length > 0 && !currentProjectId) {
        setCurrentProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      showToast('error', getErrorMessage(error));
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
    const previousProjects = projects;

    // Optimistic update - immediately update UI
    updateCurrentProjectTasks(tasks => updateTaskInTree(tasks, task.id, { status: newStatus }));

    if (newStatus === 'done') {
      triggerConfetti();
    }

    try {
      const updatedProjects = await apiUpdateTask(currentProjectId, task.lineNumber, {
        status: newStatus,
      });
      setProjects(updatedProjects);
    } catch (error) {
      // Rollback on error
      setProjects(previousProjects);
      console.error('Failed to toggle task:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskDelete = async (task: Task) => {
    if (!currentProjectId || !confirm('Are you sure you want to delete this task?')) return;

    const previousProjects = projects;

    // Optimistic update - immediately remove from UI
    updateCurrentProjectTasks(tasks => deleteTaskFromTree(tasks, task.id));

    try {
      const updatedProjects = await apiDeleteTask(currentProjectId, task.lineNumber);
      setProjects(updatedProjects);
      showToast('success', 'Task deleted successfully');
    } catch (error) {
      // Rollback on error
      setProjects(previousProjects);
      console.error('Failed to delete task:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskAdd = (parentTask?: Task) => {
    setModalParentTask(parentTask);
    setIsModalOpen(true);
  };

  const handleTaskUpdate = async (task: Task, updates: Partial<Task>) => {
    if (!currentProjectId) return;

    try {
      const updatedProjects = await apiUpdateTask(currentProjectId, task.lineNumber, {
        content: updates.content,
        dueDate: updates.dueDate,
        status: updates.status,
      });
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Failed to update task:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskReorder = async (newTasks: Task[]) => {
    if (!currentProjectId) return;

    const previousProjects = projects;

    // Optimistic update - immediately update UI with new order
    updateCurrentProjectTasks(() => newTasks);

    try {
      const updatedProjects = await apiReorderTasks(currentProjectId, newTasks);
      setProjects(updatedProjects);
    } catch (error) {
      // Rollback on error
      setProjects(previousProjects);
      console.error('Failed to reorder tasks:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleModalAdd = async (content: string, status: TaskStatus, dueDate?: string) => {
    if (!currentProjectId) return;

    try {
      const updatedProjects = await apiAddTask(
        currentProjectId,
        content,
        status,
        dueDate,
        modalParentTask?.lineNumber
      );
      setProjects(updatedProjects);
      showToast('success', 'Task added successfully');
    } catch (error) {
      console.error('Failed to add task:', error);
      showToast('error', getErrorMessage(error));
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
