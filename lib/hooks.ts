import { useState, useEffect, useCallback, useRef } from 'react';
import { Project } from './types';
import { supabase } from './supabase';
import { getAllProjects, updateProject as updateProjectInIdb, addProject } from './indexeddb';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface UseSyncProps {
  userId?: string;
  onRemoteProjectsFetched: (projects: Project[]) => void;
}

export function useSync({ userId, onRemoteProjectsFetched }: UseSyncProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  // State to hold the last project that was locally modified and needs to be synced
  const [lastLocalProjectChange, setLastLocalProjectChange] = useState<Project | null>(null);
  const debouncedProjectToSync = useDebounce(lastLocalProjectChange, 2000); // Debounce local changes for 2 seconds

  const isSyncingRef = useRef(false); // To prevent multiple concurrent syncs

  // Function to add a project to be synced
  const queueProjectForSync = useCallback((project: Project) => {
    // Make sure updated_at is set for the project before queuing
    setLastLocalProjectChange({ ...project, updated_at: new Date().toISOString() });
  }, []);

  // Effect to handle debounced project for upstream sync (Local -> Cloud)
  useEffect(() => {
    const client = supabase;
    if (!userId || !debouncedProjectToSync || !client) {
      return;
    }

    const syncProjectToSupabase = async (project: Project) => {
      if (isSyncingRef.current) return;
      
      console.log('[Sync] Attempting upsert:', { 
        projectId: project.id, 
        userId, 
        title: project.title 
      });

      isSyncingRef.current = true;
      setSyncStatus('syncing');

      try {
        const { error } = await client
          .from('projects')
          .upsert({
            id: project.id,
            user_id: userId,
            title: project.title,
            data: project, // Store entire Project object as jsonb
            updated_at: project.updated_at, // Use the updated_at from the project object
          }, { onConflict: 'id' });

        if (error) {
          console.error(`Error syncing project ${project.id} to Supabase:`, error);
          throw error;
        }
        setSyncStatus('synced');
      } catch (_error) {
        setSyncStatus('error');
      } finally {
        isSyncingRef.current = false;
      }
    };

    syncProjectToSupabase(debouncedProjectToSync);

  }, [debouncedProjectToSync, userId]);


  // Initial load sync (Downstream sync: Cloud -> Local)
  useEffect(() => {
    const client = supabase;
    if (!userId || !client) return;

    const pullProjectsFromSupabase = async () => {
      setSyncStatus('syncing');
      try {
        const { data: remoteProjectsRaw, error } = await client
          .from('projects')
          .select('*')
          .eq('user_id', userId);

        if (error) {
          throw error;
        }

        // Supabase returns an array of objects, where each object has 'data' key which is our Project
        const remoteProjects = remoteProjectsRaw ? remoteProjectsRaw.map(p => p.data as Project) : [];
        const localProjects = await getAllProjects();

        const localProjectsMap = new Map(localProjects.map(p => [p.id, p]));
        const projectsToUpdateLocally: Project[] = [];

        for (const remoteProject of remoteProjects) {
          const localProject = localProjectsMap.get(remoteProject.id);

          // Conflict resolution: Last Write Wins
          // If remote is newer, update local IndexedDB
          // If no local project, add remote project
          // Note: remoteProject.updated_at is directly from Supabase DB, localProject.updated_at is from IDB Project data.
          const remoteUpdatedAt = remoteProject.updated_at ? new Date(remoteProject.updated_at).getTime() : 0;
          const localUpdatedAt = localProject?.updated_at ? new Date(localProject.updated_at).getTime() : 0;

          if (!localProject || remoteUpdatedAt > localUpdatedAt) {
            projectsToUpdateLocally.push(remoteProject);
            // If project doesn't exist locally, add it; otherwise update it
            if (!localProject) {
              await addProject(remoteProject);
            } else {
              await updateProjectInIdb(remoteProject);
            }
          }
          // If local is newer, it will be synced upstream by queueProjectForSync when it triggers
        }

        // Handle projects deleted remotely but still exist locally (optional for now)
        // For simplicity, we only pull. If a project is deleted remotely,
        // it will remain locally until explicitly deleted by user or next comprehensive sync.

        onRemoteProjectsFetched(await getAllProjects()); // Notify app state with latest local projects

        setSyncStatus('synced');
      } catch (error) {
        console.error('Error pulling projects from Supabase:', error);
        setSyncStatus('error');
      }
    };

    pullProjectsFromSupabase();

  }, [userId, onRemoteProjectsFetched]);


  return { syncStatus, queueProjectForSync };
}

/**
 * Hook to detect online/offline status
 * Returns true when online, false when offline
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[Network] Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[Network] Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for Service Worker sync requests
    const handleSyncRequest = () => {
      console.log('[Network] Sync requested by Service Worker');
      // Trigger a manual sync check
      if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('force-sync'));
      }
    };

    window.addEventListener('sw-sync-requested', handleSyncRequest);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw-sync-requested', handleSyncRequest);
    };
  }, []);

  return isOnline;
}