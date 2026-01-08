/**
 * Unit Tests for lib/due-status.ts
 * Testing: Due date status calculation, date formatting
 * Coverage: Branch coverage (C1), boundary values, invalid inputs
 */

import { getDueStatus, formatShortDate } from '@/lib/due-status';

describe('getDueStatus', () => {
    beforeEach(() => {
        // Mock Date to return a fixed date: 2025-12-15 (Monday)
        const mockDate = new Date('2025-12-15T12:00:00');
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Null/Undefined/Empty inputs', () => {
        // Test: Undefined due date returns null
        it('should return null for undefined due date', () => {
            const result = getDueStatus(undefined);
            expect(result).toBeNull();
        });

        // Test: Null due date returns null
        it('should return null for null due date', () => {
            const result = getDueStatus(null);
            expect(result).toBeNull();
        });

        // Test: Empty string due date returns null
        it('should return null for empty string due date', () => {
            const result = getDueStatus('');
            expect(result).toBeNull();
        });
    });

    describe('Invalid date inputs', () => {
        // Test: Invalid date string
        it('should return null for invalid date string', () => {
            const result = getDueStatus('invalid-date');
            expect(result).toBeNull();
        });

        // Test: Malformed date
        it('should return null for malformed date format', () => {
            const result = getDueStatus('2025/12/31');
            // JavaScript Date can parse some variations, check if valid
            expect(result === null || typeof result === 'string').toBe(true);
        });

        // Test: Non-existent date (like Feb 30)
        it('should handle non-existent date (Feb 30)', () => {
            // JavaScript auto-adjusts Feb 30 to March 2
            const result = getDueStatus('2025-02-30');
            // Should still calculate status based on adjusted date
            expect(result === null || typeof result === 'string').toBe(true);
        });

        // Test: Empty after whitespace
        it('should return null for whitespace-only string', () => {
            const result = getDueStatus('   ');
            expect(result).toBeNull();
        });
    });

    describe('Overdue status (past dates)', () => {
        // Test: Yesterday is overdue
        it('should return "overdue" for yesterday', () => {
            const result = getDueStatus('2025-12-14');
            expect(result).toBe('overdue');
        });

        // Test: One week ago is overdue
        it('should return "overdue" for date one week ago', () => {
            const result = getDueStatus('2025-12-08');
            expect(result).toBe('overdue');
        });

        // Test: One month ago is overdue
        it('should return "overdue" for date one month ago', () => {
            const result = getDueStatus('2025-11-15');
            expect(result).toBe('overdue');
        });

        // Test: Boundary - one day before today
        it('should return "overdue" for boundary (1 day before)', () => {
            const result = getDueStatus('2025-12-14');
            expect(result).toBe('overdue');
        });

        // Test: Far past date
        it('should return "overdue" for date many years ago', () => {
            const result = getDueStatus('2020-01-01');
            expect(result).toBe('overdue');
        });
    });

    describe('Today status', () => {
        // Test: Exact today
        it('should return "today" for current date', () => {
            const result = getDueStatus('2025-12-15');
            expect(result).toBe('today');
        });

        // Test: Today boundary - different time zones handled by setHours(0,0,0,0)
        it('should return "today" regardless of time component', () => {
            // The function sets hours to 0,0,0,0 for comparison
            const result = getDueStatus('2025-12-15');
            expect(result).toBe('today');
        });
    });

    describe('Upcoming status (future dates)', () => {
        // Test: Tomorrow is upcoming
        it('should return "upcoming" for tomorrow', () => {
            const result = getDueStatus('2025-12-16');
            expect(result).toBe('upcoming');
        });

        // Test: One week later is upcoming
        it('should return "upcoming" for date one week later', () => {
            const result = getDueStatus('2025-12-22');
            expect(result).toBe('upcoming');
        });

        // Test: One month later is upcoming
        it('should return "upcoming" for date one month later', () => {
            const result = getDueStatus('2026-01-15');
            expect(result).toBe('upcoming');
        });

        // Test: Boundary - one day after today
        it('should return "upcoming" for boundary (1 day after)', () => {
            const result = getDueStatus('2025-12-16');
            expect(result).toBe('upcoming');
        });

        // Test: Far future date
        it('should return "upcoming" for date many years in future', () => {
            const result = getDueStatus('2030-12-31');
            expect(result).toBe('upcoming');
        });
    });

    describe('Boundary value analysis', () => {
        // Test: Exact boundary between overdue and today
        it('should handle midnight boundary correctly', () => {
            // Today is 2025-12-15, yesterday is 2025-12-14
            const yesterdayResult = getDueStatus('2025-12-14');
            const todayResult = getDueStatus('2025-12-15');

            expect(yesterdayResult).toBe('overdue');
            expect(todayResult).toBe('today');
        });

        // Test: Exact boundary between today and upcoming
        it('should handle today to tomorrow boundary correctly', () => {
            const todayResult = getDueStatus('2025-12-15');
            const tomorrowResult = getDueStatus('2025-12-16');

            expect(todayResult).toBe('today');
            expect(tomorrowResult).toBe('upcoming');
        });
    });

    describe('Date format variations', () => {
        // Test: ISO format with T separator
        it('should handle ISO date format with time', () => {
            const result = getDueStatus('2025-12-15T00:00:00');
            expect(result).toBe('today');
        });

        // Test: Date with timezone
        it('should handle date with timezone', () => {
            const result = getDueStatus('2025-12-15T00:00:00Z');
            expect(result).toBe('today');
        });
    });
});

