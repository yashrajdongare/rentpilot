/**
 * Authoritative billing utility for Fixed Calendar-Month Post-Paid Rent
 * 
 * Rules:
 * 1. Fixed calendar-month, post-paid rent collection.
 * 2. move_in_date is the only date that determines when rent accrual begins.
 *    No bill is generated for any month before move-in date.
 * 3. 30-DAY RULE FOR PRO-RATA:
 *    - Full calendar month = full monthly rent (e.g. Full October = 20,000, Full February = 20,000).
 *    - Partial calendar month (move-in mid-month or vacate mid-month):
 *      monthly_rent / 30 * actual_days_stayed (inclusive)
 *    - Denominator is ALWAYS 30 for all months (February, April, October, etc.).
 *    - Cap: Pro-rata amount can never exceed full monthly rent.
 *    - Rounding: Round to 2 decimal places.
 * 4. Due Date for Rent Month M is on the configured dueDay in month M+1.
 * 5. Single Source of Truth: All billing, pending amounts, statuses, and dashboard sums
 *    are derived from calculateTenantBill / getBillsForRentMonth.
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
 * Calculates due date for fixed post-paid billing.
 * For month M, due date is in month M+1 on dueDay.
 */
export function calculateDueDate(monthKey, dueDay = 10) {
  if (!monthKey) return '';
  const nextMonth = getNextMonthKey(monthKey);
  const clampedDay = Math.min(Math.max(Number(dueDay) || 10, 1), 28);
  return `${nextMonth}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Standardized bill label: "Rent for [Rent Month Name], Due [Due Date]"
 * Example:
 * - "Rent for October, Due 10 Nov"
 * - "Rent for November, Due 10 Dec"
 * - "Rent for April, Due 10 May"
 */
export function fmtBillLabel(monthKey, dueDateStr) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  const rentMonthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
  if (!dueDateStr) return `Rent for ${rentMonthName}`;
  const [dy, dm, dd] = dueDateStr.split('-').map(Number);
  const dueMonthShort = new Date(dy, dm - 1, 1).toLocaleString('en-US', { month: 'short' });
  return `Rent for ${rentMonthName}, Due ${dd} ${dueMonthShort}`;
}

/**
 * Calculates base rent for a specific calendar month using the 30-DAY RULE.
 * - Full month: full monthlyRent
 * - Partial month: Math.min(monthlyRent, roundToTwo((monthlyRent / 30) * daysStayed))
 */
export function calculateRentCharge({ monthlyRent, moveInDate, moveOutDate, monthKey }) {
  const rent = Number(monthlyRent) || 0;
  if (!monthKey || rent <= 0) return 0;

  const [y, m] = monthKey.split('-').map(Number);
  const totalDays = getDaysInMonth(y, m);
  const moveInMonthKey = toMonthKey(moveInDate);
  const moveOutMonthKey = toMonthKey(moveOutDate);

  // If before move-in month, no rent
  if (moveInMonthKey && monthKey < moveInMonthKey) {
    return 0;
  }

  // If after move-out month, no rent
  if (moveOutMonthKey && monthKey > moveOutMonthKey) {
    return 0;
  }

  let startDay = 1;
  let endDay = totalDays;

  if (moveInMonthKey && monthKey === moveInMonthKey && moveInDate) {
    const moveInDay = new Date(`${moveInDate.slice(0, 10)}T12:00:00`).getDate();
    if (moveInDay > 1) {
      startDay = moveInDay;
    }
  }

  if (moveOutMonthKey && monthKey === moveOutMonthKey && moveOutDate) {
    const moveOutDay = new Date(`${moveOutDate.slice(0, 10)}T12:00:00`).getDate();
    if (moveOutDay < totalDays) {
      endDay = moveOutDay;
    }
  }

  // If stayed from 1st through the last day of the calendar month, charge full rent
  if (startDay === 1 && endDay === totalDays) {
    return rent;
  }

  // Partial month: actual calendar days stayed (inclusive)
  const daysStayed = Math.max(0, endDay - startDay + 1);
  if (daysStayed >= totalDays) {
    return rent;
  }

  // 30-day denominator rule, capped at full monthly rent
  const charge = (rent / 30) * daysStayed;
  return Math.min(rent, roundToTwo(charge));
}

/**
 * Computes exact period range text and proration details.
 */
export function calculatePeriodRange(moveInDate, monthKey, moveOutDate = null) {
  if (!monthKey) return { range: '', isProrated: false, eligibleDays: 0, totalDays: 0, startDay: 1, endDay: 0 };
  const [y, m] = monthKey.split('-').map(Number);
  const totalDays = getDaysInMonth(y, m);
  const moveInMonthKey = toMonthKey(moveInDate);
  const moveOutMonthKey = toMonthKey(moveOutDate);

  let fromDay = 1;
  let toDay = totalDays;
  let isProrated = false;

  if (moveInMonthKey && monthKey === moveInMonthKey && moveInDate) {
    const moveInDay = new Date(`${moveInDate.slice(0, 10)}T12:00:00`).getDate();
    if (moveInDay > 1) {
      fromDay = moveInDay;
      isProrated = true;
    }
  }

  if (moveOutMonthKey && monthKey === moveOutMonthKey && moveOutDate) {
    const moveOutDay = new Date(`${moveOutDate.slice(0, 10)}T12:00:00`).getDate();
    if (moveOutDay < totalDays) {
      toDay = moveOutDay;
      isProrated = true;
    }
  }

  const eligibleDays = Math.max(0, toDay - fromDay + 1);
  if (eligibleDays >= totalDays) {
    isProrated = false;
  }

  const d1 = new Date(y, m - 1, fromDay);
  const d2 = new Date(y, m - 1, toDay);

  const range = `${d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} to ${d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return {
    range,
    isProrated,
    fromDay,
    toDay,
    eligibleDays,
    totalDays,
  };
}

/**
 * Single Source of Truth function to calculate a tenant's bill for a specific Rent Month.
 * 
 * Returns null if tenant has no bill for monthKey (e.g. before move-in or after vacate).
 */
export function calculateTenantBill({
  tenant,
  monthKey,
  payments = [],
  today = new Date(),
}) {
  if (!tenant || !monthKey) return null;

  const moveInDate = tenant.move_in_date || tenant.moveInDate || tenant.startDate || '';
  const moveOutDate = tenant.move_out_date || tenant.moveOutDate || '';
  const status = (tenant.status || 'active').toLowerCase();

  const moveInMonthKey = toMonthKey(moveInDate);
  const moveOutMonthKey = toMonthKey(moveOutDate);

  // A tenant has NO bill for any month before move-in
  if (moveInMonthKey && monthKey < moveInMonthKey) {
    return null;
  }

  // A tenant has NO bill for any month after move-out
  if (moveOutMonthKey && monthKey > moveOutMonthKey) {
    return null;
  }

  // Archived tenant with no tenancy in this month
  if (status === 'archived' && (!moveInMonthKey || monthKey > (moveOutMonthKey || moveInMonthKey))) {
    return null;
  }

  const monthlyRent = Number(tenant.monthly_rent ?? tenant.rent ?? 0);
  const dueDay = Number(tenant.due_day || tenant.dueDay || 10);
  const dueDate = calculateDueDate(monthKey, dueDay);

  const billAmount = calculateRentCharge({
    monthlyRent,
    moveInDate,
    moveOutDate,
    monthKey,
  });

  const periodInfo = calculatePeriodRange(moveInDate, monthKey, moveOutDate);

  // Find payments allocated/recorded for this tenant and this rent month
  const matchingPayments = (payments || []).filter((p) => {
    const tId = p.tenant_id || p.tenantId;
    if (String(tId) !== String(tenant.id)) return false;
    const pMonthKey = toMonthKey(p.payment_month || p.paymentMonth || p.monthKey);
    return pMonthKey === monthKey;
  });

  const paidAmount = roundToTwo(
    matchingPayments.reduce((sum, p) => sum + (Number(p.rent_amount ?? p.amount) || 0), 0)
  );

  const totalPaid = roundToTwo(
    matchingPayments.reduce(
      (sum, p) =>
        sum +
        (Number(p.total_amount ?? p.totalAmount ?? (Number(p.rent_amount ?? p.amount ?? 0) + Number(p.electricity_amount ?? p.electricityAmount ?? 0))) || 0),
      0
    )
  );

  const pendingAmount = Math.max(0, roundToTwo(billAmount - paidAmount));

  // Determine today string (YYYY-MM-DD)
  const todayStr =
    typeof today === 'string'
      ? today.slice(0, 10)
      : today instanceof Date
        ? today.toLocaleDateString('en-CA')
        : new Date().toLocaleDateString('en-CA');

  let billStatus;
  let isPaid = false;
  let isUpcoming = false;
  let isDueNow = false;
  let isDueToday = false;

  if (pendingAmount <= 0.009) {
    billStatus = 'PAID';
    isPaid = true;
  } else {
    if (todayStr < dueDate) {
      billStatus = 'UPCOMING';
      isUpcoming = true;
    } else if (todayStr === dueDate) {
      billStatus = 'DUE';
      isDueNow = true;
      isDueToday = true;
    } else {
      billStatus = 'OVERDUE';
      isDueNow = true;
    }
  }

  const isPartial = paidAmount > 0 && pendingAmount > 0.009;

  const [y, m] = monthKey.split('-').map(Number);
  const rentMonthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
  const [dy, dm, dd] = dueDate.split('-').map(Number);
  const dueMonthShort = new Date(dy, dm - 1, 1).toLocaleString('en-US', { month: 'short' });

  const billLabel = `Rent for ${rentMonthName}, Due ${dd} ${dueMonthShort}`;
  const dueNote = `Due on ${dd} ${dueMonthShort}`;

  return {
    tenantId: tenant.id,
    tenantName: tenant.full_name || tenant.name,
    unit: tenant.unit_label || tenant.unit || '',
    phone: tenant.phone || '',
    monthKey,
    monthLabel: fmtMonthLabel(monthKey),
    rentMonthName,
    billLabel,
    dueNote,
    dueDate,
    dueDay,
    billAmount,
    amount: billAmount,
    monthlyRent,
    paidAmount,
    totalPaid,
    pendingAmount,
    balance: pendingAmount,
    status: billStatus,
    isPaid,
    isUpcoming,
    isDueNow,
    isDueToday,
    isPartial,
    isProrated: periodInfo.isProrated,
    periodRange: periodInfo.range,
    eligibleDays: periodInfo.eligibleDays,
    payments: matchingPayments,
  };
}

/**
 * Returns all bills for all tenants for a specific Rent Month.
 */
export function getBillsForRentMonth({
  tenants = [],
  monthKey,
  payments = [],
  today = new Date(),
}) {
  if (!monthKey) return [];
  const bills = [];
  for (const tenant of tenants) {
    const bill = calculateTenantBill({
      tenant,
      monthKey,
      payments,
      today,
    });
    if (bill) {
      bills.push(bill);
    }
  }
  return bills;
}

/**
 * Calculates total cash received during a calendar month based strictly on payment_date.
 * Optionally filters to a specific list of active/visible tenants.
 */
export function getCashReceivedForMonth({
  payments = [],
  monthKey,
  tenants = null,
}) {
  if (!monthKey) return 0;
  const validTenantIds = tenants ? new Set(tenants.map((t) => String(t.id))) : null;

  return roundToTwo(
    (payments || []).reduce((sum, p) => {
      const tId = p.tenant_id || p.tenantId;
      if (validTenantIds && (!tId || !validTenantIds.has(String(tId)))) {
        return sum;
      }
      const pDate = p.payment_date || p.paymentDate;
      if (toMonthKey(pDate) === monthKey) {
        return sum + (Number(p.rent_amount ?? p.amount ?? p.total_amount ?? p.totalAmount) || 0);
      }
      return sum;
    }, 0)
  );
}

/**
 * Generates all historical/current bills for a tenant ledger.
 */
export function getTenantLedgerRows({
  tenant,
  payments = [],
  today = new Date(),
}) {
  if (!tenant) return [];
  const todayStr =
    typeof today === 'string'
      ? today.slice(0, 10)
      : today instanceof Date
        ? today.toLocaleDateString('en-CA')
        : new Date().toLocaleDateString('en-CA');
  const todayMonthKey = todayStr.slice(0, 7);

  const moveInDate = tenant.move_in_date || tenant.moveInDate || tenant.startDate || '';
  let startKey = todayMonthKey;
  if (moveInDate && String(moveInDate).length >= 7) {
    startKey = String(moveInDate).slice(0, 7);
  } else if (payments.length > 0) {
    const earliest = payments[payments.length - 1];
    const pKey = toMonthKey(earliest.payment_month || earliest.paymentMonth || earliest.paymentDate);
    if (pKey && pKey < startKey) startKey = pKey;
  }

  const rows = [];
  const [startY, startM] = startKey.split('-').map(Number);
  let cursor = (startY && startM) ? new Date(startY, startM - 1, 1, 12) : new Date();
  const [todayY, todayM] = todayMonthKey.split('-').map(Number);
  const end = new Date(todayY, todayM - 1, 1, 12);
  if (cursor > end) cursor = new Date(end);

  let guard = 0;
  while (cursor <= end && guard < 120) {
    guard++;
    const mk = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const bill = calculateTenantBill({
      tenant,
      monthKey: mk,
      payments,
      today,
    });
    if (bill) {
      rows.push(bill);
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
  }
  return rows.reverse();
}

/**
 * Determines collect button action type based on bill status:
 * - UPCOMING -> "Advance"
 * - DUE or OVERDUE -> "Normal Collect"
 * - PAID -> "Hidden"
 */
export function getCollectButtonType(bill) {
  if (!bill) return 'Hidden';
  if (bill.status === 'UPCOMING') return 'Advance';
  if (bill.status === 'DUE' || bill.status === 'OVERDUE') return 'Normal Collect';
  return 'Hidden';
}
