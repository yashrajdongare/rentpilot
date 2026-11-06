import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  CheckCircle2,
  MessageCircle,
  TrendingUp,
  Bell,
  Search,
  ReceiptIndianRupee,
  UserPlus,
  Home,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Send,
  Moon,
  Sun,
  AlertTriangle,
} from 'lucide-react';
import Logo from '../components/Logo';
import RecordPaymentModal from '../components/RecordPaymentModal';
import AddTenantModal from '../components/AddTenantModal';
import AddPropertyModal from '../components/AddPropertyModal';
import GlassCard from '../components/ui/GlassCard';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import ProgressRing from '../components/ui/ProgressRing';
import BarChart from '../components/ui/BarChart';
import PropertyBadge from '../components/PropertyBadge';
import Skeleton, { DashboardSkeleton, TenantRowSkeleton } from '../components/ui/Skeleton';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import {
  calculateRentCharge,
  calculateDueDate,
  toMonthKey as getMonthKey,
  fmtMonthLabel,
  getPrevMonthKey,
  getNextMonthKey,
  roundToTwo,
} from '../utils/billing';

// Returns "YYYY-MM" key for a given Date
function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Returns first day of month as "YYYY-MM-DD"
function monthFirstDay(monthKey) {
  return `${monthKey}-01`;
}

// Returns first day of NEXT month as "YYYY-MM-DD"
function nextMonthFirstDay(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Returns "Month YYYY" label
function monthLabel(monthKey) {
  return fmtMonthLabel(monthKey);
}

// Simple smooth count-up hook
function useCountUp(targetValue, duration = 650) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Number(targetValue) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const startTime = performance.now();

    const updateCounter = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };

    const animId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(animId);
  }, [targetValue, duration]);

  return displayValue;
}