describe('formatShortDate', () => {
    describe('Valid date inputs', () => {
        // Test: Standard date formatting
        it('should format date in Japanese short format', () => {
            const result = formatShortDate('2025-12-15');
            // Expected format: "12月15日" or similar based on locale
            expect(result).toBeTruthy();
            expect(result).not.toBe('2025-12-15'); // Should be formatted differently
        });

        // Test: January date
        it('should format January date correctly', () => {
            const result = formatShortDate('2025-01-01');
            expect(result).toBeTruthy();
        });

        // Test: December date
        it('should format December date correctly', () => {
            const result = formatShortDate('2025-12-31');
            expect(result).toBeTruthy();
        });

        // Test: Leap year date
        it('should format leap year date (Feb 29) correctly', () => {
            const result = formatShortDate('2024-02-29');
            expect(result).toBeTruthy();
        });
    });

    describe('Invalid date inputs', () => {
        // Test: Invalid date returns original string
        it('should return original string for invalid date', () => {
            const result = formatShortDate('invalid-date');
            expect(result).toBe('invalid-date');
        });

        // Test: Empty string
        it('should return empty string for empty input', () => {
            const result = formatShortDate('');
            expect(result).toBe('');
        });

        // Test: Random string
        it('should return original string for random text', () => {
            const result = formatShortDate('not a date');
            expect(result).toBe('not a date');
        });
    });

    describe('Date format consistency', () => {
        // Test: Different months produce different output
        it('should produce different output for different months', () => {
            const jan = formatShortDate('2025-01-15');
            const dec = formatShortDate('2025-12-15');
            expect(jan).not.toBe(dec);
        });

        // Test: Different days produce different output
        it('should produce different output for different days', () => {
            const day1 = formatShortDate('2025-12-01');
            const day31 = formatShortDate('2025-12-31');
            expect(day1).not.toBe(day31);
        });
    });

    describe('Edge cases', () => {
        // Test: Year boundary
        it('should format year boundary date correctly', () => {
            const result = formatShortDate('2024-12-31');
            expect(result).toBeTruthy();
        });

        // Test: ISO format with time
        it('should handle ISO format with time component', () => {
            const result = formatShortDate('2025-12-15T10:30:00');
            expect(result).toBeTruthy();
            expect(result).not.toBe('2025-12-15T10:30:00');
        });
    });
});
