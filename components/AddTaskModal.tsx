'use client';

import { useState } from 'react';
import { TaskStatus, RepeatFrequency, Group } from '@/lib/types';
import styles from './AddTaskModal.module.css';

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (content: string, status: TaskStatus, dueDate?: string, repeatFrequency?: RepeatFrequency, groupId?: string, scheduledDate?: string) => void;
    defaultStatus?: TaskStatus;
    isSubtask?: boolean;
    groups?: Group[];
    defaultGroupId?: string;
}

export default function AddTaskModal({
    isOpen,
    onClose,
    onAdd,
    defaultStatus: _defaultStatus = 'todo',
    isSubtask = false,
    groups = [],
    defaultGroupId = ''
}: AddTaskModalProps) {
    const [content, setContent] = useState('');
    const [status] = useState<TaskStatus>('todo');
    const [scheduledDate, setScheduledDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency | ''>();
    const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (content.trim()) {
            onAdd(
                content,
                status,
                dueDate || undefined,
                repeatFrequency ? (repeatFrequency as RepeatFrequency) : undefined,
                selectedGroupId || undefined,
                scheduledDate || undefined
            );
            setContent('');
            setScheduledDate('');
            setDueDate('');
            setRepeatFrequency('');
            setSelectedGroupId(defaultGroupId);
            onClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h2 className={styles.title}>
                    {isSubtask ? 'Add Subtask' : 'Add New Task'}
                </h2>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label htmlFor="content">Task Content</label>
                        <input
                            id="content"
                            type="text"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter task description..."
                            autoFocus
                            className={styles.input}
                            maxLength={500}
                        />
                    </div>

                    {!isSubtask && groups.length > 0 && (
                        <div className={styles.formGroup}>
                            <label htmlFor="group">Group</label>
                            <select
                                id="group"
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className={styles.select}
                            >
                                <option value="">Select a group...</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label htmlFor="scheduledDate">Scheduled Date (Optional)</label>
                        <input
                            id="scheduledDate"
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="dueDate">Due Date (Optional)</label>
                        <input
                            id="dueDate"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="repeatFrequency">Repeat (Optional)</label>
                        <select
                            id="repeatFrequency"
                            value={repeatFrequency || ''}
                            onChange={(e) => setRepeatFrequency(e.target.value as RepeatFrequency | '')}
                            className={styles.select}
                        >
                            <option value="">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitButton}>
                            Add Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
