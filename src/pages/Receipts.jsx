import React, { useState, useEffect } from 'react';
import { ReceiptIndianRupee, Search, ChevronRight, Calendar, ArrowUpRight } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import GlassCard from '../components/ui/GlassCard';
import Avatar from '../components/ui/Avatar';
import { supabase } from '../lib/supabase';
import { calculatePeriodRange, calculateDueDate, fmtBillLabel } from '../utils/billing';

function toMonthKey(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 7);
}

function monthLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function getLastNMonths(n = 13) {
  const keys = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return keys;
}

export default function Receipts({ profile }) {
  const [receipts, setReceipts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('ALL');

  const monthOptions = getLastNMonths(13);

  useEffect(() => {
    let cancelled = false;

    const loadReceipts = async () => {
      setIsLoading(true);
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('id, tenant_id, payment_date, payment_month, rent_amount, electricity_amount, total_amount, payment_method, electricity_previous_reading, electricity_new_reading, electricity_units, receipt_number, description, created_at')
          .order('payment_date', { ascending: false });

        if (error) throw error;

        const tenantIds = [...new Set((payments || []).map((p) => p.tenant_id).filter(Boolean))];
        let tenantsById = {};
        if (tenantIds.length > 0) {
          const { data: tenants, error: tenantError } = await supabase
            .from('tenants')
            .select('id, full_name, phone, unit_label, move_in_date, due_day')
            .in('id', tenantIds);
          if (tenantError) throw tenantError;
          tenantsById = Object.fromEntries((tenants || []).map((t) => [t.id, t]));
        }

        const mapped = (payments || []).map((p) => {
          const tenant = tenantsById[p.tenant_id] || {};
          const monthValue = p.payment_month || p.payment_date;
          const monthKey = toMonthKey(monthValue);
          const dueDate = calculateDueDate(monthKey, tenant.due_day || 10);
          const billLabel = fmtBillLabel(monthKey, dueDate);
          const month = billLabel || (monthKey ? monthLabel(monthKey) : '');
          const date = p.payment_date
            ? new Date(`${String(p.payment_date).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB')
            : '';
          const periodRange = (tenant.move_in_date && monthKey)
            ? calculatePeriodRange(tenant.move_in_date, monthKey).range
            : '';
          return {
            id: p.id,
            receiptNumber: p.receipt_number,
            tenantId: p.tenant_id,
            tenantName: tenant.full_name || 'Tenant',
            phone: tenant.phone || '',
            unit: tenant.unit_label || '',
            periodRange,
            collectionMode: 'Post-Paid',
            amount: Number(p.rent_amount) || 0,
            electricityAmount: Number(p.electricity_amount) || 0,
            prevReading: Number(p.electricity_previous_reading) || 0,
            currReading: Number(p.electricity_new_reading) || 0,
            consumedUnits: Number(p.electricity_units) || 0,
            totalAmount: Number(p.total_amount) || 0,
            paymentMode: p.payment_method || 'UPI',
            description: p.description || '',
            month,
            monthKey,
            date,
            paymentDate: p.payment_date,
            createdAt: p.created_at,
          };
        });

        if (!cancelled) setReceipts(mapped);
      } catch (error) {
        console.error('Could not load payment history from Supabase; using saved receipt cache:', error);
        try {
          const saved = JSON.parse(localStorage.getItem('app_receipts') || '[]');
          if (!cancelled) setReceipts(saved.map(r => ({ ...r, monthKey: toMonthKey(r.paymentDate || '') })));
        } catch {
          if (!cancelled) setReceipts([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadReceipts();
    return () => { cancelled = true; };
  }, []);

  const monthFiltered = selectedMonth === 'ALL'
    ? receipts
    : receipts.filter(r => r.monthKey === selectedMonth);

  const filteredReceipts = monthFiltered.filter((r) =>
    r.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.unit?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.month?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCollectedAmount = monthFiltered.reduce(
    (sum, r) => sum + Number(r.amount || 0) + Number(r.electricityAmount || 0),
    0
  );

  const selectedMonthLabel = selectedMonth === 'ALL' ? 'All Time' : monthLabel(selectedMonth);

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* Sticky Glass Top Header */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-ink dark:text-white leading-none">
            Rent Receipts
          </h1>
          <p className="text-[10px] font-bold text-muted dark:text-[#98a3c4] uppercase tracking-wider mt-0.5">
            {profile?.businessName || 'Issued Invoices & History'}
          </p>
        </div>

        <span className="px-3 py-1 bg-primary/10 text-primary dark:text-[#8d99ff] border border-primary/20 rounded-full text-xs font-extrabold">
          {receipts.length} Issued
        </span>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {/* Hero Collected Glass Card */}
        <GlassCard className="animate-fade-up flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#98a3c4]">
              {selectedMonth === 'ALL' ? 'Total Collected (All Time)' : `Collected — ${selectedMonthLabel}`}
            </p>
            <h2 className="text-3xl font-black text-ink dark:text-white tracking-tight mt-0.5">
              ₹{totalCollectedAmount.toLocaleString('en-IN')}
            </h2>
            <p className="text-xs text-muted dark:text-[#98a3c4] font-medium mt-1">
              {monthFiltered.length} receipt{monthFiltered.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="w-12 h-12 rounded-tile bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white flex items-center justify-center font-bold shadow-glass-sm shrink-0">
            <ReceiptIndianRupee className="w-6 h-6 stroke-[2]" />
          </div>
        </GlassCard>

        {/* Month Filter Chips */}
        <div className="p-3 rounded-tile glass-panel space-y-2 animate-fade-up">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-ink dark:text-white">
            <Calendar className="w-3.5 h-3.5 text-primary stroke-[2]" />
            <span>Filter by Month</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedMonth('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-btn text-xs font-extrabold transition cursor-pointer select-none active:scale-95 ${selectedMonth === 'ALL'
                ? 'bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white shadow-xs'
                : 'glass-panel text-muted hover:text-ink dark:hover:text-white'
                }`}
            >
              All Time
            </button>
            {monthOptions.map((mk) => (
              <button
                key={mk}
                type="button"
                onClick={() => setSelectedMonth(mk)}
                className={`shrink-0 px-3 py-1.5 rounded-btn text-xs font-extrabold transition cursor-pointer select-none active:scale-95 ${selectedMonth === mk
                  ? 'bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white shadow-xs'
                  : 'glass-panel text-muted hover:text-ink dark:hover:text-white'
                  }`}
              >
                {monthLabel(mk)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative animate-fade-up">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tenant, room, month..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>

        {/* Receipts List */}
        <GlassCard className="animate-fade-up space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
              {selectedMonth === 'ALL' ? 'All Receipts' : selectedMonthLabel} ({filteredReceipts.length})
            </h3>
            <span className="text-[10px] text-muted font-bold">Tap to view</span>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-xs font-semibold text-muted">Loading receipts...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-tile glass-panel">
              <ReceiptIndianRupee className="w-10 h-10 text-muted mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-extrabold text-ink dark:text-white">
                {selectedMonth !== 'ALL'
                  ? `No receipts found for ${selectedMonthLabel}.`
                  : 'No receipts found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredReceipts.map((rcpt) => {
                const totalAmt = Number(rcpt.amount || 0) + Number(rcpt.electricityAmount || 0);
                return (
                  <div
                    key={rcpt.id}
                    onClick={() => setSelectedReceipt(rcpt)}
                    className="rounded-tile p-3.5 sm:p-4 glass-panel-strong hover:bg-white dark:hover:bg-[#1c244c] flex items-center justify-between gap-3.5 transition-all duration-200 cursor-pointer active:scale-[0.99] group border border-white/90 dark:border-white/15"
                  >
                    {/* Left: Avatar + Tenant Name & Room */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar name={rcpt.tenantName} size="md" className="shrink-0" />

                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-extrabold text-ink dark:text-white group-hover:text-primary dark:group-hover:text-[#a5b4fc] transition truncate leading-snug">
                          {rcpt.tenantName}
                        </h4>
                        <p className="text-xs text-muted dark:text-[#94a3b8] font-semibold truncate mt-0.5 leading-snug">
                          {rcpt.unit ? `${rcpt.unit} • ` : ''}<span className="text-primary dark:text-[#a5b4fc] font-bold">{rcpt.month}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Symmetrically Aligned Amount, Date & Chevron */}
                    <div className="flex items-center gap-2.5 text-right shrink-0">
                      <div>
                        <p className="text-sm font-black text-teal dark:text-[#2dd4bf] tabular-nums leading-snug">
                          ₹{totalAmt.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-muted dark:text-[#94a3b8] font-medium tabular-nums mt-0.5 leading-snug">
                          {rcpt.date}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-ink dark:group-hover:text-white transition shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </main>

      <ReceiptModal
        isOpen={!!selectedReceipt}
        receipt={selectedReceipt}
        landlordProfile={profile}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
