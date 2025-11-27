'use client';

import { Task } from '@/lib/types';
import { useEffect, useState, useCallback } from 'react';
import { X, Play, Pause, RotateCcw, Settings } from 'lucide-react';
import { renderMarkdownLinks } from '@/lib/markdown-link-renderer';
import styles from './PomodoroModal.module.css';

interface PomodoroModalProps {
    task: Task;
    onClose: () => void;
}

type TimerMode = 'work' | 'break';
type TimerState = 'idle' | 'running' | 'paused';

const DEFAULT_WORK_DURATION = 25 * 60; // 25 minutes in seconds
const DEFAULT_BREAK_DURATION = 5 * 60; // 5 minutes in seconds

export default function PomodoroModal({ task, onClose }: PomodoroModalProps) {
    const [mode, setMode] = useState<TimerMode>('work');
    const [state, setState] = useState<TimerState>('idle');
    const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_DURATION);
    const [showSettings, setShowSettings] = useState(false);

    // Settings
    const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_DURATION);
    const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_DURATION);

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
    }, []);

    const pauseTimer = useCallback(() => {
        setState('paused');
    }, []);

    const resetTimer = useCallback(() => {
        setState('idle');
        setTimeLeft(mode === 'work' ? workDuration : breakDuration);
    }, [mode, workDuration, breakDuration]);

    const switchMode = useCallback(() => {
        const newMode = mode === 'work' ? 'break' : 'work';
        setMode(newMode);
        setState('idle');
        setTimeLeft(newMode === 'work' ? workDuration : breakDuration);
    }, [mode, workDuration, breakDuration]);

    // Timer countdown effect
    useEffect(() => {
        if (state !== 'running') return;

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    // Timer completed
                    setState('idle');
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
                    return nextMode === 'work' ? workDuration : breakDuration;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [state, mode, workDuration, breakDuration]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = mode === 'work'
        ? ((workDuration - timeLeft) / workDuration) * 100
        : ((breakDuration - timeLeft) / breakDuration) * 100;

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
                            {renderMarkdownLinks(task.content)}
                        </div>
                    </div>
                    {task.dueDate && (
                        <div className={styles.dueDate}>
                            期限: {new Date(task.dueDate).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    )}
                </div>

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
