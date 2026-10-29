import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Plus, 
  ArrowUpRight, 
  CheckCircle2, 
  MessageCircle, 
  TrendingUp, 
  Bell, 
  ArrowDownLeft, 
  Search, 
  Receipt, 
  UserPlus, 
  Home,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Logo from '../components/Logo';
import RecordPaymentModal from '../components/RecordPaymentModal';
import AddTenantModal from '../components/AddTenantModal';
import AddPropertyModal from '../components/AddPropertyModal';
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
  const d = new Date(y, m, 1); // m is already 1-based, so new Date(y, m) = next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Returns "Month YYYY" label
function monthLabel(monthKey) {
  return fmtMonthLabel(monthKey);
}

export default function Dashboard({ profile }) {
  const navigate = useNavigate();
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

  // Derived date boundaries from selected month
  const monthStartDate = monthFirstDay(selectedMonthKey);
  const nextMonthDate = nextMonthFirstDay(selectedMonthKey);

  // Navigate between months
  const goToPrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1); // m-2 because m is 1-based, go back 1
    setSelectedMonthKey(toMonthKey(d));
    setActiveTab('DUE');
    setSearchQuery('');
  };

  const goToNextMonth = () => {
    // Don't allow going beyond current month
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

      // Map each property's rent_collection_mode, rent_calculation_method, and due_day directly from columns
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
        // If duplicate rows ever exist, keep the first visible record; the DB should enforce uniqueness.
        if (!chargeByTenantMonth[key]) chargeByTenantMonth[key] = charge;
      });

      const formattedTenants = tenantRows.map((tenant) => {
        const status = (tenant.status || 'active').toLowerCase();
        const moveIn = tenant.move_in_date || '';
        const moveOut = tenant.move_out_date || '';
        const rent = Number(tenant.monthly_rent) || 0;

        const propConfig = propertyConfigMap[tenant.property_id] || { dueDay: 10 };
        const dueDay = Number(tenant.due_day || propConfig.dueDay || 10);

        // Fixed post-paid billing model:
        // Viewing month selectedMonthKey (e.g. October 2026) tracks the collection cycle for selectedMonthKey.
        // In post-paid, the rent period collected during selectedMonthKey is the PREVIOUS month (September 2026),
        // with its due date in selectedMonthKey (e.g. 10 October 2026).
        const targetPeriodKey = getPrevMonthKey(selectedMonthKey);
        const targetPeriodLabel = mlabel(targetPeriodKey);
        const dueDateInSelectedMonth = `${selectedMonthKey}-${String(Math.min(Math.max(dueDay, 1), 28)).padStart(2, '0')}`;

        // Check if tenant was active during target period
        const targetFirstDay = `${targetPeriodKey}-01`;
        const targetNextFirstDay = nextMonthFirstDay(targetPeriodKey);
        const isActiveForTargetPeriod = (!moveIn || moveIn < targetNextFirstDay) &&
          (!moveOut || moveOut >= targetFirstDay) &&
          status !== 'archived';

        // Active for current viewing month
        const isActiveForMonth = (!moveIn || moveIn < nextMonthDate) && 
          (!moveOut || moveOut >= monthStartDate) && 
          (status === 'active' || (moveOut && moveOut >= monthStartDate));

        // Expected rent charge for the target period using authoritative calculation
        const expectedTargetRent = isActiveForTargetPeriod
          ? calculateRentCharge({
              monthlyRent: rent,
              moveInDate: moveIn,
              monthKey: targetPeriodKey,
            })
          : 0;

        // Compute history and balance up to targetPeriodKey
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

  // Arrears: tenants who have outstanding balance from BEFORE their current target cycle
  const arrearsCount = tenants.filter((t) =>
    t.dueMonths?.some((d) => d.month < t.targetPeriodKey)
  ).length;

  const currentMonthName = monthLabel(selectedMonthKey);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const dueRentTenants = activeTenantsThisMonth.filter((tenant) =>
    tenant.currentMonthDue > 0 && isCurrentMonth && (tenant.currentMonthDueDate === todayStr)
  );

  const handlePaymentSuccess = async () => {
    setSelectedTenantForPay(null);
    await loadDashboardData();
  };

  const handleTenantAdded = async () => {
    setIsAddTenantOpen(false);
    await loadDashboardData();
  };

  const handlePropertyAdded = async () => {
    setIsAddPropOpen(false);
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-28">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-5 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <div className="md:hidden">
            <Logo size="sm" showText={true} />
          </div>

          <div className="hidden md:block">
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
              Dashboard Overview
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Welcome back, <span className="text-slate-700 font-bold">{profile?.name || 'Owner'}</span> • {currentMonthName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddTenantOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Tenant</span>
          </button>
          
          <button
            onClick={() => setIsAddPropOpen(true)}
            className="bg-[#1e3a5f] hover:bg-[#162b47] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Property</span>
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-5 max-w-md md:max-w-4xl mx-auto">
        {loadError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p className="font-bold">Dashboard data could not be loaded</p>
            <p className="mt-1">{loadError}</p>
            <button onClick={loadDashboardData} className="mt-3 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white">Try again</button>
          </div>
        )}
        {isLoading && !loadError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">Loading your Supabase data…</div>
        )}
        
        {/* Due Date Alert Banner */}
        {dueRentTenants.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-200/80 text-amber-900 p-4 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Rent Due Alert</h4>
                <p className="text-xs font-bold mt-0.5">
                  <span className="font-extrabold text-amber-950">{dueRentTenants.length} tenants</span> have rent due today.
                </p>
              </div>
            </div>
            <button
              onClick={handleViewDueAlertList}
              className="text-xs font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition cursor-pointer active:scale-95 shadow-2xs"
            >
              View List
            </button>
          </div>
        )}

        {/* Financial Hero Card */}
        <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden">
          {/* Month Navigator */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition active:scale-95"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-extrabold text-slate-700 text-sm">
                  {currentMonthName}
                </span>
              </div>
              {!isCurrentMonth && (
                <button
                  onClick={() => { setSelectedMonthKey(todayMonthKey); setActiveTab('DUE'); setSearchQuery(''); }}
                  className="text-[10px] font-bold text-[#1e3a5f] bg-[#1e3a5f]/10 px-2 py-0.5 rounded-full hover:bg-[#1e3a5f]/20 transition"
                >
                  Today
                </button>
              )}
            </div>

            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[11px]">
              Rent Collection
            </span>
            <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              {collectionPercent}% Collected
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-3">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              ₹{collectedRent.toLocaleString()}
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              / ₹{totalExpectedRent.toLocaleString()} Expected
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden p-0.5 border border-slate-200/40">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(collectionPercent, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 font-bold">Total Expected</p>
                <div className="w-6 h-6 rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center font-bold">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-slate-900 mt-2">₹{totalExpectedRent.toLocaleString()}</p>
            </div>

            <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-rose-600 font-bold">Pending Dues</p>
                <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-rose-600 mt-2">₹{pendingRent.toLocaleString()}</p>
              {arrearsCount > 0 && (
                <p className="text-[10px] text-rose-400 font-bold mt-1">
                  +{arrearsCount} tenant{arrearsCount > 1 ? 's' : ''} with arrears
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div 
            onClick={() => navigate('/properties')}
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#1e3a5f]/30 cursor-pointer active:scale-98 transition text-center sm:text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center mx-auto sm:mx-0 mb-2">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Properties</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{properties.length}</p>
          </div>

          <div 
            onClick={() => navigate('/tenants')}
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#1e3a5f]/30 cursor-pointer active:scale-98 transition text-center sm:text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto sm:mx-0 mb-2">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tenants</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{activeTenantsThisMonth.length}</p>
          </div>

          <div 
            onClick={() => navigate('/receipts')}
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#1e3a5f]/30 cursor-pointer active:scale-98 transition text-center sm:text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto sm:mx-0 mb-2">
              <Receipt className="w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Paid / Clear</p>
            <p className="text-lg font-black text-emerald-600 mt-0.5">{paidTenants.length}</p>
          </div>
        </div>

        {/* Tenant Rent Status Section (With Ref for Auto-Scroll) */}
        <div ref={tenantListRef} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4 scroll-mt-20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Tenant Rent Status
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Monthly collection and tenant dues tracking</p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('DUE_TODAY')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'DUE_TODAY' 
                    ? 'bg-amber-500 text-white shadow-xs' 
                    : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                Due Today ({dueRentTenants.length})
              </button>
              <button
                onClick={() => setActiveTab('DUE')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'DUE' 
                    ? 'bg-white text-rose-600 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending ({pendingTenants.length})
              </button>
              <button
                onClick={() => setActiveTab('PAID')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'PAID' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paid ({paidTenants.length})
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'ALL' 
                    ? 'bg-white text-[#1e3a5f] shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({tenants.length})
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenant by name, room or phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          {/* List Content */}
          {isLoading ? (
            <div className="text-center py-8 text-xs font-semibold text-slate-400">Loading tenant rent status…</div>
          ) : displayedTenants.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                {activeTab === 'DUE_TODAY' ? 'No tenants have rent due today.' : activeTab === 'DUE' ? 'All Clear! No pending rent.' : 'No tenants found.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">All records are up to date.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedTenants.map((tenant) => {
                const isPaid = tenant.currentMonthDue <= 0;

                return (
                  <div
                    key={tenant.id}
                    className="bg-slate-50/90 hover:bg-slate-100/90 p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between transition group"
                  >
                    <div 
                      onClick={() => navigate(`/tenants/${tenant.id}`)}
                      className="cursor-pointer space-y-1 flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#1e3a5f] transition">
                          {tenant.name}
                        </h4>
                        <span className="text-[11px] font-extrabold text-[#1e3a5f] bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <Home className="w-3 h-3 text-[#1e3a5f]" />
                          {tenant.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 font-medium">
                        <span>Rent: <strong className="text-slate-900 font-black">₹{tenant.rent.toLocaleString('en-IN')}</strong></span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          Post-Paid (for {tenant.targetPeriodLabel})
                        </span>
                        {!isPaid && (
                          <span className="text-rose-600 font-bold">
                            • Due {tenant.dueDay}th: ₹{tenant.currentMonthDue.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {/* Arrears badge — unpaid months before current target cycle */}
                      {tenant.dueMonths?.some(d => d.month < tenant.targetPeriodKey) && (
                        <p className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 inline-flex items-center gap-1">
                          ⚠ Arrears from previous month(s)
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {!isPaid && (
                        <button
                          onClick={() => sendWhatsAppReminder(tenant)}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition border border-emerald-200/60 shadow-2xs cursor-pointer"
                          title="Send WhatsApp Reminder"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}

                      {isPaid ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PAID</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedTenantForPay(tenant)}
                          className="px-3.5 py-1.5 bg-[#1e3a5f] hover:bg-[#162b47] text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Collect</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <RecordPaymentModal
        isOpen={!!selectedTenantForPay}
        tenant={selectedTenantForPay}
        preselectedMonth={selectedTenantForPay?.targetPeriodKey || selectedMonthKey}
        preselectedAmount={selectedTenantForPay?.currentMonthDue}
        onClose={() => setSelectedTenantForPay(null)}
        onPaymentSuccess={handlePaymentSuccess}
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