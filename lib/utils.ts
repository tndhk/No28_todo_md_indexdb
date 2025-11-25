import { Task } from './types';

export const updateTaskInTree = (tasks: Task[], taskId: string, updates: Partial<Task>): Task[] => {
  return tasks.map(task => {
    if (task.id === taskId) {
      return { ...task, ...updates };
    }
    if (task.subtasks.length > 0) {
      return { ...task, subtasks: updateTaskInTree(task.subtasks, taskId, updates) };
    }
    return task;
  });
};

export const deleteTaskFromTree = (tasks: Task[], taskId: string): Task[] => {
  return tasks
    .filter(task => task.id !== taskId)
    .map(task => {
      if (task.subtasks.length > 0) {
        return { ...task, subtasks: deleteTaskFromTree(task.subtasks, taskId) };
      }
      return task;
    });
};

export const filterDoneTasks = (tasks: Task[]): Task[] => {
  return tasks
    .map(task => {
      if (task.subtasks.length > 0) {
        const filteredSubtasks = filterDoneTasks(task.subtasks);
        return { ...task, subtasks: filteredSubtasks };
      }
      return task;
    })
    .filter(task => {
      if (task.status === 'done' && task.subtasks.length === 0) {
        return false;
      }
      return true;
    });
};

export const filterTasksBySearch = (tasks: Task[], query: string): Task[] => {
  if (!query) return tasks;
  
  const lowerQuery = query.toLowerCase();
  
  return tasks.reduce((acc: Task[], task) => {
    const matchesSelf = task.content.toLowerCase().includes(lowerQuery);
    const filteredSubtasks = filterTasksBySearch(task.subtasks, query);
    const hasMatchingSubtasks = filteredSubtasks.length > 0;
    
    if (matchesSelf || hasMatchingSubtasks) {
      acc.push({
        ...task,
        subtasks: filteredSubtasks 
      });
    }
    return acc;
  }, []);
};
