import { addDays, addWeeks, addMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export const getDateRange = (
  type: 'today' | 'week' | 'month',
  date: Date = new Date()
): { startDate: Date; endDate: Date } => {
  switch (type) {
    case 'today':
      return {
        startDate: startOfDay(date),
        endDate: endOfDay(date),
      };
    case 'week':
      return {
        startDate: startOfWeek(date),
        endDate: endOfWeek(date),
      };
    case 'month':
      return {
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
      };
  }
};

export const addTimeToDate = (
  date: Date,
  amount: number,
  unit: 'days' | 'weeks' | 'months'
): Date => {
  switch (unit) {
    case 'days':
      return addDays(date, amount);
    case 'weeks':
      return addWeeks(date, amount);
    case 'months':
      return addMonths(date, amount);
  }
};
