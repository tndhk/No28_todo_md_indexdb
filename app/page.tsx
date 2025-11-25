'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Project, Task, TaskStatus, RepeatFrequency, Group } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import TreeView from '@/components/TreeView';
import WeeklyView from '@/components/WeeklyView';
import MDView from '@/components/MDView';
import AddTaskModal from '@/components/AddTaskModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import Toast, { ToastMessage, ToastType } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { triggerConfetti } from '@/lib/confetti';
import {
  fetchProjects,
  createProject,
  updateProjectTitle,
  addTask as apiAddTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  reorderTasks as apiReorderTasks,
  updateGroup as apiUpdateGroup,
  deleteGroup as apiDeleteGroup,
  moveTaskToParent as apiMoveTaskToParent,
  moveTaskToGroup as apiMoveTaskToGroup,
  getErrorMessage,
} from '@/lib/api-indexeddb';
import styles from './page.module.css';

type ViewType = 'tree' | 'weekly' | 'md';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('tree');
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>();
  const [currentGroupId, setCurrentGroupId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [modalParentTask, setModalParentTask] = useState<Task | undefined>();
  const [modalGroupId, setModalGroupId] = useState<string | undefined>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hideDoneTasks, setHideDoneTasks] = useState(false);

  // Load hideDoneTasks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('hideDoneTasks');
    if (saved !== null) {
      setHideDoneTasks(saved === 'true');
    }
  }, []);

  // Save hideDoneTasks to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('hideDoneTasks', hideDoneTasks.toString());
  }, [hideDoneTasks]);

  const showToast = useCallback((type: ToastType, message: string) => {
    // SECURITY & MAINTAINABILITY: Use crypto.randomUUID() instead of Math.random() and substr()
    const id = `${Date.now()}-${crypto.randomUUID()}`;
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

  // Helper function to filter out done tasks recursively
  const filterDoneTasks = useCallback((tasks: Task[]): Task[] => {
    return tasks
      .map(task => {
        // First, recursively filter subtasks
        if (task.subtasks.length > 0) {
          const filteredSubtasks = filterDoneTasks(task.subtasks);
          return { ...task, subtasks: filteredSubtasks };
        }
        return task;
      })
      .filter(task => {
        // Filter out done tasks that have no remaining subtasks
        if (task.status === 'done' && task.subtasks.length === 0) {
          return false;
        }
        return true;
      });
  }, []);

  // Helper function to update current group's tasks
  const updateCurrentGroupTasks = useCallback((updater: (tasks: Task[]) => Task[]) => {
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.map(group => {
            if (group.id === currentGroupId) {
              return { ...group, tasks: updater(group.tasks) };
            }
            return group;
          }),
        };
      }
      return project;
    }));
  }, [currentProjectId, currentGroupId]);

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length > 0) {
        setCurrentProjectId(prev => prev || data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      showToast('error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Set default group when project changes
  useEffect(() => {
    if (currentProject && currentProject.groups.length > 0) {
      setCurrentGroupId(prev => prev || currentProject.groups[0].id);
    }
  }, [currentProject]);

  const currentGroup = currentProject?.groups.find(g => g.id === currentGroupId);

  // Get all tasks from all groups for Calendar view
  const allProjectTasks = useMemo(() => {
    if (!currentProject) return [];

    const tasks: Task[] = [];
    currentProject.groups.forEach(group => {
      tasks.push(...group.tasks);
    });
    return tasks;
  }, [currentProject]);

  // Filter tasks based on hideDoneTasks state for Calendar view
  const displayTasks = useMemo(() => {
    return hideDoneTasks ? filterDoneTasks(allProjectTasks) : allProjectTasks;
  }, [allProjectTasks, hideDoneTasks]);

  // Filter groups based on hideDoneTasks state for Tree view
  const displayGroups = useMemo(() => {
    if (!currentProject) return [];

    return currentProject.groups.map(group => ({
      ...group,
      tasks: hideDoneTasks ? filterDoneTasks(group.tasks) : group.tasks,
    }));
  }, [currentProject, hideDoneTasks, filterDoneTasks]);

  // Helper function to move a task to the bottom of its sibling list
  const moveTaskToBottom = useCallback((tasks: Task[], taskId: string): Task[] => {
    // Helper to add task back at the bottom of its original level
    const addTaskAtBottom = (list: Task[], targetId: string): Task[] => {
      // Recursive map. If we find the list containing the task, reorder it.

      const containsTask = list.some(t => t.id === targetId);
      if (containsTask) {
        const task = list.find(t => t.id === targetId)!;
        const otherTasks = list.filter(t => t.id !== targetId);
        return [...otherTasks, task];
      }

      return list.map(t => {
        if (t.subtasks.length > 0) {
          return { ...t, subtasks: addTaskAtBottom(t.subtasks, targetId) };
        }
        return t;
      });
    };

    return addTaskAtBottom(tasks, taskId);
  }, []);

  const handleTaskToggle = async (task: Task) => {
    if (!currentProjectId || !currentGroupId) return;

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const previousProjects = projects;

    // Optimistic update
    updateCurrentGroupTasks(tasks => {
      // First update status
      let updatedTasks = updateTaskInTree(tasks, task.id, { status: newStatus });

      // If marking as done, move to bottom
      if (newStatus === 'done') {
        updatedTasks = moveTaskToBottom(updatedTasks, task.id);
      }

      return updatedTasks;
    });

    if (newStatus === 'done') {
      triggerConfetti();
    }

    try {
      // 1. Update status
      const updatedProjects = await apiUpdateTask(currentProjectId, task.lineNumber, {
        status: newStatus,
      }, task.id);

      // 2. If marked as done, we also need to persist the new order
      if (newStatus === 'done') {
        // We need the *reordered* tasks from the current state to save them
        // Since setProjects(updatedProjects) hasn't happened yet or is async,
        // we should calculate the reordered list based on the updatedProjects result
        // OR, simpler: use the optimistic state we just created.

        // Let's get the latest project state from the optimistic update
        // But wait, `updateCurrentGroupTasks` updates state, we can't access it immediately.
        // We need to replicate the logic locally.

        const project = updatedProjects.find(p => p.id === currentProjectId);
        if (project) {
          const group = project.groups.find(g => g.id === currentGroupId);
          if (group) {
            const reorderedTasks = moveTaskToBottom(group.tasks, task.id);
            const finalProjects = await apiReorderTasks(currentProjectId, currentGroupId, reorderedTasks);
            setProjects(finalProjects);
          } else {
            setProjects(updatedProjects);
          }
        } else {
          setProjects(updatedProjects);
        }
      } else {
        setProjects(updatedProjects);
      }
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
    updateCurrentGroupTasks(tasks => deleteTaskFromTree(tasks, task.id));

    try {
      const updatedProjects = await apiDeleteTask(currentProjectId, task.lineNumber, task.id);
      setProjects(updatedProjects);
      showToast('success', 'Task deleted successfully');
    } catch (error) {
      // Rollback on error
      setProjects(previousProjects);
      console.error('Failed to delete task:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskAdd = (parentTask?: Task, groupId?: string) => {
    setModalParentTask(parentTask);
    setModalGroupId(groupId || currentGroupId);
    setIsModalOpen(true);
  };

  const handleTaskUpdate = async (task: Task, updates: Partial<Task>) => {
    if (!currentProjectId) return;

    try {
      const updatedProjects = await apiUpdateTask(currentProjectId, task.lineNumber, {
        content: updates.content,
        dueDate: updates.dueDate,
        status: updates.status,
        repeatFrequency: updates.repeatFrequency,
      }, task.id);
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Failed to update task:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskReorder = async (groupId: string, newTasks: Task[]) => {
    if (!currentProjectId) return;

    const previousProjects = projects;

    // Optimistic update - immediately update UI with new order
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, tasks: newTasks };
            }
            return group;
          }),
        };
      }
      return project;
    }));

    try {
      const updatedProjects = await apiReorderTasks(currentProjectId, groupId, newTasks);
      setProjects(updatedProjects);
    } catch (error) {
      // Rollback on error
      setProjects(previousProjects);
      console.error('Failed to reorder tasks:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleGroupRename = async (groupId: string, newName: string) => {
    if (!currentProjectId) return;

    const previousProjects = projects;

    // Optimistic update
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, name: newName };
            }
            return group;
          }),
        };
      }
      return project;
    }));

    try {
      await apiUpdateGroup(currentProjectId, groupId, newName);
      showToast('success', 'Group renamed successfully');
    } catch (error) {
      setProjects(previousProjects);
      console.error('Failed to rename group:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleGroupDelete = async (groupId: string) => {
    if (!currentProjectId) return;

    const previousProjects = projects;

    // Optimistic update
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.filter(group => group.id !== groupId),
        };
      }
      return project;
    }));

    try {
      const updatedProjects = await apiDeleteGroup(currentProjectId, groupId);
      setProjects(updatedProjects);
      showToast('success', 'Group deleted successfully');
    } catch (error) {
      setProjects(previousProjects);
      console.error('Failed to delete group:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskMoveToParent = async (groupId: string, taskId: string, newParentId: string | null) => {
    if (!currentProjectId) return;

    const previousProjects = projects;

    // Optimistic update
    updateCurrentGroupTasks(tasks => {
      let newTasks = tasks;

      // Find and remove task from current location
      const findAndRemove = (tasksToSearch: Task[]): Task | null => {
        for (let i = 0; i < tasksToSearch.length; i++) {
          if (tasksToSearch[i].id === taskId) {
            const removed = tasksToSearch.splice(i, 1)[0];
            return removed;
          }
          if (tasksToSearch[i].subtasks.length > 0) {
            const found = findAndRemove(tasksToSearch[i].subtasks);
            if (found) return found;
          }
        }
        return null;
      };

      const movedTask = findAndRemove(newTasks);
      if (!movedTask) return newTasks;

      // Add to new parent or root
      if (newParentId) {
        const findParent = (tasksToSearch: Task[]): Task | null => {
          for (const task of tasksToSearch) {
            if (task.id === newParentId) return task;
            if (task.subtasks.length > 0) {
              const found = findParent(task.subtasks);
              if (found) return found;
            }
          }
          return null;
        };

        const parentTask = findParent(newTasks);
        if (parentTask) {
          movedTask.parentId = newParentId;
          movedTask.parentContent = parentTask.content;
          parentTask.subtasks.push(movedTask);
        }
      } else {
        movedTask.parentId = undefined;
        movedTask.parentContent = undefined;
        newTasks.push(movedTask);
      }

      return newTasks;
    });

    try {
      const updatedProjects = await apiMoveTaskToParent(currentProjectId, groupId, taskId, newParentId);
      setProjects(updatedProjects);
      showToast('success', 'Task moved successfully');
    } catch (error) {
      setProjects(previousProjects);
      console.error('Failed to move task to parent:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleTaskMoveToGroup = async (fromGroupId: string, toGroupId: string, taskId: string) => {
    if (!currentProjectId) return;

    const previousProjects = projects;

    // Helper function to find and remove task
    const findAndRemoveTask = (tasks: Task[]): Task | null => {
      for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
          const removed = tasks.splice(i, 1)[0];
          return removed;
        }
        if (tasks[i].subtasks.length > 0) {
          const found = findAndRemoveTask(tasks[i].subtasks);
          if (found) return found;
        }
      }
      return null;
    };

    // Optimistic update - remove from current group, add to new group
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        const newGroups = project.groups.map(group => {
          if (group.id === fromGroupId) {
            return { ...group, tasks: [...group.tasks] };
          }
          return group;
        });

        // Find and remove task from source group
        const movedTask = findAndRemoveTask(
          newGroups.find(g => g.id === fromGroupId)?.tasks || []
        );

        // Add to target group if we found the task
        if (movedTask) {
          const updated: Task = {
            ...movedTask,
            parentId: undefined,
            parentContent: undefined,
          };
          const targetGroup = newGroups.find(g => g.id === toGroupId);
          if (targetGroup) {
            targetGroup.tasks.push(updated);
          }
        }

        return { ...project, groups: newGroups };
      }
      return project;
    }));

    try {
      const updatedProjects = await apiMoveTaskToGroup(currentProjectId, fromGroupId, toGroupId, taskId);
      setProjects(updatedProjects);
      showToast('success', 'Task moved to group successfully');
    } catch (error) {
      setProjects(previousProjects);
      console.error('Failed to move task to group:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleModalAdd = async (content: string, status: TaskStatus, dueDate?: string, repeatFrequency?: RepeatFrequency, groupId?: string) => {
    if (!currentProjectId) return;

    const targetGroupId = groupId || modalGroupId || currentGroupId;
    if (!targetGroupId) {
      showToast('error', 'Please select a group');
      return;
    }

    try {
      const updatedProjects = await apiAddTask(
        currentProjectId,
        targetGroupId,
        content,
        status,
        dueDate,
        undefined, // parentLineNumber (not used in IndexedDB mode)
        repeatFrequency,
        modalParentTask?.id // parentId for IndexedDB mode
      );
      setProjects(updatedProjects);
      showToast('success', 'Task added successfully');
    } catch (error) {
      console.error('Failed to add task:', error);
      showToast('error', getErrorMessage(error));
    }
  };

  const handleCreateProject = async (title: string) => {
    try {
      const newProject = await createProject(title);
      setProjects(prev => [...prev, newProject]);
      setCurrentProjectId(newProject.id);
      showToast('success', `Project "${title}" created successfully`);
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  const handleProjectTitleUpdate = async (projectId: string, newTitle: string) => {
    const previousProjects = projects;

    // Optimistic update - immediately update UI
    setProjects(prev => prev.map(project =>
      project.id === projectId
        ? { ...project, title: newTitle }
        : project
    ));

    try {
      await updateProjectTitle(projectId, newTitle);
      showToast('success', `Project renamed to "${newTitle}"`);
    } catch (error) {
      // Rollback on error
      setProjects(previousProjects);
      console.error('Failed to update project title:', error);
      showToast('error', getErrorMessage(error));
      throw error; // Re-throw to let Sidebar handle the error
    }
  };

  // Show loading state
  if (loading) {
    return (
      <main className={styles.loading}>
        <h1 className="animate-fade-in">Loading your workspace...</h1>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        <ErrorBoundary>
          <Sidebar
            projects={projects}
            currentView={currentView}
            currentProjectId={currentProjectId}
            onViewChange={setCurrentView}
            onProjectSelect={setCurrentProjectId}
            onCreateProject={() => setIsCreateProjectModalOpen(true)}
            onProjectTitleUpdate={handleProjectTitleUpdate}
          />
        </ErrorBoundary>

        <main className={styles.main}>
          <header className={styles.header}>
            <h1 className={styles.projectTitle}>
              {currentProject?.title || 'Select a project'}
            </h1>
            <div className={styles.headerActions}>
              <button
                className={styles.toggleButton}
                onClick={() => setHideDoneTasks(!hideDoneTasks)}
                title={hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'}
              >
                {hideDoneTasks ? <EyeOff size={18} /> : <Eye size={18} />}
                <span>{hideDoneTasks ? 'Show Done' : 'Hide Done'}</span>
              </button>
            </div>
          </header>

          <div className={styles.content}>
            <ErrorBoundary>
              {currentView === 'tree' && currentProject && displayGroups && (
                <TreeView
                  groups={displayGroups}
                  onTaskToggle={handleTaskToggle}
                  onTaskDelete={handleTaskDelete}
                  onTaskAdd={handleTaskAdd}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskReorder={handleTaskReorder}
                  onTaskMoveToParent={handleTaskMoveToParent}
                  onTaskMoveToGroup={handleTaskMoveToGroup}
                  onGroupRename={handleGroupRename}
                  onGroupDelete={handleGroupDelete}
                />
              )}
              {currentView === 'weekly' && currentProject && (
                <WeeklyView
                  tasks={displayTasks}
                  onTaskUpdate={handleTaskUpdate}
                />
              )}
              {currentView === 'md' && currentProject && (
                <MDView
                  projectId={currentProject.id}
                  onSaveSuccess={loadProjects}
                  onError={(message) => showToast('error', message)}
                />
              )}
            </ErrorBoundary>
          </div>
        </main>

        <AddTaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setModalParentTask(undefined);
            setModalGroupId(undefined);
          }}
          onAdd={handleModalAdd}
          isSubtask={!!modalParentTask}
          groups={currentProject?.groups || []}
          defaultGroupId={modalGroupId}
        />

        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onSubmit={handleCreateProject}
        />

        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ErrorBoundary>
  );
}
