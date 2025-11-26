'use client';

import { Task } from '@/lib/types';
import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Circle, CheckCircle2 } from 'lucide-react';
import { renderMarkdownLinks } from '@/lib/markdown-link-renderer';
import styles from './WeeklyView.module.css';

interface WeeklyViewProps {
    tasks: Task[];
    onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
}

function getAllTasks(tasks: Task[]): Task[] {
    const result: Task[] = [];
    for (const task of tasks) {
        result.push(task);
        if (task.subtasks.length > 0) {
            result.push(...getAllTasks(task.subtasks));
        }
    }
    return result;
}

function DraggableTask({ task, onTaskUpdate }: { task: Task; onTaskUpdate: (task: Task, updates: Partial<Task>) => void }) {
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

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onTaskUpdate(task, {
            status: task.status === 'done' ? 'todo' : 'done'
        });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`${styles.taskCard} ${styles[task.status]}`}
        >
            <button
                className={styles.taskCheckbox}
                onClick={handleToggle}
                title={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
            >
                {task.status === 'done' ? (
                    <CheckCircle2 size={16} className={styles.checked} />
                ) : (
                    <Circle size={16} />
                )}
            </button>
            <div className={styles.taskCardContent}>
                {task.parentContent && (
                    <div className={styles.parentContent}>{task.parentContent}</div>
                )}
                <div className={`${styles.taskContent} ${task.status === 'done' ? styles.completed : ''}`}>
                    {renderMarkdownLinks(task.content)}
                    {task.scheduledDate && task.dueDate && task.scheduledDate !== task.dueDate && (
                        <span className={styles.dueBadge} title="Due date">
                            🔔 {new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                    {task.repeatFrequency && (
                        <span className={styles.repeatBadge}>
                            🔁 {task.repeatFrequency}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function DroppableDay({
    dateStr,
    children
}: {
    dateStr: string;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: dateStr,
    });

    return (
        <div
            ref={setNodeRef}
            className={`${styles.taskList} ${isOver ? styles.dropActive : ''}`}
        >
            {children}
        </div>
    );
}

export default function WeeklyView({ tasks, onTaskUpdate }: WeeklyViewProps) {
    const allTasks = useMemo(() => getAllTasks(tasks), [tasks]);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    const [displayDate, setDisplayDate] = useState(new Date());
    const [weekdayOnly, setWeekdayOnly] = useState(true);

    // Optimization: Create task ID lookup map to avoid repeated linear searches - O(1) lookup instead of O(n)
    const taskMap = useMemo(() => {
        const map = new Map<string, Task>();
        allTasks.forEach(task => map.set(task.id, task));
        return map;
    }, [allTasks]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
                delay: 100,
                tolerance: 5,
            },
        })
    );

    const today = new Date();
    const weekDays = useMemo(() => {
        const days = [];
        const startOfWeek = new Date(displayDate);
        const dayOfWeek = displayDate.getDay();
        const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1, Sunday = 0 → -6
        startOfWeek.setDate(displayDate.getDate() + offset);

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            const dayOfWeekNum = day.getDay();
            // Skip Saturday (6) and Sunday (0) if weekdayOnly is true
            if (!weekdayOnly || (dayOfWeekNum !== 0 && dayOfWeekNum !== 6)) {
                days.push(day);
            }
        }
        return days;
    }, [displayDate, weekdayOnly]);

    const tasksByDay = useMemo(() => {
        const map = new Map<string, Task[]>();
        weekDays.forEach((day) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            map.set(dateStr, []);
        });

        allTasks.forEach((task) => {
            // Prioritize scheduledDate over dueDate
            const displayDate = task.scheduledDate || task.dueDate;
            if (displayDate) {
                const tasks = map.get(displayDate);
                if (tasks) {
                    tasks.push(task);
                }
            }
        });

        return map;
    }, [allTasks, weekDays]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedTask(null);

        if (!over) return;

        const taskId = active.id as string;
        let newDate = over.id as string;

        // If dropped on a task, get that task's display date (scheduledDate or dueDate)
        // useSortable makes items droppable, so over.id might be a task ID
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            const overTask = taskMap.get(newDate);
            if (overTask) {
                const overTaskDisplayDate = overTask.scheduledDate || overTask.dueDate;
                if (overTaskDisplayDate) {
                    newDate = overTaskDisplayDate;
                } else {
                    // Invalid drop target
                    return;
                }
            } else {
                // Invalid drop target
                return;
            }
        }

        // Find the task using map - O(1) instead of O(n)
        const task = taskMap.get(taskId);
        const currentDisplayDate = task?.scheduledDate || task?.dueDate;
        if (!task || currentDisplayDate === newDate) return;

        // Update task scheduled date (prioritize scheduledDate over dueDate)
        onTaskUpdate(task, { scheduledDate: newDate });
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
            onDragStart={(event) => {
                // Use map for O(1) lookup instead of O(n) find
                const task = taskMap.get(event.active.id as string);
                if (task) setDraggedTask(task);
            }}
        >
            <div className={styles.weeklyView}>
                <div className={styles.weekHeader}>
                    <button
                        className={styles.navButton}
                        onClick={() => {
                            const prev = new Date(displayDate);
                            prev.setDate(prev.getDate() - 7);
                            setDisplayDate(prev);
                        }}
                    >
                        ← 前週
                    </button>
                    <div className={styles.weekRange}>
                        {weekDays[0].toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜{' '}
                        {weekDays[weekDays.length - 1].toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </div>
                    <button
                        className={styles.navButton}
                        onClick={() => {
                            const next = new Date(displayDate);
                            next.setDate(next.getDate() + 7);
                            setDisplayDate(next);
                        }}
                    >
                        翌週 →
                    </button>
                    <button
                        className={`${styles.navButton} ${weekdayOnly ? styles.active : ''}`}
                        onClick={() => setWeekdayOnly(!weekdayOnly)}
                        title={weekdayOnly ? 'Show weekends' : 'Hide weekends'}
                    >
                        {weekdayOnly ? 'Weekday only' : 'Full week'}
                    </button>
                </div>
                <div className={styles.weekGrid}>
                    {weekDays.map((day) => {
                        const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const dayTasks = tasksByDay.get(dateStr) || [];
                        const isToday = day.toDateString() === today.toDateString();

                        return (
                            <div key={dateStr} className={`${styles.dayColumn} ${isToday ? styles.today : ''}`}>
                                <div className={styles.dayHeader}>
                                    <div className={styles.dayName}>{dayNames[day.getDay()]}</div>
                                    <div className={styles.dayDate}>{day.getDate()}</div>
                                </div>

                                <DroppableDay dateStr={dateStr}>
                                    {dayTasks.map((task) => (
                                        <DraggableTask key={task.id} task={task} onTaskUpdate={onTaskUpdate} />
                                    ))}
                                    {dayTasks.length === 0 && (
                                        <div className={styles.emptyState}>Drop tasks here</div>
                                    )}
                                </DroppableDay>
                            </div>
                        );
                    })}
                </div>
            </div>

            <DragOverlay>
                {draggedTask ? (
                    <div className={`${styles.taskCard} ${styles[draggedTask.status]} ${styles.dragging}`}>
                        <div style={{ opacity: 0, pointerEvents: 'none' }}>
                            <Circle size={16} />
                        </div>
                        <div className={styles.taskCardContent}>
                            {draggedTask.parentContent && (
                                <div className={styles.parentContent}>{draggedTask.parentContent}</div>
                            )}
                            <div className={`${styles.taskContent} ${draggedTask.status === 'done' ? styles.completed : ''}`}>
                                {renderMarkdownLinks(draggedTask.content)}
                                {draggedTask.repeatFrequency && (
                                    <span className={styles.repeatBadge}>
                                        🔁 {draggedTask.repeatFrequency}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
