'use client';

import { useState } from 'react';
import { TaskStatus, RepeatFrequency } from '@/lib/types';
import styles from './AddTaskModal.module.css';

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (content: string, status: TaskStatus, dueDate?: string, repeatFrequency?: RepeatFrequency) => void;
    defaultStatus?: TaskStatus;
    isSubtask?: boolean;
}

export default function AddTaskModal({
    isOpen,
    onClose,
    onAdd,
    defaultStatus = 'todo',
    isSubtask = false
}: AddTaskModalProps) {
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<TaskStatus>(defaultStatus);
    const [dueDate, setDueDate] = useState('');
    const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency | ''>();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (content.trim()) {
            onAdd(
                content,
                status,
                dueDate || undefined,
                repeatFrequency ? (repeatFrequency as RepeatFrequency) : undefined
            );
            setContent('');
            setDueDate('');
            setRepeatFrequency('');
            setStatus(defaultStatus);
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

                    <div className={styles.formGroup}>
                        <label htmlFor="status">Status</label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as TaskStatus)}
                            className={styles.select}
                        >
                            <option value="todo">To Do</option>
                            <option value="doing">In Progress</option>
                            <option value="done">Done</option>
                        </select>
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
