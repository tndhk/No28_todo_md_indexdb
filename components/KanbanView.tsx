'use client';

import { Task, TaskStatus } from '@/lib/types';
import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, pointerWithin } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './KanbanView.module.css';

interface KanbanViewProps {
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
            <div className={styles.taskContent}>{task.content}</div>
            {task.dueDate && (
                <div className={styles.dueDate}>
                    Due: {new Date(task.dueDate).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric'
                    })}
                </div>
            )}
        </div>
    );
}

function DroppableColumn({
    status,
    children
}: {
    status: TaskStatus;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `column-${status}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`${styles.taskList} ${isOver ? styles.dropActive : ''}`}
            style={{
                minHeight: '200px',
            }}
        >
            {children}
        </div>
    );
}

export default function KanbanView({ tasks, onTaskUpdate }: KanbanViewProps) {
    const allTasks = useMemo(() => getAllTasks(tasks), [tasks]);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
                delay: 100,
                tolerance: 5,
            },
        })
    );

    const columns: { status: TaskStatus; title: string; color: string }[] = [
        { status: 'todo', title: 'To Do', color: 'var(--foreground)' },
        { status: 'doing', title: 'In Progress', color: 'var(--primary)' },
        { status: 'done', title: 'Done', color: 'var(--success)' },
    ];

    const tasksByStatus = useMemo(() => {
        const map = new Map<TaskStatus, Task[]>();
        columns.forEach((col) => map.set(col.status, []));

        allTasks.forEach((task) => {
            const tasks = map.get(task.status);
            if (tasks) {
                tasks.push(task);
            }
        });

        return map;
    }, [allTasks]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedTask(null);

        if (!over) return;

        const taskId = active.id as string;
        const overId = over.id as string;

        // Extract status from column ID (format: "column-{status}")
        const newStatus = overId.startsWith('column-')
            ? (overId.replace('column-', '') as TaskStatus)
            : (overId as TaskStatus);

        // Find the task
        const task = allTasks.find((t) => t.id === taskId);
        if (!task || task.status === newStatus) return;

        // Update task status
        onTaskUpdate(task, { status: newStatus });
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragEnd={handleDragEnd}
            onDragStart={(event) => {
                const task = allTasks.find((t) => t.id === event.active.id);
                if (task) setDraggedTask(task);
            }}
        >
            <div className={styles.kanbanView}>
                <div className={styles.columns}>
                    {columns.map((column) => {
                        const columnTasks = tasksByStatus.get(column.status) || [];

                        return (
                            <div key={column.status} className={styles.column}>
                                <div className={styles.columnHeader} style={{ borderColor: column.color }}>
                                    <h2 className={styles.columnTitle}>{column.title}</h2>
                                    <span className={styles.taskCount}>{columnTasks.length}</span>
                                </div>

                                <DroppableColumn status={column.status}>
                                    {columnTasks.map((task) => (
                                        <DraggableTask key={task.id} task={task} />
                                    ))}
                                    {columnTasks.length === 0 && (
                                        <div className={styles.emptyState}>Drop tasks here</div>
                                    )}
                                </DroppableColumn>
                            </div>
                        );
                    })}
                </div>
            </div>

            <DragOverlay>
                {draggedTask ? (
                    <div className={`${styles.taskCard} ${styles[draggedTask.status]} ${styles.dragging}`}>
                        <div className={styles.taskContent}>{draggedTask.content}</div>
                        {draggedTask.dueDate && (
                            <div className={styles.dueDate}>
                                Due: {new Date(draggedTask.dueDate).toLocaleDateString('ja-JP', {
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </div>
                        )}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
