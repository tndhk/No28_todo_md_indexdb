'use client';

import { Task, RepeatFrequency } from '@/lib/types';
import { useEffect, useState, useCallback, FormEvent, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Settings } from 'lucide-react';
import { renderMarkdownLinks } from '@/lib/markdown-link-renderer';
import styles from './PomodoroModal.module.css';

interface PomodoroModalProps {
    task: Task;
    onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
    onClose: () => void;
}

type TimerMode = 'work' | 'break';
type TimerState = 'idle' | 'running' | 'paused';

const DEFAULT_WORK_DURATION = 25 * 60; // 25 minutes in seconds
const DEFAULT_BREAK_DURATION = 5 * 60; // 5 minutes in seconds

export default function PomodoroModal({ task, onClose, onTaskUpdate }: PomodoroModalProps) {
    const [mode, setMode] = useState<TimerMode>('work');
    const [state, setState] = useState<TimerState>('idle');
    const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_DURATION);
    const [showSettings, setShowSettings] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedBeforePause, setElapsedBeforePause] = useState(0);

    const [content, setContent] = useState(task.content);
    const [dueDate, setDueDate] = useState(task.dueDate || '');
    const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency | ''>(task.repeatFrequency || '');
    const [repeatIntervalDays, setRepeatIntervalDays] = useState(task.repeatIntervalDays?.toString() || '');

    const lastTaskIdRef = useRef(task.id);

    // Settings
    const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_DURATION);
    const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_DURATION);

    // Reset timer when task changes
    useEffect(() => {
        const isNewTask = lastTaskIdRef.current !== task.id;
        if (!isNewTask) return;

        lastTaskIdRef.current = task.id;
        setMode('work');
        setState('idle');
        setStartTime(null);
        setElapsedBeforePause(0);
        setTimeLeft(workDuration);
    }, [task.id, workDuration]);

    // Sync form fields when task data updates
    useEffect(() => {
        setContent(task.content);
        setDueDate(task.dueDate || '');
        setRepeatFrequency(task.repeatFrequency || '');
        setRepeatIntervalDays(task.repeatIntervalDays?.toString() || '');
    }, [task.content, task.dueDate, task.repeatFrequency, task.repeatIntervalDays]);

    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const sendNotification = useCallback((title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: 'pomodoro-timer',
            });
        }
    }, []);

    const startTimer = useCallback(() => {
        setState('running');
        setStartTime(Date.now());
    }, []);

    const pauseTimer = useCallback(() => {
        if (startTime !== null) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setElapsedBeforePause(prev => prev + elapsed);
        }
        setState('paused');
        setStartTime(null);
    }, [startTime]);

    const resetTimer = useCallback(() => {
        setState('idle');
        setStartTime(null);
        setElapsedBeforePause(0);
        setTimeLeft(mode === 'work' ? workDuration : breakDuration);
    }, [mode, workDuration, breakDuration]);

    const switchMode = useCallback(() => {
        const newMode = mode === 'work' ? 'break' : 'work';
        setMode(newMode);
        setState('idle');
        setStartTime(null);
        setElapsedBeforePause(0);
        setTimeLeft(newMode === 'work' ? workDuration : breakDuration);
    }, [mode, workDuration, breakDuration]);

    // Timer countdown effect
    useEffect(() => {
        if (state !== 'running' || startTime === null) return;

        const targetDuration = mode === 'work' ? workDuration : breakDuration;

        const interval = setInterval(() => {
            const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
            const totalElapsed = elapsedBeforePause + currentElapsed;
            const remaining = targetDuration - totalElapsed;

            if (remaining <= 0) {
                // Timer completed
                setState('idle');
                setStartTime(null);
                setElapsedBeforePause(0);
                const completedMode = mode;
                const nextMode = mode === 'work' ? 'break' : 'work';

                // Send notification
                if (completedMode === 'work') {
                    sendNotification(
                        '作業時間終了！',
                        '休憩時間を取りましょう。'
                    );
                } else {
                    sendNotification(
                        '休憩時間終了！',
                        '作業に戻りましょう。'
                    );
                }

                // Auto-switch to next mode
                setMode(nextMode);
                setTimeLeft(nextMode === 'work' ? workDuration : breakDuration);
            } else {
                setTimeLeft(remaining);
            }
        }, 100); // Update more frequently for smoother display

        return () => clearInterval(interval);
    }, [state, mode, workDuration, breakDuration, startTime, elapsedBeforePause, sendNotification]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = mode === 'work'
        ? ((workDuration - timeLeft) / workDuration) * 100
        : ((breakDuration - timeLeft) / breakDuration) * 100;

    const handleTaskFormSubmit = useCallback((event?: FormEvent) => {
        event?.preventDefault();
        const trimmedContent = content.trim() || task.content;

        const parsedInterval = repeatFrequency === 'custom'
            ? Math.max(1, parseInt(repeatIntervalDays, 10) || 1)
            : undefined;

        onTaskUpdate(task, {
            content: trimmedContent,
            dueDate: dueDate || undefined,
            repeatFrequency: repeatFrequency || undefined,
            repeatIntervalDays: repeatFrequency === 'custom' ? parsedInterval : undefined,
        });
    }, [content, dueDate, onTaskUpdate, repeatFrequency, repeatIntervalDays, task]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>ポモドーロタイマー</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.taskInfo}>
                    <div className={styles.taskContent}>
                        {task.parentContent && (
                            <div className={styles.parentContent}>{task.parentContent}</div>
                        )}
                        <div className={styles.taskTitle}>
                            {renderMarkdownLinks(content)}
                        </div>
                    </div>
                    {dueDate && (
                        <div className={styles.dueDate}>
                            期限: {new Date(dueDate).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    )}
                </div>

                <form className={styles.editForm} onSubmit={handleTaskFormSubmit}>
                    <div className={styles.formRow}>
                        <label className={styles.formLabel}>タスク名</label>
                        <input
                            className={styles.textInput}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="タスク名を入力"
                        />
                    </div>

                    <div className={styles.formRow}>
                        <label className={styles.formLabel}>期限</label>
                        <input
                            className={styles.textInput}
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>

                    <div className={styles.formRow}>
                        <label className={styles.formLabel}>リピート</label>
                        <div className={styles.repeatRow}>
                            <select
                                className={styles.selectInput}
                                value={repeatFrequency}
                                onChange={(e) => {
                                    const value = e.target.value as RepeatFrequency | '';
                                    setRepeatFrequency(value);
                                    if (value !== 'custom') {
                                        setRepeatIntervalDays('');
                                    }
                                }}
                            >
                                <option value="">なし</option>
                                <option value="daily">毎日</option>
                                <option value="weekly">毎週</option>
                                <option value="monthly">毎月</option>
                                <option value="custom">カスタム</option>
                            </select>

                            {repeatFrequency === 'custom' && (
                                <div className={styles.customRepeat}>
                                    <span>毎</span>
                                    <input
                                        className={styles.numberInput}
                                        type="number"
                                        min={1}
                                        value={repeatIntervalDays}
                                        onChange={(e) => setRepeatIntervalDays(e.target.value)}
                                    />
                                    <span>日</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.formActions}>
                        <button type="submit" className={styles.saveButton}>
                            変更を保存
                        </button>
                    </div>
                </form>

                {showSettings ? (
                    <div className={styles.settings}>
                        <h3 className={styles.settingsTitle}>タイマー設定</h3>
                        <div className={styles.settingRow}>
                            <label>作業時間（分）:</label>
                            <input
                                type="number"
                                min="1"
                                max="120"
                                value={workDuration / 60}
                                onChange={(e) => {
                                    const mins = parseInt(e.target.value) || 1;
                                    setWorkDuration(mins * 60);
                                    if (mode === 'work' && state === 'idle') {
                                        setTimeLeft(mins * 60);
                                    }
                                }}
                            />
                        </div>
                        <div className={styles.settingRow}>
                            <label>休憩時間（分）:</label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={breakDuration / 60}
                                onChange={(e) => {
                                    const mins = parseInt(e.target.value) || 1;
                                    setBreakDuration(mins * 60);
                                    if (mode === 'break' && state === 'idle') {
                                        setTimeLeft(mins * 60);
                                    }
                                }}
                            />
                        </div>
                        <button
                            className={styles.settingsButton}
                            onClick={() => setShowSettings(false)}
                        >
                            閉じる
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={styles.timerSection}>
                            <div className={styles.modeIndicator}>
                                <span className={`${styles.modeTag} ${styles[mode]}`}>
                                    {mode === 'work' ? '作業中' : '休憩中'}
                                </span>
                            </div>

                            <div className={styles.timerDisplay}>
                                <svg className={styles.progressRing} width="200" height="200">
                                    <circle
                                        className={styles.progressRingBackground}
                                        cx="100"
                                        cy="100"
                                        r="90"
                                    />
                                    <circle
                                        className={`${styles.progressRingCircle} ${styles[mode]}`}
                                        cx="100"
                                        cy="100"
                                        r="90"
                                        style={{
                                            strokeDasharray: `${2 * Math.PI * 90}`,
                                            strokeDashoffset: `${2 * Math.PI * 90 * (1 - progress / 100)}`,
                                        }}
                                    />
                                </svg>
                                <div className={styles.timeText}>{formatTime(timeLeft)}</div>
                            </div>

                            <div className={styles.controls}>
                                {state === 'idle' || state === 'paused' ? (
                                    <button className={`${styles.controlButton} ${styles.primary}`} onClick={startTimer}>
                                        <Play size={24} />
                                        {state === 'idle' ? '開始' : '再開'}
                                    </button>
                                ) : (
                                    <button className={`${styles.controlButton} ${styles.primary}`} onClick={pauseTimer}>
                                        <Pause size={24} />
                                        一時停止
                                    </button>
                                )}
                                <button className={styles.controlButton} onClick={resetTimer}>
                                    <RotateCcw size={20} />
                                    リセット
                                </button>
                                <button className={styles.controlButton} onClick={switchMode}>
                                    切替
                                </button>
                                <button
                                    className={styles.controlButton}
                                    onClick={() => setShowSettings(true)}
                                    title="設定"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