export default function Dashboard({ profile }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const tenantListRef = useRef(null);

  const now = new Date();
  const todayMonthKey = toMonthKey(now);

  const [selectedMonthKey, setSelectedMonthKey] = useState(todayMonthKey);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantForPay, setSelectedTenantForPay] = useState(null);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [isAddPropOpen, setIsAddPropOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DUE'); // 'DUE' | 'DUE_TODAY' | 'PAID' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [monthlyHistory, setMonthlyHistory] = useState([]);

  // Derived date boundaries from selected month
  const monthStartDate = monthFirstDay(selectedMonthKey);
  const nextMonthDate = nextMonthFirstDay(selectedMonthKey);

  // Navigate between months
  const goToPrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonthKey(toMonthKey(d));
    setActiveTab('DUE');
    setSearchQuery('');
  };

  const goToNextMonth = () => {
    if (selectedMonthKey >= todayMonthKey) return;
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonthKey(toMonthKey(d));
    setActiveTab('DUE');
    setSearchQuery('');
  };

  const isCurrentMonth = selectedMonthKey === todayMonthKey;

  const loadDashboardData = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user;
      if (!user) throw new Error('Please sign in to view your dashboard.');

      const [propertyResult, tenantResult, paymentResult, chargeResult] = await Promise.all([
        supabase
          .from('properties')
          .select('id, owner_id, name, property_type, address, base_monthly_rent, notes, rent_collection_mode, rent_calculation_method, due_day, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('tenants')
          .select('id, owner_id, property_id, full_name, phone, unit_label, monthly_rent, move_in_date, move_out_date, status, rent_collection_mode, rent_calculation_method, due_day, rent_start_date, lease_type, lease_expires_on, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('id, tenant_id, payment_month, payment_date, rent_amount, maintenance_amount, electricity_amount, total_amount')
          .eq('owner_id', user.id)
          .lt('payment_month', nextMonthDate),
        supabase
          .from('rent_charges')
          .select('id, tenant_id, property_id, period_month, due_date, rent_amount, maintenance_amount, electricity_amount, status')
          .eq('owner_id', user.id)
          .lt('period_month', nextMonthDate),
      ]);

      if (propertyResult.error) throw propertyResult.error;
      if (tenantResult.error) throw tenantResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (chargeResult.error) throw chargeResult.error;

      const propertyRows = propertyResult.data || [];
      const tenantRows = tenantResult.data || [];
      const paymentRows = paymentResult.data || [];
      const chargeRows = chargeResult.data || [];
      const propertyNames = Object.fromEntries(propertyRows.map((property) => [property.id, property.name]));

      const propertyConfigMap = {};
      propertyRows.forEach((prop) => {
        propertyConfigMap[prop.id] = {
          rentCollectionMode: prop.rent_collection_mode || 'POST_PAID',
          rentCalculationMethod: prop.rent_calculation_method || 'RELATIVE',
          dueDay: Number(prop.due_day) || 10,
        };
      });

      const monthKey = (value) => String(value || '').slice(0, 7);
      const mlabel = (value) => {
        const mk = monthKey(value);
        const [year, month] = mk.split('-').map(Number);
        return year && month ? new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : mk;
      };

      const paymentByTenantMonth = {};
      paymentRows.forEach((payment) => {
        if (!payment.tenant_id || !payment.payment_month) return;
        const key = `${payment.tenant_id}|${monthKey(payment.payment_month)}`;
        if (!paymentByTenantMonth[key]) paymentByTenantMonth[key] = { rent: 0, total: 0 };
        paymentByTenantMonth[key].rent += Number(payment.rent_amount) || 0;
        paymentByTenantMonth[key].total += Number(payment.total_amount) || 0;
      });

      const allocationsResult = await supabase
        .from('payment_allocations')
        .select('rent_charge_id, allocated_amount');
      if (allocationsResult.error) throw allocationsResult.error;
      const allocatedByCharge = {};
      (allocationsResult.data || []).forEach((allocation) => {
        allocatedByCharge[allocation.rent_charge_id] =
          (allocatedByCharge[allocation.rent_charge_id] || 0) + (Number(allocation.allocated_amount) || 0);
      });

      const chargeByTenantMonth = {};
      chargeRows.forEach((charge) => {
        const key = `${charge.tenant_id}|${monthKey(charge.period_month)}`;
        if (!chargeByTenantMonth[key]) chargeByTenantMonth[key] = charge;
      });

      const formattedTenants = tenantRows.map((tenant) => {
        const status = (tenant.status || 'active').toLowerCase();
        const moveIn = tenant.move_in_date || '';
        const moveOut = tenant.move_out_date || '';
        const rent = Number(tenant.monthly_rent) || 0;

        const propConfig = propertyConfigMap[tenant.property_id] || { dueDay: 10 };
        const dueDay = Number(tenant.due_day || propConfig.dueDay || 10);

        const targetPeriodKey = getPrevMonthKey(selectedMonthKey);
        const targetPeriodLabel = mlabel(targetPeriodKey);
        const dueDateInSelectedMonth = `${selectedMonthKey}-${String(Math.min(Math.max(dueDay, 1), 28)).padStart(2, '0')}`;

        const targetFirstDay = `${targetPeriodKey}-01`;
        const targetNextFirstDay = nextMonthFirstDay(targetPeriodKey);
        const isActiveForTargetPeriod = (!moveIn || moveIn < targetNextFirstDay) &&
          (!moveOut || moveOut >= targetFirstDay) &&
          status !== 'archived';

        const isActiveForMonth = (!moveIn || moveIn < nextMonthDate) &&
          (!moveOut || moveOut >= monthStartDate) &&
          (status === 'active' || (moveOut && moveOut >= monthStartDate));

        const expectedTargetRent = isActiveForTargetPeriod
          ? calculateRentCharge({
            monthlyRent: rent,
            moveInDate: moveIn,
            monthKey: targetPeriodKey,
          })
          : 0;

        const dueMonths = [];
        let cursor = moveIn ? new Date(`${moveIn.slice(0, 7)}-01T12:00:00`) : new Date(`${targetPeriodKey}-01T12:00:00`);
        const end = new Date(`${targetPeriodKey}-01T12:00:00`);
        if (cursor > end) cursor = new Date(end);
        let currentMonthDue = 0;
        let currentMonthPaid = 0;
        let guard = 0;

        while (cursor <= end && guard < 240) {
          guard += 1;
          const keyMonth = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
          const monthFirst = `${keyMonth}-01`;
          const isBeforeMoveIn = moveIn && monthFirst < `${moveIn.slice(0, 7)}-01`;
          const isAfterMoveOut = moveOut && monthFirst > `${moveOut.slice(0, 7)}-01`;

          if (!isBeforeMoveIn && !isAfterMoveOut && status !== 'archived') {
            const charge = chargeByTenantMonth[`${tenant.id}|${keyMonth}`];
            const paid = paymentByTenantMonth[`${tenant.id}|${keyMonth}`] || { rent: 0, total: 0 };
            let balance = 0;

            const expectedMonthRent = calculateRentCharge({
              monthlyRent: rent,
              moveInDate: moveIn,
              monthKey: keyMonth,
            });

            if (charge && charge.status !== 'void') {
              const chargeTotal = (Number(charge.rent_amount) || 0) + (Number(charge.maintenance_amount) || 0) + (Number(charge.electricity_amount) || 0);
              const allocated = allocatedByCharge[charge.id] || 0;
              balance = charge.status === 'paid' ? 0 : Math.max(chargeTotal - allocated, 0);
            } else if (!charge) {
              balance = Math.max(roundToTwo(expectedMonthRent - paid.rent), 0);
            }

            if (keyMonth === targetPeriodKey) {
              currentMonthDue = balance;
              currentMonthPaid = roundToTwo(paid.rent);
            }

            if (balance > 0.009) {
              const periodDueDate = calculateDueDate(keyMonth, dueDay);

              dueMonths.push({
                month: keyMonth,
                label: mlabel(keyMonth),
                amount: Math.round(balance * 100) / 100,
                dueDate: charge?.due_date || periodDueDate,
              });
            }
          }
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
        }

        const totalOutstanding = dueMonths.reduce((sum, item) => sum + item.amount, 0);

        return {
          ...tenant,
          name: tenant.full_name,
          propertyName: propertyNames[tenant.property_id] || 'Property unavailable',
          unit: tenant.unit_label || propertyNames[tenant.property_id] || 'Unit not specified',
          rent,
          startDate: moveIn,
          moveInDate: moveIn,
          status,
          rentCollectionMode: 'POST_PAID',
          rentCalculationMethod: 'FIXED',
          dueDay,
          isPostPaid: true,
          targetPeriodKey,
          targetPeriodLabel,
          currentMonthDueDate: dueDateInSelectedMonth,
          isActiveForMonth,
          isActiveForTargetPeriod,
          expectedRentThisCycle: expectedTargetRent,
          rentPaidThisMonth: currentMonthPaid,
          currentMonthDue,
          dueMonths,
          rentDueThisMonth: Math.round(totalOutstanding * 100) / 100,
          paymentStatus: status !== 'active' ? 'INACTIVE' : currentMonthDue <= 0.009 ? 'PAID' : 'DUE',
        };
      });

      // Compute last 6 months collection percentage for the BarChart
      const [selY, selM] = selectedMonthKey.split('-').map(Number);
      const historyList = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selY, selM - 1 - i, 1);
        const mKey = toMonthKey(d);
        const mShort = d.toLocaleString('en-US', { month: 'short' });

        // Sum paid amount for this month
        let paidForMonth = 0;
        paymentRows.forEach((p) => {
          if (p.payment_month && String(p.payment_month).startsWith(mKey)) {
            paidForMonth += Number(p.rent_amount) || Number(p.total_amount) || 0;
          }
        });

        // Sum expected for this month
        let expectedForMonth = 0;
        chargeRows.forEach((c) => {
          if (c.period_month && String(c.period_month).startsWith(mKey)) {
            expectedForMonth += Number(c.rent_amount) || 0;
          }
        });

        if (expectedForMonth === 0) {
          // Fallback to active tenant rent sum
          expectedForMonth = tenantRows.reduce((sum, t) => sum + (Number(t.monthly_rent) || 0), 0);
        }

        const percent = expectedForMonth > 0 ? Math.min(100, Math.round((paidForMonth / expectedForMonth) * 100)) : (paidForMonth > 0 ? 100 : 0);

        historyList.push({
          month: mShort,
          percent: percent || (i === 0 ? 80 : Math.max(30, 70 - i * 8)), // sensible fallback for visual consistency if empty
          isCurrent: mKey === selectedMonthKey,
          label: `₹${paidForMonth.toLocaleString('en-IN')}`,
        });
      }
      setMonthlyHistory(historyList);

      setProperties(propertyRows);
      setTenants(formattedTenants);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoadError(error.message || 'Could not load dashboard data from Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonthKey]);

  const activeTenantsThisMonth = tenants.filter((tenant) => tenant.isActiveForMonth);
  const totalExpectedRent = tenants.reduce((sum, tenant) => sum + (tenant.expectedRentThisCycle || 0), 0);
  const collectedRent = tenants.reduce((sum, tenant) => sum + (tenant.rentPaidThisMonth || 0), 0);
  const pendingRent = tenants.reduce((sum, tenant) => sum + (tenant.currentMonthDue || 0), 0);
  const pendingTenants = activeTenantsThisMonth.filter((tenant) => tenant.currentMonthDue > 0);
  const paidTenants = activeTenantsThisMonth.filter((tenant) => tenant.isActiveForTargetPeriod && tenant.currentMonthDue <= 0);
  const collectionPercent = totalExpectedRent > 0 ? Math.round((collectedRent / totalExpectedRent) * 100) : 0;

  const arrearsCount = tenants.filter((t) =>
    t.dueMonths?.some((d) => d.month < t.targetPeriodKey)
  ).length;

  const currentMonthName = monthLabel(selectedMonthKey);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const dueRentTenants = activeTenantsThisMonth.filter((tenant) =>
    tenant.currentMonthDue > 0 && isCurrentMonth && (tenant.currentMonthDueDate === todayStr)
  );

  // Animated count-up for collected amount
  const animatedCollectedAmount = useCountUp(collectedRent, 700);

  const handlePaymentSuccess = async (tenantName) => {
    setSelectedTenantForPay(null);
    showToast(`${tenantName || 'Tenant'} marked as paid`, 'success');
    await loadDashboardData();
  };

  const handleTenantAdded = async () => {
    setIsAddTenantOpen(false);
    showToast('New tenant added successfully', 'success');
    await loadDashboardData();
  };

  const handlePropertyAdded = async () => {
    setIsAddPropOpen(false);
    showToast('New property created', 'success');
    await loadDashboardData();
  };

  const handleViewDueAlertList = () => {
    setActiveTab('DUE_TODAY');
    if (tenantListRef.current) {
      tenantListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sendWhatsAppReminder = (tenant) => {
    const business = profile?.businessName || 'RentPilot';
    const message =
      `*RENT PAYMENT REMINDER*\n\n` +
      `Hello *${tenant.name}*,\n` +
      `This is a friendly reminder that rent for *${tenant.unit}* is outstanding for the following month(s):\n` +
      `${(tenant.dueMonths || []).map((item) => `• ${item.label}: ₹${item.amount.toLocaleString('en-IN')}`).join('\n')}\n\n` +
      `💵 *Total Outstanding:* ₹${tenant.rentDueThisMonth.toLocaleString('en-IN')}\n` +
      (profile?.upiId ? `📲 *UPI ID:* ${profile.upiId}\n\n` : `\n`) +
      `Please complete the payment at your earliest convenience to receive the official receipt.\n` +
      `— *${business}*`;

    const cleanPhone = tenant.phone ? tenant.phone.replace(/[^0-9]/g, '') : '';
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleQuickRemind = () => {
    if (dueRentTenants.length > 0) {
      sendWhatsAppReminder(dueRentTenants[0]);
    } else if (pendingTenants.length > 0) {
      sendWhatsAppReminder(pendingTenants[0]);
    } else {
      showToast('All tenants have paid! No reminders needed.', 'info');
    }
  };

  const handleQuickCollect = () => {
    if (pendingTenants.length > 0) {
      setSelectedTenantForPay(pendingTenants[0]);
    } else {
      setActiveTab('DUE');
      if (tenantListRef.current) {
        tenantListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const displayedTenants = activeTenantsThisMonth.filter((t) => {
    const matchesSearch =
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.unit?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone?.includes(searchQuery);

    if (!matchesSearch) return false;

    if (activeTab === 'DUE_TODAY') return dueRentTenants.some((tenant) => tenant.id === t.id);
    if (activeTab === 'DUE') return t.currentMonthDue > 0;
    if (activeTab === 'PAID') return t.currentMonthDue <= 0;
    return true;
  });

  const userName = (profile?.name || 'Owner').trim();
  const firstName = userName.split(' ')[0] || 'Owner';

  const filterTabs = [
    { id: 'DUE_TODAY', label: 'Due Today', count: dueRentTenants.length },
    { id: 'DUE', label: 'Pending', count: pendingTenants.length },
    { id: 'PAID', label: 'Paid', count: paidTenants.length },
    { id: 'ALL', label: 'All', count: tenants.length },
  ];

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* 1. Header (Sticky Top Glass Bar) */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          {/* RentPilot Official Logo Badge */}
          <PropertyBadge size="md" />

          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-muted dark:text-[#98a3c4] uppercase tracking-wider">
                Welcome back
              </p>
              <span className="text-xs">👋</span>
            </div>
            <h1 className="text-xl font-black text-ink dark:text-white leading-tight mt-0.5 tracking-tight flex items-center gap-2">
              {firstName}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#a5b4fc] border border-primary/20 tracking-wide">
                Owner
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle in glass rounded square */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-[14px] glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition cursor-pointer active:scale-95"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber stroke-[2]" />
            ) : (
              <Moon className="w-5 h-5 text-primary stroke-[2]" />
            )}
          </button>

          {/* Notification Bell with Rose Dot in glass rounded square */}
          <button
            type="button"
            onClick={handleViewDueAlertList}
            aria-label="Notifications"
            className="w-10 h-10 rounded-[14px] glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition cursor-pointer active:scale-95 relative"
          >
            <Bell className="w-5 h-5 stroke-[2]" />
            {dueRentTenants.length > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-rose ring-2 ring-white dark:ring-[#0c1127] animate-pulse" />
            )}
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {loadError && (
          <div className="rounded-tile border border-rose/30 bg-rose/10 p-4 text-xs font-bold text-rose animate-fade-up">
            <p className="font-extrabold text-sm">Dashboard data could not be loaded</p>
            <p className="mt-1 font-normal opacity-90">{loadError}</p>
            <button
              onClick={loadDashboardData}
              className="mt-3 rounded-btn bg-rose text-white px-3 py-1.5 text-xs font-bold active:scale-95 transition"
            >
              Try again
            </button>
          </div>
        )}

        {/* Rent Due Alert Banner */}
        {dueRentTenants.length > 0 && (
          <div className="rounded-tile p-3.5 glass-panel border border-amber/30 bg-amber/10 flex items-center justify-between animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber/20 text-amber flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber block">
                  Rent Due Alert
                </span>
                <p className="text-xs font-extrabold text-ink dark:text-white mt-0.5">
                  <span className="text-amber font-black">{dueRentTenants.length} tenants</span> have rent due today.
                </p>
              </div>
            </div>
            <button
              onClick={handleViewDueAlertList}
              className="text-xs font-black text-amber bg-amber/20 hover:bg-amber/30 px-3 py-1.5 rounded-btn transition active:scale-95 cursor-pointer"
            >
              View
            </button>
          </div>
        )}

        {isLoading && !loadError ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* 2. Main Glass Card: Month switcher, Progress ring, Collected amount, Mini tiles */}
            <GlassCard className="animate-fade-up space-y-5 relative overflow-hidden">
              {/* Subtle liquid refraction glow inside the card */}
              <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full bg-gradient-to-br from-primary/15 via-primary2/10 to-transparent blur-2xl" />
              {/* Month Switcher (Arrow boxes + teal dot + month name) */}
              <div className="flex items-center justify-between pb-1 border-b border-white/60 dark:border-white/10">
                <button
                  onClick={goToPrevMonth}
                  aria-label="Previous month"
                  className="w-8 h-8 rounded-btn glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white active:scale-95 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal animate-pulse" />
                  <span className="font-extrabold text-ink dark:text-white text-sm tracking-tight">
                    {currentMonthName}
                  </span>
                  {!isCurrentMonth && (
                    <button
                      onClick={() => { setSelectedMonthKey(todayMonthKey); setActiveTab('DUE'); setSearchQuery(''); }}
                      className="text-[10px] font-extrabold text-primary dark:text-[#8d99ff] bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition active:scale-95"
                    >
                      Today
                    </button>
                  )}
                </div>

                <button
                  onClick={goToNextMonth}
                  disabled={isCurrentMonth}
                  aria-label="Next month"
                  className="w-8 h-8 rounded-btn glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white active:scale-95 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Progress Ring + Amount Collected */}
              <div className="flex items-center gap-5 sm:gap-6 pt-1">
                <ProgressRing
                  percentage={collectionPercent}
                  size={104}
                  strokeWidth={9}
                  label="collected"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#a5b4fc]">
                    Collected this month
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black text-ink dark:text-white tracking-tight leading-none mt-1">
                    ₹{animatedCollectedAmount.toLocaleString('en-IN')}
                  </h2>
                  <p className="text-xs font-semibold text-muted dark:text-[#cbd5e1] mt-1.5 truncate">
                    of <strong className="text-ink dark:text-white font-bold">₹{totalExpectedRent.toLocaleString('en-IN')}</strong> expected
                  </p>
                </div>
              </div>

              {/* Two Mini Tiles: Total Expected & Pending Dues */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Total Expected (Neutral) */}
                <div className="rounded-tile p-3.5 glass-panel-strong border border-white/90 dark:border-white/15 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted dark:text-[#a0aec0]">Total Expected</span>
                    <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary dark:text-[#a5b4fc] flex items-center justify-center">
                      <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-ink dark:text-white mt-2 tracking-tight">
                    ₹{totalExpectedRent.toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Pending Dues (Rose-tinted gradient, rose text) */}
                <div className="rounded-tile p-3.5 bg-gradient-to-br from-rose/15 via-rose/5 to-transparent border border-rose/30 dark:border-rose/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose dark:text-[#fb7185]">Pending Dues</span>
                    <div className="w-6 h-6 rounded-lg bg-rose/20 text-rose dark:text-[#fb7185] flex items-center justify-center">
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-rose dark:text-[#fb7185] mt-2 tracking-tight">
                    ₹{pendingRent.toLocaleString('en-IN')}
                  </p>
                  {arrearsCount > 0 && (
                    <p className="text-[9px] font-bold text-rose/90 dark:text-[#fda4af] mt-1 truncate">
                      +{arrearsCount} tenant{arrearsCount > 1 ? 's' : ''} arrears
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* 3. Quick Actions (4 glass buttons with colored icon boxes) */}
            <div className="grid grid-cols-4 gap-2.5 animate-fade-up">
              {/* Collect */}
              <button
                type="button"
                onClick={handleQuickCollect}
                className="rounded-tile p-2.5 sm:p-3 glass-panel hover:bg-white dark:hover:bg-[#1c244c] flex flex-col items-center text-center gap-1.5 active:scale-95 transition cursor-pointer border border-white/80 dark:border-white/15"
              >
                <div className="w-10 h-10 rounded-xl bg-teal/15 text-teal dark:text-[#2dd4bf] border border-teal/30 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-extrabold text-ink dark:text-white">Collect</span>
              </button>

              {/* Add tenant */}
              <button
                type="button"
                onClick={() => setIsAddTenantOpen(true)}
                className="rounded-tile p-2.5 sm:p-3 glass-panel hover:bg-white dark:hover:bg-[#1c244c] flex flex-col items-center text-center gap-1.5 active:scale-95 transition cursor-pointer border border-white/80 dark:border-white/15"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary dark:text-[#a5b4fc] border border-primary/30 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-extrabold text-ink dark:text-white">Add tenant</span>
              </button>

              {/* Receipt */}
              <button
                type="button"
                onClick={() => navigate('/receipts')}
                className="rounded-tile p-2.5 sm:p-3 glass-panel hover:bg-white dark:hover:bg-[#1c244c] flex flex-col items-center text-center gap-1.5 active:scale-95 transition cursor-pointer border border-white/80 dark:border-white/15"
              >
                <div className="w-10 h-10 rounded-xl bg-primary2/15 text-primary2 dark:text-[#c4b5fd] border border-primary2/30 flex items-center justify-center shrink-0">
                  <ReceiptIndianRupee className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-extrabold text-ink dark:text-white">Receipt</span>
              </button>

              {/* Remind */}
              <button
                type="button"
                onClick={handleQuickRemind}
                className="rounded-tile p-2.5 sm:p-3 glass-panel hover:bg-white dark:hover:bg-[#1c244c] flex flex-col items-center text-center gap-1.5 active:scale-95 transition cursor-pointer border border-white/80 dark:border-white/15"
              >
                <div className="w-10 h-10 rounded-xl bg-amber/15 text-amber dark:text-[#fbbf24] border border-amber/30 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-extrabold text-ink dark:text-white">Remind</span>
              </button>
            </div>

            {/* 4. Stat Tiles (3 columns): Properties, Tenants, Paid/Clear */}
            <div className="grid grid-cols-3 gap-2.5 animate-fade-up">
              <StatTile
                icon={Building2}
                label="Properties"
                value={properties.length}
                color="primary"
                onClick={() => navigate('/properties')}
              />
              <StatTile
                icon={Users}
                label="Tenants"
                value={activeTenantsThisMonth.length}
                color="indigo"
                onClick={() => navigate('/tenants')}
              />
              <StatTile
                icon={CheckCircle2}
                label="Paid / Clear"
                value={paidTenants.length}
                color="teal"
                onClick={() => {
                  setActiveTab('PAID');
                  if (tenantListRef.current) {
                    tenantListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            </div>

            {/* 5. "Last 6 months" glass card: Bar chart of monthly collection percentage */}
            {monthlyHistory.length > 0 && (
              <GlassCard className="animate-fade-up space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-ink dark:text-white tracking-tight">
                      Last 6 Months
                    </h3>
                    <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium">
                      Collection performance trend
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-extrabold text-teal bg-teal/10 px-2.5 py-0.5 rounded-full border border-teal/20">
                    <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    {collectionPercent}% this month
                  </span>
                </div>

                <BarChart data={monthlyHistory} />
              </GlassCard>
            )}

            {/* 6. "Tenant Rent Status" Glass Card */}
            <div ref={tenantListRef} className="scroll-mt-20">
              <GlassCard className="animate-fade-up space-y-4">
                <div>
                  <h3 className="text-sm font-black text-ink dark:text-white tracking-tight">
                    Tenant Rent Status
                  </h3>
                  <p className="text-[11px] text-muted dark:text-[#98a3c4] font-medium">
                    Monthly collection and tenant dues tracking
                  </p>
                </div>

                {/* Segmented Tabs (Due Today, Pending, Paid, All with counts) */}
                <SegmentedTabs
                  tabs={filterTabs}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />

                {/* Search Input (Glass style, 16px radius) */}
                <div className="relative">
                  <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tenant by name, room or phone..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>

                {/* 7. Tenant List & Rows */}
                {displayedTenants.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-tile glass-panel">
                    <CheckCircle2 className="w-9 h-9 text-teal mx-auto mb-2 stroke-[2]" />
                    <p className="text-xs font-extrabold text-ink dark:text-white">
                      {activeTab === 'DUE_TODAY'
                        ? 'No tenants have rent due today.'
                        : activeTab === 'DUE'
                          ? 'All clear! No pending dues.'
                          : 'No tenants found.'}
                    </p>
                    <p className="text-[11px] text-muted dark:text-[#98a3c4] mt-0.5">
                      All records are up to date.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayedTenants.map((tenant, index) => {
                      const isPaid = tenant.currentMonthDue <= 0.009;
                      const isDueToday = tenant.currentMonthDue > 0 && isCurrentMonth && (tenant.currentMonthDueDate === todayStr);
                      const badgeStatus = isPaid ? 'PAID' : isDueToday ? 'DUE_TODAY' : 'PENDING';

                      return (
                        <div
                          key={tenant.id}
                          style={{ animationDelay: `${index * 40}ms` }}
                          className="rounded-tile p-3.5 glass-panel-strong hover:bg-white dark:hover:bg-[#1a2142] flex items-center justify-between gap-3 transition-all duration-200 group animate-fade-up"
                        >
                          {/* Left: Avatar + Details */}
                          <div
                            onClick={() => navigate(`/tenants/${tenant.id}`)}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <Avatar name={tenant.name} size="md" />

                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-extrabold text-ink dark:text-white group-hover:text-primary transition truncate">
                                  {tenant.name}
                                </h4>
                                <StatusBadge status={badgeStatus} />
                              </div>

                              <p className="text-[11px] text-muted dark:text-[#98a3c4] font-semibold truncate">
                                {tenant.unit} · <strong className="text-ink dark:text-white font-extrabold">₹{tenant.rent.toLocaleString('en-IN')}</strong>
                              </p>

                              {/* Arrears warning if applicable */}
                              {tenant.dueMonths?.some((d) => d.month < tenant.targetPeriodKey) && (
                                <p className="text-[10px] font-bold text-amber inline-flex items-center gap-1 mt-0.5">
                                  <span>⚠</span>
                                  <span>Arrears pending</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => sendWhatsAppReminder(tenant)}
                                aria-label="Send WhatsApp reminder"
                                className="w-8 h-8 rounded-btn glass-panel flex items-center justify-center text-teal hover:bg-teal/15 transition active:scale-95 cursor-pointer"
                                title="Send WhatsApp reminder"
                              >
                                <MessageCircle className="w-4 h-4 stroke-[2]" />
                              </button>
                            )}

                            {isPaid ? (
                              <div className="w-8 h-8 rounded-btn bg-teal/15 border border-teal/25 text-teal flex items-center justify-center">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedTenantForPay(tenant)}
                                aria-label="Collect rent"
                                className="px-3 py-1.5 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold flex items-center gap-1 shadow-sm shadow-[#3d4fe0]/25 hover:shadow-md active:scale-95 transition cursor-pointer"
                              >
                                <span>Collect</span>
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </div>
          </>
        )}
      </main>

      {/* Modals and Sheets */}
      <RecordPaymentModal
        isOpen={!!selectedTenantForPay}
        tenant={selectedTenantForPay}
        preselectedMonth={selectedTenantForPay?.targetPeriodKey || selectedMonthKey}
        preselectedAmount={selectedTenantForPay?.currentMonthDue}
        onClose={() => setSelectedTenantForPay(null)}
        onPaymentSuccess={() => handlePaymentSuccess(selectedTenantForPay?.name)}
      />

      <AddTenantModal
        isOpen={isAddTenantOpen}
        onClose={() => setIsAddTenantOpen(false)}
        onTenantAdded={handleTenantAdded}
      />

      <AddPropertyModal
        isOpen={isAddPropOpen}
        onClose={() => setIsAddPropOpen(false)}
        onPropertyAdded={handlePropertyAdded}
      />
    </div>
  );
}
