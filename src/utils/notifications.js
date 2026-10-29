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

export const checkAndTriggerRentNotifications = (tenants, lang = 'en') => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const today = new Date();
  const currentDay = today.getDate();
  const todayDateStr = today.toISOString().split('T')[0];
  const lastCheck = localStorage.getItem('last_notification_date');

  if (lastCheck === todayDateStr) {
    return;
  }

  const dueTenants = tenants.filter((tenant) => {
    if (!tenant.startDate || tenant.status === 'Paid') return false;
    const startDay = new Date(tenant.startDate).getDate();
    return currentDay >= startDay;
  });

  if (dueTenants.length > 0) {
    const title = lang === 'mr' ? '🔔 भाडे वसुली स्मरणपत्र' : lang === 'hi' ? '🔔 किराया देय रिमाइंडर' : '🔔 Rent Due Reminder';
    const body =
      dueTenants.length === 1
        ? `${dueTenants[0].name} (${dueTenants[0].unit}) - ₹${dueTenants[0].rent}`
        : `${dueTenants.length} tenants have rent due today.`;

    new Notification(title, {
      body,
      icon: '/favicon.ico',
    });

    localStorage.setItem('last_notification_date', todayDateStr);
  }
};