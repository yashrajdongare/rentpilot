import { calculateRentCharge, calculatePeriodRange } from './src/utils/billing.js';

function runTests() {
  console.log('Testing calculateRentCharge and calculatePeriodRange...');
  
  // Test A: March 2026 proration
  // Move-in: 15 March 2026, Rent: 15,000. 15-31 March = 17 days of 31 days.
  // 15000 * 17 / 31 = 8225.80645... => 8225.81
  const marchCharge = calculateRentCharge({
    monthlyRent: 15000,
    moveInDate: '2026-03-15',
    monthKey: '2026-03',
  });
  console.assert(marchCharge === 8225.81, `Expected 8225.81, got ${marchCharge}`);
  
  const marchRange = calculatePeriodRange('2026-03-15', '2026-03');
  console.assert(marchRange.range === '15 Mar 2026 to 31 Mar 2026', `Range mismatch: ${marchRange.range}`);
  console.assert(marchRange.isProrated === true, 'Expected isProrated true');
  console.assert(marchRange.eligibleDays === 17, `Expected 17 days, got ${marchRange.eligibleDays}`);

  // Test B: Full calendar month April 2026
  const aprilCharge = calculateRentCharge({
    monthlyRent: 15000,
    moveInDate: '2026-03-15',
    monthKey: '2026-04',
  });
  console.assert(aprilCharge === 15000, `Expected 15000, got ${aprilCharge}`);
  const aprilRange = calculatePeriodRange('2026-03-15', '2026-04');
  console.assert(aprilRange.range === '1 Apr 2026 to 30 Apr 2026', `Range mismatch: ${aprilRange.range}`);
  console.assert(aprilRange.isProrated === false, 'Expected isProrated false');

  // Test C: First day move-in (1st March)
  const fullMarch = calculateRentCharge({
    monthlyRent: 15000,
    moveInDate: '2026-03-01',
    monthKey: '2026-03',
  });
  console.assert(fullMarch === 15000, `Expected 15000 for 1st of month, got ${fullMarch}`);

  // Test D: Last day move-in (31st March)
  // 15000 * 1 / 31 = 483.87
  const lastDayMarch = calculateRentCharge({
    monthlyRent: 15000,
    moveInDate: '2026-03-31',
    monthKey: '2026-03',
  });
  console.assert(lastDayMarch === 483.87, `Expected 483.87, got ${lastDayMarch}`);

  // Test E: Leap year Feb 2024 (29 days). Move-in 15 Feb 2024 -> 15-29 Feb = 15 days.
  // 15000 * 15 / 29 = 7758.62
  const leapFeb = calculateRentCharge({
    monthlyRent: 15000,
    moveInDate: '2024-02-15',
    monthKey: '2024-02',
  });
  console.assert(leapFeb === 7758.62, `Expected 7758.62, got ${leapFeb}`);

  // Test F: Non-leap Feb 2026 (28 days). Move-in 15 Feb 2026 -> 15-28 Feb = 14 days.
  // 15000 * 14 / 28 = 7500.00
  const nonLeapFeb = calculateRentCharge({
    monthlyRent: 15000,
    moveInDate: '2026-02-15',
    monthKey: '2026-02',
  });
  console.assert(nonLeapFeb === 7500.00, `Expected 7500.00, got ${nonLeapFeb}`);

  console.log('All tests passed successfully!');
}

runTests();
