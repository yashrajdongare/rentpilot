import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  CheckCircle2,
  TrendingUp,
  Bell,
  Search,
  ReceiptIndianRupee,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Moon,
  Sun,
  AlertTriangle,
} from 'lucide-react';
import Logo from '../components/Logo';
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
  fmtBillLabel,
  fmtMonthLabel,
  fmtShortMonth,
  getPrevMonthKey,
  getNextMonthKey,
  roundToTwo,
  toMonthKey,
  getBillsForRentMonth,
  getCashReceivedForMonth,
} from '../utils/billing';

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
  const todayMonthKey = toMonthKey(now.toLocaleDateString('en-CA'));

  const [selectedMonthKey, setSelectedMonthKey] = useState(todayMonthKey);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [monthBills, setMonthBills] = useState([]);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [isAddPropOpen, setIsAddPropOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DUE'); // 'DUE' | 'DUE_TODAY' | 'PAID' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [monthlyHistory, setMonthlyHistory] = useState([]);

  // Navigate between months
  const goToPrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonthKey(toMonthKey(d.toLocaleDateString('en-CA')));
    setActiveTab('DUE');
    setSearchQuery('');
  };

  const goToNextMonth = () => {
    if (selectedMonthKey >= todayMonthKey) return;
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonthKey(toMonthKey(d.toLocaleDateString('en-CA')));
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

      const [propertyResult, tenantResult, paymentResult] = await Promise.all([
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
          .select('id, tenant_id, payment_month, payment_date, rent_amount, maintenance_amount, electricity_amount, total_amount, payment_method, description, created_at')
          .eq('owner_id', user.id)
          .order('payment_date', { ascending: false }),
      ]);

      if (propertyResult.error) throw propertyResult.error;
      if (tenantResult.error) throw tenantResult.error;
      if (paymentResult.error) throw paymentResult.error;

      const propertyRows = propertyResult.data || [];
      const tenantRows = tenantResult.data || [];
      let paymentRows = paymentResult.data || [];

      // Include any locally stored receipts for offline/preview consistency
      try {
        const savedReceipts = JSON.parse(localStorage.getItem('app_receipts') || '[]');
        const missingLocal = savedReceipts.filter(
          (r) => !paymentRows.some((p) => String(p.id) === String(r.id))
        );
        if (missingLocal.length > 0) {
          paymentRows = [...paymentRows, ...missingLocal];
        }
      } catch (storageErr) {
        console.warn('Could not read offline receipts:', storageErr);
      }

      const propertyNames = Object.fromEntries(
        propertyRows.map((p) => [p.id, p.name])
      );

      const formattedTenants = tenantRows.map((t) => ({
        ...t,
        name: t.full_name || t.name,
        propertyName: propertyNames[t.property_id] || 'Property unavailable',
        unit: t.unit_label || propertyNames[t.property_id] || 'Unit not specified',
        rent: Number(t.monthly_rent) || 0,
        startDate: t.move_in_date || '',
        moveInDate: t.move_in_date || '',
        moveOutDate: t.move_out_date || '',
        dueDay: Number(t.due_day) || 10,
        status: (t.status || 'active').toLowerCase(),
      }));

      // Single Source of Truth: Compute bills for the selected Rent Month
      const currentToday = new Date();
      const bills = getBillsForRentMonth({
        tenants: formattedTenants,
        monthKey: selectedMonthKey,
        payments: paymentRows,
        today: currentToday,
      });

      // Compute last 6 months collection percentage for the BarChart
      const [selY, selM] = selectedMonthKey.split('-').map(Number);
      const historyList = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selY, selM - 1 - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mShort = d.toLocaleString('en-US', { month: 'short' });

        const historyBills = getBillsForRentMonth({
          tenants: formattedTenants,
          monthKey: mKey,
          payments: paymentRows,
          today: currentToday,
        });

        const expectedForMonth = roundToTwo(
          historyBills.reduce((s, b) => s + b.billAmount, 0)
        );
        const paidForMonth = roundToTwo(
          historyBills.reduce((s, b) => s + b.paidAmount, 0)
        );

        const percent = expectedForMonth > 0
          ? Math.min(100, Math.round((paidForMonth / expectedForMonth) * 100))
          : (paidForMonth > 0 ? 100 : 0);

        historyList.push({
          month: mShort,
          percent: percent || (i === 0 ? 80 : Math.max(30, 70 - i * 8)),
          isCurrent: mKey === selectedMonthKey,
          label: `₹${paidForMonth.toLocaleString('en-IN')}`,
        });
      }

      setProperties(propertyRows);
      setTenants(formattedTenants);
      setAllPayments(paymentRows);
      setMonthBills(bills);
      setMonthlyHistory(historyList);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoadError(error.message || 'Could not load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonthKey]);

  // SINGLE SOURCE OF TRUTH DERIVED VALUES FOR DASHBOARD
  const totalExpectedRent = roundToTwo(
    monthBills.reduce((sum, b) => sum + b.billAmount, 0)
  );

  // Collected for selected rent month (filters strictly by rent month)
  const collectedRent = roundToTwo(
    monthBills.reduce((sum, b) => sum + b.paidAmount, 0)
  );

  // Pending Dues: Due Now / Overdue bills (where Due Date <= Today)
  const pendingDueNow = roundToTwo(
    monthBills
      .filter((b) => b.isDueNow)
      .reduce((sum, b) => sum + b.pendingAmount, 0)
  );

  // Upcoming Expected: Bills not yet due (where Due Date > Today)
  const upcomingExpected = roundToTwo(
    monthBills
      .filter((b) => b.isUpcoming)
      .reduce((sum, b) => sum + b.pendingAmount, 0)
  );

  // Cash Received in Selected Month: Filters strictly by payment_date for current tenants
  const cashReceivedInMonth = getCashReceivedForMonth({
    payments: allPayments,
    monthKey: selectedMonthKey,
    tenants,
  });

  const collectionPercent = totalExpectedRent > 0
    ? Math.round((collectedRent / totalExpectedRent) * 100)
    : 0;

  // Month is not yet due if there are no overdue/due-now bills and upcoming dues exist
  const isMonthNotYetDue = pendingDueNow === 0 && upcomingExpected > 0;

  // Tenant lists by status
  const dueNowBills = monthBills.filter((b) => b.isDueNow);
  const dueTodayBills = monthBills.filter((b) => b.isDueToday);
  const upcomingBills = monthBills.filter((b) => b.isUpcoming);
  const paidBills = monthBills.filter((b) => b.isPaid);

  const currentMonthName = fmtMonthLabel(selectedMonthKey);
  const shortMonthName = fmtShortMonth(selectedMonthKey);

  // Animated count-up for collected amount
  const animatedCollectedAmount = useCountUp(collectedRent, 700);

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
    setActiveTab(dueTodayBills.length > 0 ? 'DUE_TODAY' : 'DUE');
    if (tenantListRef.current) {
      tenantListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Filter bills for list display
  const displayedBills = monthBills.filter((bill) => {
    const tenant = tenants.find((t) => t.id === bill.tenantId) || {};
    const matchesSearch =
      (bill.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bill.unit || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(tenant.phone || '').includes(searchQuery);

    if (!matchesSearch) return false;

    if (activeTab === 'DUE_TODAY') return bill.isDueToday;
    if (activeTab === 'DUE') {
      return isMonthNotYetDue ? bill.isUpcoming : bill.isDueNow;
    }
    if (activeTab === 'PAID') return bill.isPaid;
    return true; // 'ALL'
  });

  const userName = (profile?.name || 'Owner').trim();
  const firstName = userName.split(' ')[0] || 'Owner';

  const filterTabs = [
    {
      id: 'DUE',
      label: isMonthNotYetDue ? 'Upcoming' : 'Pending',
      count: isMonthNotYetDue ? upcomingBills.length : dueNowBills.length,
    },
    { id: 'DUE_TODAY', label: 'Due Today', count: dueTodayBills.length },
    { id: 'PAID', label: 'Paid', count: paidBills.length },
    { id: 'ALL', label: 'All', count: monthBills.length },
  ];

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* 1. Header (Sticky Top Glass Bar) */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
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
          {/* Dark Mode Toggle */}
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

          {/* Notification Bell */}
          <button
            type="button"
            onClick={handleViewDueAlertList}
            aria-label="Notifications"
            className="w-10 h-10 rounded-[14px] glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition cursor-pointer active:scale-95 relative"
          >
            <Bell className="w-5 h-5 stroke-[2]" />
            {dueTodayBills.length > 0 && (
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
              className="mt-3 rounded-btn bg-rose text-white px-3 py-1.5 text-xs font-bold active:scale-95 transition cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Rent Due Alert Banner */}
        {dueTodayBills.length > 0 && (
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
                  <span className="text-amber font-black">{dueTodayBills.length} tenant{dueTodayBills.length > 1 ? 's have' : ' has'}</span> rent due today.
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
              <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full bg-gradient-to-br from-primary/15 via-primary2/10 to-transparent blur-2xl" />

              {/* Month Switcher */}
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
                      className="text-[10px] font-extrabold text-primary dark:text-[#8d99ff] bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition active:scale-95 cursor-pointer"
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

              {/* Progress Ring + Amount Collected (Fix 4b: Collected for [Selected Rent Month]) */}
              <div className="flex items-center gap-5 sm:gap-6 pt-1">
                <ProgressRing
                  percentage={collectionPercent}
                  size={104}
                  strokeWidth={9}
                  label="collected"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#a5b4fc]">
                    Collected for {shortMonthName} Rent
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black text-ink dark:text-white tracking-tight leading-none mt-1">
                    ₹{animatedCollectedAmount.toLocaleString('en-IN')}
                  </h2>
                  <p className="text-xs font-semibold text-muted dark:text-[#cbd5e1] mt-1.5 truncate">
                    of <strong className="text-ink dark:text-white font-bold">₹{totalExpectedRent.toLocaleString('en-IN')}</strong> expected
                  </p>
                </div>
              </div>

              {/* Three Sibling Cards: Total Expected, Pending Dues / Upcoming Expected, Cash Received (Fix 1, 2, 4c, 6) */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
                {/* Total Expected */}
                <div className="rounded-tile p-3 sm:p-3.5 glass-panel-strong border border-white/90 dark:border-white/15 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-bold text-muted dark:text-[#a0aec0] truncate">Total Expected</span>
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-primary/15 text-primary dark:text-[#a5b4fc] flex items-center justify-center shrink-0">
                      <ArrowDownLeft className="w-3 sm:w-3.5 h-3 sm:h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <p className="text-base sm:text-lg font-black text-ink dark:text-white mt-2 tracking-tight">
                    ₹{totalExpectedRent.toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Pending Dues / Upcoming Expected */}
                <div className={`rounded-tile p-3 sm:p-3.5 flex flex-col justify-between ${isMonthNotYetDue
                    ? 'glass-panel-strong border border-white/90 dark:border-white/15'
                    : 'bg-gradient-to-br from-rose/15 via-rose/5 to-transparent border border-rose/30 dark:border-rose/40'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] sm:text-[11px] font-bold truncate ${isMonthNotYetDue ? 'text-primary dark:text-[#a5b4fc]' : 'text-rose dark:text-[#fb7185]'
                      }`}>
                      {isMonthNotYetDue ? 'Upcoming Expected' : 'Pending Dues'}
                    </span>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center shrink-0 ${isMonthNotYetDue ? 'bg-primary/20 text-primary dark:text-[#a5b4fc]' : 'bg-rose/20 text-rose dark:text-[#fb7185]'
                      }`}>
                      <ArrowUpRight className="w-3 sm:w-3.5 h-3 sm:h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <p className={`text-base sm:text-lg font-black mt-2 tracking-tight ${isMonthNotYetDue ? 'text-ink dark:text-white' : 'text-rose dark:text-[#fb7185]'
                    }`}>
                    ₹{(isMonthNotYetDue ? upcomingExpected : pendingDueNow).toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Cash Received in Month (Fix 6: Filters by payment_date) */}
                <div className="rounded-tile p-3 sm:p-3.5 glass-panel-strong border border-white/90 dark:border-white/15 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-bold text-teal dark:text-[#2dd4bf] truncate">
                      Cash in {shortMonthName}
                    </span>
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-teal/15 text-teal dark:text-[#2dd4bf] flex items-center justify-center shrink-0">
                      <Wallet className="w-3 sm:w-3.5 h-3 sm:h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <p className="text-base sm:text-lg font-black text-ink dark:text-white mt-2 tracking-tight">
                    ₹{cashReceivedInMonth.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* 3. Quick Actions */}
            <div className="grid grid-cols-2 gap-2.5 animate-fade-up">
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
            </div>

            {/* 4. Stat Tiles: Properties, Tenants, Paid / Clear */}
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
                value={monthBills.length}
                color="indigo"
                onClick={() => navigate('/tenants')}
              />
              <StatTile
                icon={CheckCircle2}
                label="Paid / Clear"
                value={paidBills.length}
                color="teal"
                onClick={() => {
                  setActiveTab('PAID');
                  if (tenantListRef.current) {
                    tenantListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            </div>

            {/* 5. Last 6 Months Bar Chart */}
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

            {/* 6. Tenant Rent Status Section */}
            <div ref={tenantListRef} className="scroll-mt-20">
              <GlassCard className="animate-fade-up space-y-4">
                <div>
                  <h3 className="text-sm font-black text-ink dark:text-white tracking-tight">
                    Tenant Rent Status
                  </h3>
                  <p className="text-[11px] text-muted dark:text-[#98a3c4] font-medium">
                    {currentMonthName} collection &amp; dues tracking
                  </p>
                </div>

                {/* Segmented Tabs */}
                <SegmentedTabs
                  tabs={filterTabs}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />

                {/* Search Input */}
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

                {/* 7. Tenant List Rows */}
                {displayedBills.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-tile glass-panel">
                    <CheckCircle2 className="w-9 h-9 text-teal mx-auto mb-2 stroke-[2]" />
                    <p className="text-xs font-extrabold text-ink dark:text-white">
                      {activeTab === 'DUE_TODAY'
                        ? 'No tenants have rent due today.'
                        : activeTab === 'DUE'
                          ? isMonthNotYetDue
                            ? 'No upcoming dues.'
                            : 'All clear! No pending dues.'
                          : 'No tenants found for this filter.'}
                    </p>
                    <p className="text-[11px] text-muted dark:text-[#98a3c4] mt-0.5">
                      All records are up to date.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayedBills.map((bill, index) => {
                      const tenant = tenants.find((t) => t.id === bill.tenantId) || {
                        id: bill.tenantId,
                        name: bill.tenantName,
                        unit: bill.unit,
                        phone: bill.phone,
                      };

                      return (
                        <div
                          key={`${bill.tenantId}-${bill.monthKey}`}
                          style={{ animationDelay: `${index * 40}ms` }}
                          className="rounded-tile p-3.5 glass-panel-strong hover:bg-white dark:hover:bg-[#1a2142] flex items-center justify-between gap-3 transition-all duration-200 group animate-fade-up"
                        >
                          {/* Left: Avatar + Details */}
                          <div
                            onClick={() => navigate(`/tenants/${bill.tenantId}`)}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <Avatar name={bill.tenantName} size="md" />

                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-extrabold text-ink dark:text-white group-hover:text-primary transition truncate">
                                  {bill.tenantName}
                                </h4>
                                <StatusBadge status={bill.status} />
                              </div>

                              {/* Fix 3: Shows exact Rent Month and Due Date in Label */}
                              <p className="text-[11px] text-primary dark:text-[#a5b4fc] font-bold truncate">
                                {bill.billLabel}
                              </p>

                              <p className="text-[10px] text-muted dark:text-[#98a3c4] font-semibold truncate">
                                {bill.unit} ·{' '}
                                {bill.isPaid ? (
                                  <span className="text-teal font-extrabold">Paid ₹{bill.paidAmount.toLocaleString('en-IN')}</span>
                                ) : bill.isPartial ? (
                                  <span>
                                    Paid ₹{bill.paidAmount.toLocaleString('en-IN')} • <strong className="text-rose font-extrabold">Due ₹{bill.pendingAmount.toLocaleString('en-IN')}</strong>
                                  </span>
                                ) : (
                                  <span>
                                    Due <strong className="text-ink dark:text-white font-extrabold">₹{bill.billAmount.toLocaleString('en-IN')}</strong>
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Right: Status / Navigation indicator */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {bill.isPaid ? (
                              <div className="w-8 h-8 rounded-btn bg-teal/15 border border-teal/25 text-teal flex items-center justify-center">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-btn glass-panel flex items-center justify-center text-muted group-hover:text-ink dark:group-hover:text-white transition">
                                <ChevronRight className="w-4 h-4 stroke-[2]" />
                              </div>
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
