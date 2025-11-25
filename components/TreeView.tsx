'use client';

import { Task, RepeatFrequency, Group } from '@/lib/types';
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Trash2, Plus, Edit2, GripVertical, X } from 'lucide-react';
import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './TreeView.module.css';

interface TreeViewProps {
    groups: Group[];
    onTaskToggle: (task: Task) => void;
    onTaskDelete: (task: Task) => void;
    onTaskAdd: (parentTask?: Task) => void;
    onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
    onTaskReorder?: (groupId: string, tasks: Task[]) => void;
    onGroupRename?: (groupId: string, newName: string) => void;
    onGroupDelete?: (groupId: string) => void;
    onGroupAdd?: () => void;
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
    const [editRepeatFrequency, setEditRepeatFrequency] = useState(task.repeatFrequency || '');
    const hasSubtasks = task.subtasks.length > 0;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleSave = () => {
        if (editContent.trim()) {
            onTaskUpdate(task, {
                content: editContent,
                dueDate: editDueDate || undefined,
                repeatFrequency: editRepeatFrequency ? (editRepeatFrequency as RepeatFrequency) : undefined,
            });
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setEditContent(task.content);
        setEditDueDate(task.dueDate || '');
        setEditRepeatFrequency(task.repeatFrequency || '');
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
        <div ref={setNodeRef} style={style} className={styles.taskItem}>
            <div className={styles.taskRow}>
                <div {...attributes} {...listeners} className={styles.dragHandle}>
                    <GripVertical size={14} />
                </div>
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
                            maxLength={500}
                        />
                        <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className={styles.editDateInput}
                        />
                        <select
                            value={editRepeatFrequency}
                            onChange={(e) => setEditRepeatFrequency(e.target.value)}
                            className={styles.editRepeatSelect}
                        >
                            <option value="">No repeat</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
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

                        {task.repeatFrequency && (
                            <span className={styles.repeatBadge}>
                                🔁 {task.repeatFrequency}
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

function GroupItem({
    group,
    onTaskToggle,
    onTaskDelete,
    onTaskAdd,
    onTaskUpdate,
    onTaskReorder,
    onGroupRename,
    onGroupDelete,
}: {
    group: Group;
    onTaskToggle: (task: Task) => void;
    onTaskDelete: (task: Task) => void;
    onTaskAdd: (parentTask?: Task) => void;
    onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
    onTaskReorder?: (tasks: Task[]) => void;
    onGroupRename?: (newName: string) => void;
    onGroupDelete?: () => void;
}) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(group.name);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id && onTaskReorder) {
            let oldIndex = -1;
            let newIndex = -1;

            for (let i = 0; i < group.tasks.length; i++) {
                if (group.tasks[i].id === active.id) oldIndex = i;
                if (group.tasks[i].id === over?.id) newIndex = i;
                if (oldIndex !== -1 && newIndex !== -1) break;
            }

            if (oldIndex !== -1 && newIndex !== -1) {
                const newTasks = arrayMove(group.tasks, oldIndex, newIndex);
                onTaskReorder(newTasks);
            }
        }
    };

    const handleSaveName = () => {
        if (editName.trim() && onGroupRename) {
            onGroupRename(editName.trim());
        }
        setIsEditingName(false);
    };

    const handleCancelName = () => {
        setEditName(group.name);
        setIsEditingName(false);
    };

    return (
        <div>
            <div className={styles.groupHeader}>
                {isEditingName ? (
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') handleCancelName();
                        }}
                        className={styles.groupNameInput}
                        autoFocus
                    />
                ) : (
                    <>
                        <h3
                            className={styles.groupName}
                            onDoubleClick={() => setIsEditingName(true)}
                        >
                            {group.name}
                        </h3>
                        <div className={styles.groupActions}>
                            <button
                                className={styles.groupActionButton}
                                onClick={() => setIsEditingName(true)}
                                title="Rename group"
                            >
                                <Edit2 size={14} />
                            </button>
                            {onGroupDelete && (
                                <button
                                    className={styles.groupActionButton}
                                    onClick={() => {
                                        if (confirm('Are you sure you want to delete this group and all its tasks?')) {
                                            onGroupDelete();
                                        }
                                    }}
                                    title="Delete group"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={group.tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {group.tasks.map((task) => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            onTaskToggle={onTaskToggle}
                            onTaskDelete={onTaskDelete}
                            onTaskAdd={onTaskAdd}
                            onTaskUpdate={onTaskUpdate}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    );
}

export default function TreeView({
    groups,
    onTaskToggle,
    onTaskDelete,
    onTaskAdd,
    onTaskUpdate,
    onTaskReorder,
    onGroupRename,
    onGroupDelete,
    onGroupAdd,
}: TreeViewProps) {
    return (
        <div className={styles.treeView}>
            <div className={styles.addTaskContainer}>
                <button className={styles.addTaskButton} onClick={() => onTaskAdd()}>
                    <Plus size={18} />
                    <span>Add Task</span>
                </button>
                {onGroupAdd && (
                    <button className={styles.addGroupButton} onClick={onGroupAdd}>
                        <Plus size={18} />
                        <span>Add Group</span>
                    </button>
                )}
            </div>

            <div className={styles.groups}>
                {groups.map((group, index) => (
                    <div key={group.id}>
                        {index > 0 && <div className={styles.groupSeparator} />}
                        <GroupItem
                            group={group}
                            onTaskToggle={onTaskToggle}
                            onTaskDelete={onTaskDelete}
                            onTaskAdd={onTaskAdd}
                            onTaskUpdate={onTaskUpdate}
                            onTaskReorder={(tasks) => onTaskReorder?.(group.id, tasks)}
                            onGroupRename={(newName) => onGroupRename?.(group.id, newName)}
                            onGroupDelete={() => onGroupDelete?.(group.id)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
