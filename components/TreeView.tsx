'use client';

import { Task } from '@/lib/types';
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Trash2, Plus, Edit2 } from 'lucide-react';
import { useState } from 'react';
import styles from './TreeView.module.css';

interface TreeViewProps {
    tasks: Task[];
    onTaskToggle: (task: Task) => void;
    onTaskDelete: (task: Task) => void;
    onTaskAdd: (parentTask?: Task) => void;
    onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
}

function TaskItem({
    task,
    onTaskToggle,
    onTaskDelete,
    onTaskAdd,
    onTaskUpdate
}: {
    task: Task;
    onTaskToggle: (task: Task) => void;
    onTaskDelete: (task: Task) => void;
    onTaskAdd: (parentTask?: Task) => void;
    onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(task.content);
    const [editDueDate, setEditDueDate] = useState(task.dueDate || '');
    const hasSubtasks = task.subtasks.length > 0;

    const handleSave = () => {
        if (editContent.trim()) {
            onTaskUpdate(task, {
                content: editContent,
                dueDate: editDueDate || undefined,
            });
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setEditContent(task.content);
        setEditDueDate(task.dueDate || '');
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className={styles.taskItem}>
            <div className={styles.taskRow}>
                {hasSubtasks && (
                    <button
                        className={styles.expandButton}
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                )}
                {!hasSubtasks && <div className={styles.expandSpacer} />}

                <button
                    className={styles.checkbox}
                    onClick={() => onTaskToggle(task)}
                >
                    {task.status === 'done' ? (
                        <CheckCircle2 size={18} className={styles.checked} />
                    ) : (
                        <Circle size={18} />
                    )}
                </button>

                {isEditing ? (
                    <div
                        className={styles.editContainer}
                        onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                handleSave();
                            }
                        }}
                    >
                        <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={styles.editInput}
                            autoFocus
                        />
                        <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className={styles.editDateInput}
                        />
                    </div>
                ) : (
                    <>
                        <span
                            className={`${styles.taskContent} ${task.status === 'done' ? styles.completed : ''}`}
                            onDoubleClick={() => setIsEditing(true)}
                        >
                            {task.content}
                        </span>

                        {task.dueDate && (
                            <span className={styles.dueDate}>
                                {new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                            </span>
                        )}

                        <div className={styles.actions}>
                            <button
                                className={styles.actionButton}
                                onClick={() => setIsEditing(true)}
                                title="Edit task"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                className={styles.actionButton}
                                onClick={() => onTaskAdd(task)}
                                title="Add subtask"
                            >
                                <Plus size={16} />
                            </button>
                            <button
                                className={styles.actionButton}
                                onClick={() => onTaskDelete(task)}
                                title="Delete task"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {hasSubtasks && isExpanded && (
                <div className={styles.subtasks}>
                    {task.subtasks.map((subtask) => (
                        <TaskItem
                            key={subtask.id}
                            task={subtask}
                            onTaskToggle={onTaskToggle}
                            onTaskDelete={onTaskDelete}
                            onTaskAdd={onTaskAdd}
                            onTaskUpdate={onTaskUpdate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TreeView({
    tasks,
    onTaskToggle,
    onTaskDelete,
    onTaskAdd,
    onTaskUpdate
}: TreeViewProps) {
    return (
        <div className={styles.treeView}>
            <div className={styles.addTaskContainer}>
                <button className={styles.addTaskButton} onClick={() => onTaskAdd()}>
                    <Plus size={18} />
                    <span>Add Task</span>
                </button>
            </div>

            {tasks.map((task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onTaskToggle={onTaskToggle}
                    onTaskDelete={onTaskDelete}
                    onTaskAdd={onTaskAdd}
                    onTaskUpdate={onTaskUpdate}
                />
            ))}
        </div>
    );
}
