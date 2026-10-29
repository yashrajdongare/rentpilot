export const mockDashboardData = {
  stats: {
    totalExpected: 75000,
    collected: 52000,
    pending: 23000,
    occupancy: "8/10 Units",
  },
  recentPayments: [
    { id: 1, tenant: "Rahul Patil", unit: "Flat 101", amount: 12000, date: "2026-08-05", mode: "UPI" },
    { id: 2, tenant: "Amit Sharma", unit: "Room 2", amount: 8000, date: "2026-08-04", mode: "Cash" },
  ],
  overdueTenants: [
    { id: 3, tenant: "Sagar Shinde", unit: "Flat 204", amount: 15000, phone: "9876543210" },
  ]
};