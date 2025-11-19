'use client';

import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
    return (
        <div className={styles.container}>
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onDismiss={() => onDismiss(toast.id)}
                />
            ))}
        </div>
    );
}

interface ToastItemProps {
    toast: ToastMessage;
    onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onDismiss]);

    const Icon = {
        success: CheckCircle,
        error: AlertCircle,
        info: Info,
    }[toast.type];

    return (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
            <Icon className={styles.icon} size={20} />
            <span className={styles.message}>{toast.message}</span>
            <button
                className={styles.dismissButton}
                onClick={onDismiss}
                aria-label="Dismiss notification"
            >
                <X size={16} />
            </button>
        </div>
    );
}
