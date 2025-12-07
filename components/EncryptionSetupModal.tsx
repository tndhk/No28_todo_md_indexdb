'use client';

import { useState } from 'react';
import { Lock, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { setMasterPassword, validatePasswordStrength } from '@/lib/encryption';
import { enableEncryptionForAllProjects } from '@/lib/encryption-migration';
import styles from './EncryptionSetupModal.module.css';

interface EncryptionSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

export default function EncryptionSetupModal({ isOpen, onClose, onComplete }: EncryptionSetupModalProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState<'setup' | 'encrypting' | 'complete'>('setup');
    const [error, setError] = useState('');
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

    if (!isOpen) return null;

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        if (value) {
            const validation = validatePasswordStrength(value);
            setPasswordStrength(validation.strength);
        }
    };

    const handleSetupEncryption = async () => {
        setError('');

        // Validate password
        if (!password || password.length < 8) {
            setError('パスワードは8文字以上で入力してください');
            return;
        }

        if (password !== confirmPassword) {
            setError('パスワードが一致しません');
            return;
        }

        const validation = validatePasswordStrength(password);
        if (!validation.valid) {
            setError(validation.errors.join(', '));
            return;
        }

        try {
            setStep('encrypting');

            // Set master password
            setMasterPassword(password);

            // Enable encryption for all projects
            await enableEncryptionForAllProjects(password);

            setStep('complete');

            // Auto-close after 2 seconds
            setTimeout(() => {
                onComplete();
                onClose();
            }, 2000);
        } catch (err) {
            console.error('Encryption setup failed:', err);
            setError(err instanceof Error ? err.message : '暗号化に失敗しました');
            setStep('setup');
        }
    };

    const handleSkip = () => {
        onClose();
    };

    const getStrengthColor = () => {
        switch (passwordStrength) {
            case 'weak': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'strong': return '#10b981';
        }
    };

    const getStrengthLabel = () => {
        switch (passwordStrength) {
            case 'weak': return '弱い';
            case 'medium': return '中程度';
            case 'strong': return '強い';
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <Lock size={24} />
                        <h2>データ暗号化の設定</h2>
                    </div>
                    <button
                        className={styles.closeButton}
                        onClick={handleSkip}
                        disabled={step !== 'setup'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {step === 'setup' && (
                    <div className={styles.content}>
                        <div className={styles.description}>
                            <AlertCircle size={20} />
                            <p>
                                全てのプロジェクトデータを暗号化して保護します。
                                <br />
                                <strong>このパスワードは忘れないでください。</strong>
                                パスワードを忘れるとデータを復号化できなくなります。
                            </p>
                        </div>

                        <div className={styles.formGroup}>
                            <label>パスワード（8文字以上）</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => handlePasswordChange(e.target.value)}
                                placeholder="強力なパスワードを入力"
                                className={styles.input}
                                autoFocus
                            />
                            {password && (
                                <div className={styles.strengthIndicator}>
                                    <div
                                        className={styles.strengthBar}
                                        style={{
                                            width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%',
                                            backgroundColor: getStrengthColor()
                                        }}
                                    />
                                    <span style={{ color: getStrengthColor() }}>
                                        強度: {getStrengthLabel()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label>パスワード（確認）</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="もう一度入力"
                                className={styles.input}
                                onKeyDown={(e) => e.key === 'Enter' && handleSetupEncryption()}
                            />
                        </div>

                        {error && (
                            <div className={styles.error}>
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className={styles.actions}>
                            <button
                                className={styles.skipButton}
                                onClick={handleSkip}
                            >
                                後で設定
                            </button>
                            <button
                                className={styles.submitButton}
                                onClick={handleSetupEncryption}
                                disabled={!password || !confirmPassword}
                            >
                                暗号化を有効にする
                            </button>
                        </div>
                    </div>
                )}

                {step === 'encrypting' && (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <p>データを暗号化しています...</p>
                    </div>
                )}

                {step === 'complete' && (
                    <div className={styles.success}>
                        <CheckCircle2 size={48} color="#10b981" />
                        <h3>暗号化が完了しました！</h3>
                        <p>全てのデータが安全に保護されています</p>
                    </div>
                )}
            </div>
        </div>
    );
}
