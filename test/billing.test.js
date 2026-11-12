import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateRentCharge,
  calculatePeriodRange,
  calculateDueDate,
  calculateTenantBill,
  getBillsForRentMonth,
  getCashReceivedForMonth,
  getTenantLedgerRows,
  getCollectButtonType,
  fmtBillLabel,
  roundToTwo,
} from '../src/utils/billing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Today: 12 Nov 2026
const MOCK_TODAY = '2026-11-12';

// Seed Test Data
const tenantA = {
  id: 'tenant-a',
  name: 'Tenant A',
  full_name: 'Tenant A',
  monthly_rent: 20000,
  rent: 20000,
  move_in_date: '2026-10-15',
  startDate: '2026-10-15',
  due_day: 10,
  dueDay: 10,
  status: 'active',
};

const tenantB = {
  id: 'tenant-b',
  name: 'Tenant B',
  full_name: 'Tenant B',
  monthly_rent: 15000,
  rent: 15000,
  move_in_date: '2026-11-01',
  startDate: '2026-11-01',
  due_day: 10,
  dueDay: 10,
  status: 'active',
};

const tenantC = {
  id: 'tenant-c',
  name: 'Tenant C',
  full_name: 'Tenant C',
  monthly_rent: 30000,
  rent: 30000,
  move_in_date: '2026-10-10',
  startDate: '2026-10-10',
  due_day: 10,
  dueDay: 10,
  status: 'active',
};

const seedTenants = [tenantA, tenantB, tenantC];

// Tenant A paid Oct bill (11333.33) on 8 Nov 2026
const seedPayments = [
  {
    id: 'pay-a-oct',
    tenant_id: 'tenant-a',
    tenantId: 'tenant-a',
    payment_month: '2026-10',
    paymentMonth: '2026-10',
    payment_date: '2026-11-08',
    paymentDate: '2026-11-08',
    rent_amount: 11333.33,
    amount: 11333.33,
    total_amount: 11333.33,
    totalAmount: 11333.33,
  },
];

