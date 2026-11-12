import { calculateTenantBill, getPrevMonthKey } from './billing';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const checkAndTriggerRentNotifications = (tenants, lang = 'en', payments = []) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  const lastCheck = localStorage.getItem('last_notification_date');

  if (lastCheck === todayDateStr) {
    return;
  }

  const todayMonthKey = todayDateStr.slice(0, 7);
  const prevMonthKey = getPrevMonthKey(todayMonthKey);

  // In post-paid rent, rent for prevMonthKey is due in todayMonthKey
  const dueTenantsWithBills = (tenants || [])
    .map((tenant) => {
      const bill = calculateTenantBill({
        tenant,
        monthKey: prevMonthKey,
        payments,
        today,
      });
      return { tenant, bill };
    })
    .filter(({ bill }) => bill && bill.isDueNow && bill.pendingAmount > 0);

  if (dueTenantsWithBills.length > 0) {
    const title = lang === 'mr' ? '🔔 भाडे वसुली स्मरणपत्र' : lang === 'hi' ? '🔔 किराया देय रिमाइंडर' : '🔔 Rent Due Reminder';
    const firstItem = dueTenantsWithBills[0];
    const body =
      dueTenantsWithBills.length === 1
        ? `${firstItem.tenant.name || firstItem.tenant.full_name} (${firstItem.tenant.unit || firstItem.tenant.unit_label || ''}) - ${firstItem.bill.billLabel} - ₹${firstItem.bill.pendingAmount.toLocaleString('en-IN')}`
        : `${dueTenantsWithBills.length} tenants have rent due (${firstItem.bill.billLabel})`;

    new Notification(title, {
      body,
      icon: '/favicon.ico',
    });

    localStorage.setItem('last_notification_date', todayDateStr);
  }
};
