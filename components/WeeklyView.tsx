'use client';

import { Task } from '@/lib/types';
import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

function DraggableTask({ task }: { task: Task }) {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`${styles.taskCard} ${styles[task.status]}`}
        >
            {task.parentContent && (
                <div className={styles.parentContent}>{task.parentContent}</div>
            )}
            <div className={`${styles.taskContent} ${task.status === 'done' ? styles.completed : ''}`}>
                {task.content}
                {task.repeatFrequency && (
                    <span className={styles.repeatBadge}>
                        🔁 {task.repeatFrequency}
                    </span>
                )}
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
            days.push(day);
        }
        return days;
    }, [displayDate]);

    const tasksByDay = useMemo(() => {
        const map = new Map<string, Task[]>();
        weekDays.forEach((day) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            map.set(dateStr, []);
        });

        allTasks.forEach((task) => {
            if (task.dueDate) {
                const tasks = map.get(task.dueDate);
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
        const newDate = over.id as string;

        // Find the task using map - O(1) instead of O(n)
        const task = taskMap.get(taskId);
        if (!task || task.dueDate === newDate) return;

        // Update task due date
        onTaskUpdate(task, { dueDate: newDate });
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
                        {weekDays[6].toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
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
                                        <DraggableTask key={task.id} task={task} />
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
                        {draggedTask.parentContent && (
                            <div className={styles.parentContent}>{draggedTask.parentContent}</div>
                        )}
                        <div className={`${styles.taskContent} ${draggedTask.status === 'done' ? styles.completed : ''}`}>
                            {draggedTask.content}
                            {draggedTask.repeatFrequency && (
                                <span className={styles.repeatBadge}>
                                    🔁 {draggedTask.repeatFrequency}
                                </span>
                            )}
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
