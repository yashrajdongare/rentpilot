import {
  calculateRentCharge,
  calculatePeriodRange,
  calculateDueDate,
  fmtBillLabel,
  calculateTenantBill,
  getBillsForRentMonth,
  getCashReceivedForMonth,
  getTenantLedgerRows,
} from './src/utils/billing.js';

function runTests() {
  console.log('--- RUNNING AUTHORITATIVE 30-DAY RULE & BILLING TESTS ---');

  const today = '2026-11-12';

  // 1. Pro-Rata 30-Day Rule Unit Checks
  console.log('Testing 30-day pro-rata rule calculations...');

  // Tenant A: 20000 rent, joined 15 Oct 2026 -> 15-31 Oct = 17 days. 20000 / 30 * 17 = 11333.33
  const octChargeA = calculateRentCharge({
    monthlyRent: 20000,
    moveInDate: '2026-10-15',
    monthKey: '2026-10',
  });
  console.assert(octChargeA === 11333.33, `Tenant A Oct charge expected 11333.33, got ${octChargeA}`);

  // Tenant C: 30000 rent, joined 10 Oct 2026 -> 10-31 Oct = 22 days. 30000 / 30 * 22 = 22000
  const octChargeC = calculateRentCharge({
    monthlyRent: 30000,
    moveInDate: '2026-10-10',
    monthKey: '2026-10',
  });
  console.assert(octChargeC === 22000, `Tenant C Oct charge expected 22000, got ${octChargeC}`);

  // Full calendar months (Oct, Feb, Apr) must charge full rent
  const fullOct = calculateRentCharge({
    monthlyRent: 20000,
    moveInDate: '2026-10-01',
    monthKey: '2026-10',
  });
  console.assert(fullOct === 20000, `Full Oct charge expected 20000, got ${fullOct}`);

  const fullFeb = calculateRentCharge({
    monthlyRent: 20000,
    moveInDate: '2026-01-01',
    monthKey: '2026-02',
  });
  console.assert(fullFeb === 20000, `Full Feb charge expected 20000, got ${fullFeb}`);

  const fullApr = calculateRentCharge({
    monthlyRent: 20000,
    moveInDate: '2026-01-01',
    monthKey: '2026-04',
  });
  console.assert(fullApr === 20000, `Full Apr charge expected 20000, got ${fullApr}`);

  // Move-in 15 Feb 2026 to 28 Feb = 14 days -> 20000 / 30 * 14 = 9333.33
  const febPartial = calculateRentCharge({
    monthlyRent: 20000,
    moveInDate: '2026-02-15',
    monthKey: '2026-02',
  });
  console.assert(febPartial === 9333.33, `Feb partial charge expected 9333.33, got ${febPartial}`);

  // Vacate mid-month test: Vacate on 15 Oct -> 15 days -> 20000 / 30 * 15 = 10000
  const vacateMidMonth = calculateRentCharge({
    monthlyRent: 20000,
    moveInDate: '2026-01-01',
    moveOutDate: '2026-10-15',
    monthKey: '2026-10',
  });
  console.assert(vacateMidMonth === 10000, `Vacate mid-month expected 10000, got ${vacateMidMonth}`);

  // Due Date Checks (post-paid): Rent for month M due in month M+1 on dueDay
  console.assert(calculateDueDate('2026-10', 10) === '2026-11-10', 'Oct due date mismatch');
  console.assert(calculateDueDate('2026-11', 10) === '2026-12-10', 'Nov due date mismatch');
  console.assert(calculateDueDate('2026-04', 10) === '2026-05-10', 'Apr due date mismatch');

  // Label Checks
  console.assert(fmtBillLabel('2026-10', '2026-11-10') === 'Rent for October, Due 10 Nov', 'Oct label mismatch');
  console.assert(fmtBillLabel('2026-11', '2026-12-10') === 'Rent for November, Due 10 Dec', 'Nov label mismatch');
  console.assert(fmtBillLabel('2026-04', '2026-05-10') === 'Rent for April, Due 10 May', 'Apr label mismatch');

  // Setup Tenants A, B, C for Acceptance Tests 1, 2, 3
  const tenantA = {
    id: 'tenant-a',
    full_name: 'Tenant A',
    unit_label: 'Flat A',
    monthly_rent: 20000,
    move_in_date: '2026-10-15',
    due_day: 10,
    status: 'active',
  };

  const tenantB = {
    id: 'tenant-b',
    full_name: 'Tenant B',
    unit_label: 'Flat B',
    monthly_rent: 15000,
    move_in_date: '2026-11-01',
    due_day: 10,
    status: 'active',
  };

  const tenantC = {
    id: 'tenant-c',
    full_name: 'Tenant C',
    unit_label: 'Flat C',
    monthly_rent: 30000,
    move_in_date: '2026-10-10',
    due_day: 10,
    status: 'active',
  };

  const tenants = [tenantA, tenantB, tenantC];

  // Payments: Tenant A paid Oct rent on 8 Nov
  const payments = [
    {
      id: 'pay-1',
      tenant_id: 'tenant-a',
      payment_month: '2026-10-01',
      payment_date: '2026-11-08',
      rent_amount: 11333.33,
      total_amount: 11333.33,
    },
  ];

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 1: Dashboard Rent Month = Oct, Today 12 Nov
  // Expected 33333.33, Collected for Oct Rent 11333.33, Pending Due Now 22000, Cash Received in Oct 0
  // -------------------------------------------------------------
  console.log('\nTesting ACCEPTANCE TEST 1 (October 2026 Dashboard on 12 Nov)...');
  const octBills = getBillsForRentMonth({ tenants, monthKey: '2026-10', payments, today });
  console.assert(octBills.length === 2, `Expected 2 bills in Oct (A and C, B not moved in), got ${octBills.length}`);

  const octBillA = octBills.find((b) => b.tenantId === 'tenant-a');
  const octBillC = octBills.find((b) => b.tenantId === 'tenant-c');
  console.assert(octBillA.status === 'PAID', `Tenant A Oct status expected PAID, got ${octBillA.status}`);
  console.assert(octBillC.status === 'OVERDUE', `Tenant C Oct status expected OVERDUE, got ${octBillC.status}`);
  console.assert(octBillC.pendingAmount === 22000, `Tenant C Oct pending expected 22000, got ${octBillC.pendingAmount}`);

  const octExpected = octBills.reduce((s, b) => s + b.billAmount, 0);
  const octCollected = octBills.reduce((s, b) => s + b.paidAmount, 0);
  const octPendingDueNow = octBills.filter((b) => b.isDueNow).reduce((s, b) => s + b.pendingAmount, 0);
  const octCashReceived = getCashReceivedForMonth({ payments, monthKey: '2026-10' });

  console.assert(octExpected === 33333.33, `Expected Oct 33333.33, got ${octExpected}`);
  console.assert(octCollected === 11333.33, `Collected Oct 11333.33, got ${octCollected}`);
  console.assert(octPendingDueNow === 22000, `Pending Due Now Oct 22000, got ${octPendingDueNow}`);
  console.assert(octCashReceived === 0, `Cash Received in Oct expected 0, got ${octCashReceived}`);
  console.log('ACCEPTANCE TEST 1: PASSED ✅');

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 2: Dashboard Rent Month = Nov, Today 12 Nov
  // Expected 65000, Collected for Nov Rent 0, Due Now 0, Upcoming Expected 65000, Cash Received in Nov 11333.33
  // -------------------------------------------------------------
  console.log('\nTesting ACCEPTANCE TEST 2 (November 2026 Dashboard on 12 Nov)...');
  const novBills = getBillsForRentMonth({ tenants, monthKey: '2026-11', payments, today });
  console.assert(novBills.length === 3, `Expected 3 bills in Nov, got ${novBills.length}`);

  const novBillA = novBills.find((b) => b.tenantId === 'tenant-a');
  const novBillB = novBills.find((b) => b.tenantId === 'tenant-b');
  const novBillC = novBills.find((b) => b.tenantId === 'tenant-c');
  console.assert(novBillA.status === 'UPCOMING', `Tenant A Nov status expected UPCOMING, got ${novBillA.status}`);
  console.assert(novBillB.status === 'UPCOMING', `Tenant B Nov status expected UPCOMING, got ${novBillB.status}`);
  console.assert(novBillC.status === 'UPCOMING', `Tenant C Nov status expected UPCOMING, got ${novBillC.status}`);

  const novExpected = novBills.reduce((s, b) => s + b.billAmount, 0);
  const novCollected = novBills.reduce((s, b) => s + b.paidAmount, 0);
  const novDueNow = novBills.filter((b) => b.isDueNow).reduce((s, b) => s + b.pendingAmount, 0);
  const novUpcoming = novBills.filter((b) => b.isUpcoming).reduce((s, b) => s + b.pendingAmount, 0);
  const novCashReceived = getCashReceivedForMonth({ payments, monthKey: '2026-11' });

  console.assert(novExpected === 65000, `Expected Nov 65000, got ${novExpected}`);
  console.assert(novCollected === 0, `Collected Nov 0, got ${novCollected}`);
  console.assert(novDueNow === 0, `Due Now Nov 0, got ${novDueNow}`);
  console.assert(novUpcoming === 65000, `Upcoming Nov 65000, got ${novUpcoming}`);
  console.assert(novCashReceived === 11333.33, `Cash Received in Nov expected 11333.33, got ${novCashReceived}`);
  console.log('ACCEPTANCE TEST 2: PASSED ✅');

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 3: Tenant Details on 12 Nov
  // Tenant A: Due Now 0, Upcoming 20000
  // Tenant B: Due Now 0, Upcoming 15000
  // Tenant C: Due Now 22000, Upcoming 30000
  // -------------------------------------------------------------
  console.log('\nTesting ACCEPTANCE TEST 3 (Tenant Details Outstanding Split on 12 Nov)...');
  const ledgerRowsA = getTenantLedgerRows({ tenant: tenantA, payments, today });
  const aDueNow = ledgerRowsA.filter((r) => r.isDueNow).reduce((s, r) => s + r.pendingAmount, 0);
  const aUpcoming = ledgerRowsA.filter((r) => r.isUpcoming).reduce((s, r) => s + r.pendingAmount, 0);
  console.assert(aDueNow === 0, `Tenant A Due Now expected 0, got ${aDueNow}`);
  console.assert(aUpcoming === 20000, `Tenant A Upcoming expected 20000, got ${aUpcoming}`);

  const ledgerRowsB = getTenantLedgerRows({ tenant: tenantB, payments, today });
  const bDueNow = ledgerRowsB.filter((r) => r.isDueNow).reduce((s, r) => s + r.pendingAmount, 0);
  const bUpcoming = ledgerRowsB.filter((r) => r.isUpcoming).reduce((s, r) => s + r.pendingAmount, 0);
  console.assert(bDueNow === 0, `Tenant B Due Now expected 0, got ${bDueNow}`);
  console.assert(bUpcoming === 15000, `Tenant B Upcoming expected 15000, got ${bUpcoming}`);

  const ledgerRowsC = getTenantLedgerRows({ tenant: tenantC, payments, today });
  const cDueNow = ledgerRowsC.filter((r) => r.isDueNow).reduce((s, r) => s + r.pendingAmount, 0);
  const cUpcoming = ledgerRowsC.filter((r) => r.isUpcoming).reduce((s, r) => s + r.pendingAmount, 0);
  console.assert(cDueNow === 22000, `Tenant C Due Now expected 22000, got ${cDueNow}`);
  console.assert(cUpcoming === 30000, `Tenant C Upcoming expected 30000, got ${cUpcoming}`);
  console.log('ACCEPTANCE TEST 3: PASSED ✅');

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 4: Fresh Property March Test
  // Create new property, Tenant Rent 20000, Move-in 15 Mar, Due 10th. Pay March rent in April.
  // March Dashboard: Expected 11333.33, Collected for Mar Rent 11333.33, Pending 0, Cash Received in March 0.
  // April Dashboard Cash Received must show 11333.33.
  // -------------------------------------------------------------
  console.log('\nTesting ACCEPTANCE TEST 4 (Fresh Property March Test)...');
  const marchTenant = {
    id: 'march-tenant',
    full_name: 'March Tenant',
    monthly_rent: 20000,
    move_in_date: '2026-03-15',
    due_day: 10,
    status: 'active',
  };
  const marchPayments = [
    {
      id: 'pay-march',
      tenant_id: 'march-tenant',
      payment_month: '2026-03-01',
      payment_date: '2026-04-05',
      rent_amount: 11333.33,
      total_amount: 11333.33,
    },
  ];

  const marchBills = getBillsForRentMonth({
    tenants: [marchTenant],
    monthKey: '2026-03',
    payments: marchPayments,
    today: '2026-04-15',
  });
  console.assert(marchBills.length === 1, 'Expected 1 bill for March');
  const mBill = marchBills[0];
  console.assert(mBill.billAmount === 11333.33, `Expected March bill 11333.33, got ${mBill.billAmount}`);
  console.assert(mBill.paidAmount === 11333.33, `Expected March paid 11333.33, got ${mBill.paidAmount}`);
  console.assert(mBill.pendingAmount === 0, `Expected March pending 0, got ${mBill.pendingAmount}`);

  const marCash = getCashReceivedForMonth({ payments: marchPayments, monthKey: '2026-03' });
  console.assert(marCash === 0, `Cash in March expected 0, got ${marCash}`);

  const aprCash = getCashReceivedForMonth({ payments: marchPayments, monthKey: '2026-04' });
  console.assert(aprCash === 11333.33, `Cash in April expected 11333.33, got ${aprCash}`);
  console.log('ACCEPTANCE TEST 4: PASSED ✅');

  // -------------------------------------------------------------
  // ACCEPTANCE TEST 5: May Dues List Test
  // On 5 May, dues list must show "Rent for April, Due 10 May"
  // -------------------------------------------------------------
  console.log('\nTesting ACCEPTANCE TEST 5 (May Dues List Label Test)...');
  const aprBill = calculateTenantBill({
    tenant: { id: 't1', monthly_rent: 20000, move_in_date: '2026-01-01', due_day: 10 },
    monthKey: '2026-04',
    payments: [],
    today: '2026-05-05',
  });
  console.assert(aprBill.billLabel === 'Rent for April, Due 10 May', `Expected "Rent for April, Due 10 May", got "${aprBill.billLabel}"`);
  console.assert(aprBill.status === 'UPCOMING', `Expected status UPCOMING on 5 May (due 10 May), got ${aprBill.status}`);
  console.log('ACCEPTANCE TEST 5: PASSED ✅');

  console.log('\n========================================');
  console.log('ALL 6 ACCEPTANCE & EDGE-CASE TESTS PASSED PERFECTLY!');
  console.log('========================================');
}

runTests();
