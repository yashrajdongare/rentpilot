/**
 * Authoritative billing utility for Fixed Calendar-Month Post-Paid Rent
 * 
 * Rules:
 * 1. Fixed calendar-month, post-paid rent collection.
 * 2. move_in_date is the only date that determines when rent accrual begins.
 * 3. The first calendar month is prorated from move-in date through final day of that month, inclusive:
 *    first_month_rent = roundToTwoDecimals(monthly_rent * eligible_days / days_in_calendar_month)
 * 4. Every subsequent complete calendar month is charged at full monthly rent.
 * 5. Due day is configured per tenant/property (default 10).
 *    Rent for month M is due on configured day in month M+1.
 * 6. Payment period and payment date are separate.
 */

export function roundToTwo(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

export function toMonthKey(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 7);
}

export function fmtMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function fmtShortMonth(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
}

export function getNextMonthKey(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getPrevMonthKey(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates base rent for a specific calendar month.
 * Handles inclusive proration for the move-in month.
 */
export function calculateRentCharge({ monthlyRent, moveInDate, monthKey }) {
  const rent = Number(monthlyRent) || 0;
  if (!monthKey || rent <= 0) return 0;

  const [y, m] = monthKey.split('-').map(Number);
  const totalDays = getDaysInMonth(y, m);
  const moveInMonthKey = toMonthKey(moveInDate);

  // If before move-in month, no rent
  if (moveInMonthKey && monthKey < moveInMonthKey) {
    return 0;
  }

  // If first month (move-in month)
  if (moveInMonthKey && monthKey === moveInMonthKey) {
    const moveInDay = new Date(`${moveInDate.slice(0, 10)}T12:00:00`).getDate();
    if (moveInDay <= 1) {
      return rent;
    }
    // Inclusive: from moveInDay through totalDays
    const eligibleDays = totalDays - moveInDay + 1;
    return roundToTwo((rent * eligibleDays) / totalDays);
  }

  // Subsequent months
  return rent;
}

/**
 * Computes exact period range text and proration details
 */
export function calculatePeriodRange(moveInDate, monthKey) {
  if (!monthKey) return { range: '', isProrated: false, eligibleDays: 0, totalDays: 0 };
  const [y, m] = monthKey.split('-').map(Number);
  const totalDays = getDaysInMonth(y, m);
  const moveInMonthKey = toMonthKey(moveInDate);

  let fromDay = 1;
  let isProrated = false;

  if (moveInMonthKey && monthKey === moveInMonthKey && moveInDate) {
    const moveInDay = new Date(`${moveInDate.slice(0, 10)}T12:00:00`).getDate();
    if (moveInDay > 1) {
      fromDay = moveInDay;
      isProrated = true;
    }
  }

  const eligibleDays = totalDays - fromDay + 1;
  const d1 = new Date(y, m - 1, fromDay);
  const d2 = new Date(y, m - 1, totalDays);

  const range = `${d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} to ${d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return {
    range,
    isProrated,
    fromDay,
    toDay: totalDays,
    eligibleDays,
    totalDays,
  };
}

/**
 * Calculates due date for fixed post-paid billing.
 * For month M, due date is in month M+1 on dueDay.
 */
export function calculateDueDate(monthKey, dueDay = 10) {
  if (!monthKey) return '';
  const nextMonth = getNextMonthKey(monthKey);
  const clampedDay = Math.min(Math.max(Number(dueDay) || 10, 1), 28);
  return `${nextMonth}-${String(clampedDay).padStart(2, '0')}`;
}
