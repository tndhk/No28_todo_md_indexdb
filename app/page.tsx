'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Eye, EyeOff, Search, X, Cloud, CloudOff, LogIn, LogOut } from 'lucide-react';
import { Project, Task, TaskStatus, RepeatFrequency } from '@/lib/types';
import { useDebounce, useSync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { setProjectChangeCallback, getProjectById } from '@/lib/indexeddb'; // Import setProjectChangeCallback and getProjectById
import { updateTaskInTree, deleteTaskFromTree, filterDoneTasks, filterTasksBySearch } from '@/lib/utils';
import Sidebar from '@/components/Sidebar';
import TreeView from '@/components/TreeView';
import WeeklyView from '@/components/WeeklyView';
import MDView from '@/components/MDView';
import AuthModal from '@/components/AuthModal';
import AddTaskModal from '@/components/AddTaskModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import Toast, { ToastMessage, ToastType } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { triggerConfetti } from '@/lib/confetti';
import OfflineIndicator from '@/components/OfflineIndicator';
import InstallPrompt from '@/components/InstallPrompt';
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
// Import encryption migration utilities for browser console access
import '@/lib/encryption-migration';
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
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const showToast = useCallback((type: ToastType, message: string) => {
    // SECURITY & MAINTAINABILITY: Use crypto.randomUUID() instead of Math.random() and substr()
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const { user, signOut, loading: authLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Use authenticated user ID. If undefined, sync will not run.
  const userId = user?.id;

  const handleRemoteProjectsFetched = useCallback((fetchedProjects: Project[]) => {
    setProjects(fetchedProjects);
    setCurrentProjectId(prev => prev || (fetchedProjects.length > 0 ? fetchedProjects[0].id : undefined));
  }, []);

  const { syncStatus, queueProjectForSync } = useSync({
    userId: userId,
    onRemoteProjectsFetched: handleRemoteProjectsFetched,
  });

  // Register the global project change callback for IndexedDB
  useEffect(() => {
    setProjectChangeCallback(queueProjectForSync);
    return () => {
      setProjectChangeCallback(null); // Clean up on unmount
    };
  }, [queueProjectForSync]);

  const loadProjects = useCallback(async () => {
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
  }, [currentProjectId, showToast]);

  useEffect(() => {
    if (!authLoading) {
      loadProjects();
    }
  }, [authLoading, loadProjects]);

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



  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Set default group when project changes
  useEffect(() => {
    if (currentProject && currentProject.groups.length > 0) {
      setCurrentGroupId(prev => prev || currentProject.groups[0].id);
    }
  }, [currentProject]);

  // const currentGroup = currentProject?.groups.find(g => g.id === currentGroupId);

  // Get all tasks from all groups for Calendar view
  const allProjectTasks = useMemo(() => {
    if (!currentProject) return [];

    const tasks: Task[] = [];
    currentProject.groups.forEach(group => {
      tasks.push(...group.tasks);
    });
    return tasks;
  }, [currentProject]);

  // Filter tasks based on hideDoneTasks and search query
  const displayTasks = useMemo(() => {
    let tasks = allProjectTasks;
    
    if (hideDoneTasks) {
      tasks = filterDoneTasks(tasks);
    }
    
    if (debouncedSearchQuery) {
      tasks = filterTasksBySearch(tasks, debouncedSearchQuery);
    }
    
    return tasks;
  }, [allProjectTasks, hideDoneTasks, debouncedSearchQuery]);

  // Filter groups based on hideDoneTasks and search query
  const displayGroups = useMemo(() => {
    if (!currentProject) return [];

    return currentProject.groups.map(group => {
      let tasks = group.tasks;
      
      if (hideDoneTasks) {
        tasks = filterDoneTasks(tasks);
      }
      
      if (debouncedSearchQuery) {
        tasks = filterTasksBySearch(tasks, debouncedSearchQuery);
      }
      
      return { ...group, tasks };
    });
  }, [currentProject, hideDoneTasks, debouncedSearchQuery]);

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

  const handleTaskToggle = async (task: Task, groupId: string) => {
    if (!currentProjectId) return;

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const previousProjects = projects;

    // Optimistic update
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.map(group => {
            if (group.id === groupId) {
              // First update status
              let updatedTasks = updateTaskInTree(group.tasks, task.id, { status: newStatus });

              // If marking as done, move to bottom
              if (newStatus === 'done') {
                updatedTasks = moveTaskToBottom(updatedTasks, task.id);
              }
              return { ...group, tasks: updatedTasks };
            }
            return group;
          }),
        };
      }
      return project;
    }));

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
        // We can replicate the logic locally using the updated project data
        const project = updatedProjects.find(p => p.id === currentProjectId);
        if (project) {
          const group = project.groups.find(g => g.id === groupId);
          if (group) {
            const reorderedTasks = moveTaskToBottom(group.tasks, task.id);
            const finalProjects = await apiReorderTasks(currentProjectId, groupId, reorderedTasks);
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

  const handleTaskDelete = async (task: Task, groupId: string) => {
    if (!currentProjectId || !confirm('Are you sure you want to delete this task?')) return;

    const previousProjects = projects;

    // Optimistic update - immediately remove from UI
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, tasks: deleteTaskFromTree(group.tasks, task.id) };
            }
            return group;
          }),
        };
      }
      return project;
    }));

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
        scheduledDate: updates.scheduledDate,
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
    setProjects(prev => prev.map(project => {
      if (project.id === currentProjectId) {
        return {
          ...project,
          groups: project.groups.map(group => {
            if (group.id === groupId) {
              // Deep copy to avoid mutating state directly
              const newTasks = JSON.parse(JSON.stringify(group.tasks));

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
              if (!movedTask) return group; // Return original group if not found (actually we should probably return group as is, but map expects group)

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

              return { ...group, tasks: newTasks };
            }
            return group;
          }),
        };
      }
      return project;
    }));

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
          // We need to copy both source and target groups to avoid mutation
          if (group.id === fromGroupId || group.id === toGroupId) {
            // Deep copy tasks to ensure we don't mutate nested structures if findAndRemoveTask goes deep
            // Although findAndRemoveTask only splices the array it's given.
            // For safety, let's deep copy the tasks array of the affected groups.
            return { ...group, tasks: JSON.parse(JSON.stringify(group.tasks)) };
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

  const handleModalAdd = async (content: string, status: TaskStatus, dueDate?: string, repeatFrequency?: RepeatFrequency, groupId?: string, scheduledDate?: string) => {
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
        modalParentTask?.id, // parentId for IndexedDB mode
        scheduledDate
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

  const handleMDSaveSuccess = useCallback(async () => {
    // Reload the updated project from IndexedDB and update React state
    if (!currentProjectId) return;

    try {
      const updatedProject = await getProjectById(currentProjectId);
      if (updatedProject) {
        setProjects(prev => prev.map(project =>
          project.id === currentProjectId ? updatedProject : project
        ));
      }
    } catch (error) {
      console.error('Failed to reload project after MD save:', error);
      showToast('error', 'Failed to refresh view after save');
    }
  }, [currentProjectId, showToast]);

  const handleMDError = useCallback((message: string) => {
    showToast('error', message);
  }, [showToast]);

  // Show loading state
  if (loading) {
    return (
      <main className={styles.loading}>
        <h1 className="animate-fade-in">Loading your workspace...</h1>
      </main>
    );
  }

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <div title="Syncing..." className={styles.syncIconWrapper}>
            <Cloud size={18} className={styles.syncingIcon} />
          </div>
        );
      case 'synced':
        return (
          <div title="Synced" className={styles.syncIconWrapper}>
            <Cloud size={18} className={styles.syncedIcon} />
          </div>
        );
      case 'error':
        return (
          <div title="Sync Error" className={styles.syncIconWrapper}>
            <CloudOff size={18} className={styles.errorIcon} />
          </div>
        );
      case 'idle':
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <OfflineIndicator />
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
              <div className={styles.searchContainer}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    className={styles.clearSearchButton}
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                className={styles.toggleButton}
                onClick={() => setHideDoneTasks(!hideDoneTasks)}
                title={hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'}
              >
                {hideDoneTasks ? <EyeOff size={18} /> : <Eye size={18} />}
                <span>{hideDoneTasks ? 'Show Done' : 'Hide Done'}</span>
              </button>

              {user ? (
                <button
                  className={styles.toggleButton}
                  onClick={() => signOut()}
                  title="Sign Out"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  className={styles.toggleButton}
                  onClick={() => setIsAuthModalOpen(true)}
                  title="Sign In to Sync"
                >
                  <LogIn size={18} />
                  <span>Sign In</span>
                </button>
              )}

              {getSyncIcon()}
            </div>
          </header>

          <div className={styles.content}>
            <ErrorBoundary>
              {currentView === 'tree' && currentProject && displayGroups && (
                debouncedSearchQuery && !displayGroups.some(g => g.tasks.length > 0) ? (
                  <div className={styles.noResults}>
                    <Search size={48} className={styles.noResultsIcon} />
                    <p>No tasks found for &quot;{debouncedSearchQuery}&quot;</p>
                    <button 
                      onClick={() => setSearchQuery('')}
                      className={styles.clearSearchButtonLarge}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <TreeView
                    key={debouncedSearchQuery || 'tree-view'}
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
                )
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
                  onSaveSuccess={handleMDSaveSuccess}
                  onError={handleMDError}
                />
              )}
            </ErrorBoundary>
          </div>
        </main>

        <AddTaskModal
          key={`${modalGroupId || 'no-group'}-${modalParentTask?.id || 'no-parent'}`}
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

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
      <InstallPrompt />
    </ErrorBoundary>
  );
}