describe('AUTOMATED RENT BILLING & DASHBOARD TEST SUITE', () => {

  test('TEST 1 - 30 DAY PRO-RATA', () => {
    // A Oct: 15 Oct to 31 Oct = 17 days -> 20000 / 30 * 17 = 11333.33
    const billAOct = calculateTenantBill({
      tenant: tenantA,
      monthKey: '2026-10',
      payments: seedPayments,
      today: MOCK_TODAY,
    });
    assert.strictEqual(billAOct.billAmount, 11333.33, 'Tenant A Oct bill must be 11333.33');

    // C Oct: 10 Oct to 31 Oct = 22 days -> 30000 / 30 * 22 = 22000
    const billCOct = calculateTenantBill({
      tenant: tenantC,
      monthKey: '2026-10',
      payments: seedPayments,
      today: MOCK_TODAY,
    });
    assert.strictEqual(billCOct.billAmount, 22000, 'Tenant C Oct bill must be 22000');

    // B Oct: Move-in 1 Nov, so Oct has no bill (null)
    const billBOct = calculateTenantBill({
      tenant: tenantB,
      monthKey: '2026-10',
      payments: seedPayments,
      today: MOCK_TODAY,
    });
    assert.strictEqual(billBOct, null, 'Tenant B Oct must have NO bill (null)');

    // Full month = full rent, not pro-rata
    const billANov = calculateTenantBill({ tenant: tenantA, monthKey: '2026-11', payments: seedPayments, today: MOCK_TODAY });
    const billBNov = calculateTenantBill({ tenant: tenantB, monthKey: '2026-11', payments: seedPayments, today: MOCK_TODAY });
    const billCNov = calculateTenantBill({ tenant: tenantC, monthKey: '2026-11', payments: seedPayments, today: MOCK_TODAY });
    assert.strictEqual(billANov.billAmount, 20000, 'Full Nov for Tenant A must be full rent 20000');
    assert.strictEqual(billBNov.billAmount, 15000, 'Full Nov for Tenant B must be full rent 15000');
    assert.strictEqual(billCNov.billAmount, 30000, 'Full Nov for Tenant C must be full rent 30000');

    // Cap test: Pro-rata can never exceed full rent even if stay is 31 days
    const cappedCharge = calculateRentCharge({
      monthlyRent: 20000,
      moveInDate: '2026-10-01',
      monthKey: '2026-10',
    });
    assert.strictEqual(cappedCharge, 20000, 'Full calendar month must be capped at monthly rent');

    const cappedPartial = calculateRentCharge({
      monthlyRent: 20000,
      moveInDate: '2026-10-02',
      monthKey: '2026-10',
    });
    // 30 days stayed out of 31 in Oct -> (20000/30)*30 = 20000, must not exceed 20000
    assert.ok(cappedPartial <= 20000, 'Partial calculation must not exceed full rent cap');
  });

  test('TEST 2 - DASHBOARD OCT, Rent Month = Oct, Today 12 Nov', () => {
    const octBills = getBillsForRentMonth({
      tenants: seedTenants,
      monthKey: '2026-10',
      payments: seedPayments,
      today: MOCK_TODAY,
    });

    const expected = roundToTwo(octBills.reduce((s, b) => s + b.billAmount, 0));
    const collected = roundToTwo(octBills.reduce((s, b) => s + b.paidAmount, 0));
    const pendingDueNow = roundToTwo(
      octBills.filter((b) => b.isDueNow).reduce((s, b) => s + b.pendingAmount, 0)
    );
    const cashInOct = getCashReceivedForMonth({
      payments: seedPayments,
      monthKey: '2026-10',
      tenants: seedTenants,
    });

    assert.strictEqual(expected, 33333.33, 'Dashboard Oct Expected must be 33333.33');
    assert.strictEqual(collected, 11333.33, 'Dashboard Oct Collected must be 11333.33');
    assert.strictEqual(pendingDueNow, 22000, 'Dashboard Oct Pending Due Now must be 22000');
    assert.strictEqual(cashInOct, 0, 'Dashboard Oct Cash Received must be 0');

    // Dashboard total must equal sum of Ledger bills for Oct
    const ledgerBillsA = getTenantLedgerRows({ tenant: tenantA, payments: seedPayments, today: MOCK_TODAY });
    const ledgerBillsB = getTenantLedgerRows({ tenant: tenantB, payments: seedPayments, today: MOCK_TODAY });
    const ledgerBillsC = getTenantLedgerRows({ tenant: tenantC, payments: seedPayments, today: MOCK_TODAY });

    const ledgerOctA = ledgerBillsA.find((b) => b.monthKey === '2026-10');
    const ledgerOctB = ledgerBillsB.find((b) => b.monthKey === '2026-10');
    const ledgerOctC = ledgerBillsC.find((b) => b.monthKey === '2026-10');

    const ledgerOctTotalExpected = roundToTwo((ledgerOctA?.billAmount || 0) + (ledgerOctB?.billAmount || 0) + (ledgerOctC?.billAmount || 0));
    const ledgerOctTotalCollected = roundToTwo((ledgerOctA?.paidAmount || 0) + (ledgerOctB?.paidAmount || 0) + (ledgerOctC?.paidAmount || 0));
    const ledgerOctTotalPending = roundToTwo((ledgerOctA?.pendingAmount || 0) + (ledgerOctB?.pendingAmount || 0) + (ledgerOctC?.pendingAmount || 0));

    assert.strictEqual(expected, ledgerOctTotalExpected, 'Dashboard Expected must exactly equal sum of Ledger bills');
    assert.strictEqual(collected, ledgerOctTotalCollected, 'Dashboard Collected must exactly equal sum of Ledger bills');
    assert.strictEqual(pendingDueNow, ledgerOctTotalPending, 'Dashboard Pending must exactly equal sum of Ledger bills');
  });

  test('TEST 3 - DASHBOARD NOV, Rent Month = Nov, Today 12 Nov', () => {
    const novBills = getBillsForRentMonth({
      tenants: seedTenants,
      monthKey: '2026-11',
      payments: seedPayments,
      today: MOCK_TODAY,
    });

    const expected = roundToTwo(novBills.reduce((s, b) => s + b.billAmount, 0));
    const collected = roundToTwo(novBills.reduce((s, b) => s + b.paidAmount, 0));
    const dueNow = roundToTwo(
      novBills.filter((b) => b.isDueNow).reduce((s, b) => s + b.pendingAmount, 0)
    );
    const upcomingExpected = roundToTwo(
      novBills.filter((b) => b.isUpcoming).reduce((s, b) => s + b.pendingAmount, 0)
    );
    const cashInNov = getCashReceivedForMonth({
      payments: seedPayments,
      monthKey: '2026-11',
      tenants: seedTenants,
    });

    assert.strictEqual(expected, 65000, 'Dashboard Nov Expected must be 65000');
    assert.strictEqual(collected, 0, 'Dashboard Nov Collected must be 0');
    assert.strictEqual(dueNow, 0, 'Dashboard Nov Due Now must be 0 (due 10 Dec)');
    assert.strictEqual(upcomingExpected, 65000, 'Dashboard Nov Upcoming Expected must be 65000');
    assert.strictEqual(cashInNov, 11333.33, 'Dashboard Nov Cash Received must be 11333.33');
  });

  test('TEST 4 - TENANT DETAILS', () => {
    // Tenant A
    const ledgerA = getTenantLedgerRows({ tenant: tenantA, payments: seedPayments, today: MOCK_TODAY });
    const dueNowA = roundToTwo(ledgerA.filter((r) => r.isDueNow).reduce((s, r) => s + r.pendingAmount, 0));
    const upcomingA = roundToTwo(ledgerA.filter((r) => r.isUpcoming).reduce((s, r) => s + r.pendingAmount, 0));
    assert.strictEqual(dueNowA, 0, 'Tenant A Due Now must be 0');
    assert.strictEqual(upcomingA, 20000, 'Tenant A Upcoming must be 20000');

    // Tenant B
    const ledgerB = getTenantLedgerRows({ tenant: tenantB, payments: seedPayments, today: MOCK_TODAY });
    const dueNowB = roundToTwo(ledgerB.filter((r) => r.isDueNow).reduce((s, r) => s + r.pendingAmount, 0));
    const upcomingB = roundToTwo(ledgerB.filter((r) => r.isUpcoming).reduce((s, r) => s + r.pendingAmount, 0));
    assert.strictEqual(dueNowB, 0, 'Tenant B Due Now must be 0');
    assert.strictEqual(upcomingB, 15000, 'Tenant B Upcoming must be 15000');

    // Tenant C
    const ledgerC = getTenantLedgerRows({ tenant: tenantC, payments: seedPayments, today: MOCK_TODAY });
    const dueNowC = roundToTwo(ledgerC.filter((r) => r.isDueNow).reduce((s, r) => s + r.pendingAmount, 0));
    const upcomingC = roundToTwo(ledgerC.filter((r) => r.isUpcoming).reduce((s, r) => s + r.pendingAmount, 0));
    assert.strictEqual(dueNowC, 22000, 'Tenant C Due Now must be 22000');
    assert.strictEqual(upcomingC, 30000, 'Tenant C Upcoming must be 30000');
  });

  test('TEST 5 - DUES LIST LABEL', () => {
    // Bill for April rent with Due Date 10 May
    const aprilDueDate = calculateDueDate('2026-04', 10);
    const aprilLabel = fmtBillLabel('2026-04', aprilDueDate);
    assert.strictEqual(aprilLabel, 'Rent for April, Due 10 May');

    // Bill for Oct rent with Due Date 10 Nov
    const octDueDate = calculateDueDate('2026-10', 10);
    const octLabel = fmtBillLabel('2026-10', octDueDate);
    assert.strictEqual(octLabel, 'Rent for October, Due 10 Nov');

    // Bill for Nov rent with Due Date 10 Dec
    const novDueDate = calculateDueDate('2026-11', 10);
    const novLabel = fmtBillLabel('2026-11', novDueDate);
    assert.strictEqual(novLabel, 'Rent for November, Due 10 Dec');

    // In calculateTenantBill, bill.billLabel must match this
    const sampleBill = calculateTenantBill({
      tenant: tenantA,
      monthKey: '2026-10',
      payments: seedPayments,
      today: MOCK_TODAY,
    });
    assert.strictEqual(sampleBill.billLabel, 'Rent for October, Due 10 Nov');
  });

  test('TEST 6 - COLLECT BUTTON', () => {
    // UPCOMING bill (Due Date > Today) -> "Advance"
    const upcomingBill = { status: 'UPCOMING', dueDate: '2026-12-10' };
    assert.strictEqual(getCollectButtonType(upcomingBill), 'Advance', 'Upcoming bill must return "Advance"');

    // DUE bill (Due Date === Today) -> "Normal Collect"
    const dueBill = { status: 'DUE', dueDate: '2026-11-12' };
    assert.strictEqual(getCollectButtonType(dueBill), 'Normal Collect', 'Due bill must return "Normal Collect"');

    // OVERDUE bill (Due Date < Today) -> "Normal Collect"
    const overdueBill = { status: 'OVERDUE', dueDate: '2026-11-10' };
    assert.strictEqual(getCollectButtonType(overdueBill), 'Normal Collect', 'Overdue bill must return "Normal Collect"');

    // PAID bill -> "Hidden"
    const paidBill = { status: 'PAID' };
    assert.strictEqual(getCollectButtonType(paidBill), 'Hidden', 'Paid bill must return "Hidden"');
  });

  test('TEST 7 - MARCH TEST', () => {
    const marchTenant = {
      id: 'tenant-march',
      name: 'March Tenant',
      monthly_rent: 20000,
      move_in_date: '2026-03-15',
      due_day: 10,
    };

    // March bill = 20000 / 30 * 17 = 11333.33, Due 10 Apr
    const marchBill = calculateTenantBill({
      tenant: marchTenant,
      monthKey: '2026-03',
      payments: [],
      today: '2026-03-20',
    });
    assert.strictEqual(marchBill.billAmount, 11333.33);
    assert.strictEqual(marchBill.dueDate, '2026-04-10');

    // Payment made in April for March rent
    const aprilPayment = [
      {
        id: 'pay-mar',
        tenant_id: 'tenant-march',
        payment_month: '2026-03',
        payment_date: '2026-04-05',
        rent_amount: 11333.33,
        total_amount: 11333.33,
      },
    ];

    const marchBills = getBillsForRentMonth({
      tenants: [marchTenant],
      monthKey: '2026-03',
      payments: aprilPayment,
      today: '2026-04-15',
    });

    const expectedMar = roundToTwo(marchBills.reduce((s, b) => s + b.billAmount, 0));
    const collectedMar = roundToTwo(marchBills.reduce((s, b) => s + b.paidAmount, 0));
    const pendingMar = roundToTwo(marchBills.reduce((s, b) => s + b.pendingAmount, 0));
    const cashInMarch = getCashReceivedForMonth({ payments: aprilPayment, monthKey: '2026-03' });
    const cashInApril = getCashReceivedForMonth({ payments: aprilPayment, monthKey: '2026-04' });

    assert.strictEqual(expectedMar, 11333.33, 'March Expected must be 11333.33');
    assert.strictEqual(collectedMar, 11333.33, 'March Collected must be 11333.33');
    assert.strictEqual(pendingMar, 0, 'March Pending must be 0');
    assert.strictEqual(cashInMarch, 0, 'March Cash Received must be 0');
    assert.strictEqual(cashInApril, 11333.33, 'April Cash Received must be 11333.33');
  });

  test('TEST 8 - SINGLE SOURCE OF TRUTH', () => {
    // Read Dashboard.jsx and TenantDetails.jsx source to verify both import and call billing.js functions
    const dashboardSrc = fs.readFileSync(path.join(__dirname, '../src/pages/Dashboard.jsx'), 'utf8');
    const tenantDetailsSrc = fs.readFileSync(path.join(__dirname, '../src/pages/TenantDetails.jsx'), 'utf8');

    // Assert Dashboard imports getBillsForRentMonth from billing
    assert.ok(
      dashboardSrc.includes('getBillsForRentMonth'),
      'Dashboard.jsx MUST import and call getBillsForRentMonth from billing.js'
    );

    // Assert Dashboard does not have its own separate pending dues calculation query
    assert.ok(
      !dashboardSrc.includes('.from(\'rent_charges\')'),
      'Dashboard.jsx must NOT query rent_charges independently'
    );

    // Assert TenantDetails imports getTenantLedgerRows from billing
    assert.ok(
      tenantDetailsSrc.includes('getTenantLedgerRows'),
      'TenantDetails.jsx MUST import and call getTenantLedgerRows from billing.js'
    );

    // Both getBillsForRentMonth and getTenantLedgerRows delegate to calculateTenantBill
    const octBills = getBillsForRentMonth({ tenants: [tenantA], monthKey: '2026-10', payments: seedPayments, today: MOCK_TODAY });
    const ledgerA = getTenantLedgerRows({ tenant: tenantA, payments: seedPayments, today: MOCK_TODAY });
    const ledgerAOct = ledgerA.find((b) => b.monthKey === '2026-10');

    assert.deepStrictEqual(octBills[0].billAmount, ledgerAOct.billAmount, 'Dashboard billAmount must match Ledger billAmount');
    assert.deepStrictEqual(octBills[0].pendingAmount, ledgerAOct.pendingAmount, 'Dashboard pendingAmount must match Ledger pendingAmount');
    assert.deepStrictEqual(octBills[0].status, ledgerAOct.status, 'Dashboard status must match Ledger status');
  });

  test('TEST 9 - DO NOT BREAK PASSING TESTS', () => {
    // 1. Move-in 15 Mar period = 15 Mar to 31 Mar, Due 10 Apr
    const mar15Period = calculatePeriodRange('2026-03-15', '2026-03');
    assert.strictEqual(mar15Period.range, '15 Mar 2026 to 31 Mar 2026');
    assert.strictEqual(calculateDueDate('2026-03', 10), '2026-04-10');

    // 2. Move-in 1 Mar = full 20000
    const mar1Charge = calculateRentCharge({
      monthlyRent: 20000,
      moveInDate: '2026-03-01',
      monthKey: '2026-03',
    });
    assert.strictEqual(mar1Charge, 20000);

    // 3. April bill = 1 Apr to 30 Apr even if Due Day is 10, 15 or 25
    const aprPeriod10 = calculatePeriodRange('2026-01-01', '2026-04');
    assert.strictEqual(aprPeriod10.range, '1 Apr 2026 to 30 Apr 2026');

    // 4. Change Due Day 10 to 5: Only future bills change Due Date, past bills do not change
    const octDue10 = calculateDueDate('2026-10', 10);
    const novDue5 = calculateDueDate('2026-11', 5);
    assert.strictEqual(octDue10, '2026-11-10', 'Past Oct bill due day remains 10th');
    assert.strictEqual(novDue5, '2026-12-05', 'Future Nov bill due day changes to 5th');
  });
});

