import React, { useState, useEffect } from 'react';
import { Receipt, Search, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { supabase } from '../lib/supabase';
import { calculatePeriodRange } from '../utils/billing';

// Helper to get "YYYY-MM" from a date string
function toMonthKey(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 7);
}

// Returns "Month YYYY" display label
function monthLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Generate list of last N months as keys descending
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

  // Month filter — 'ALL' or a 'YYYY-MM' key
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

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
            .select('id, full_name, phone, unit_label, move_in_date')
            .in('id', tenantIds);
          if (tenantError) throw tenantError;
          tenantsById = Object.fromEntries((tenants || []).map((t) => [t.id, t]));
        }

        const mapped = (payments || []).map((p) => {
          const tenant = tenantsById[p.tenant_id] || {};
          const monthValue = p.payment_month || p.payment_date;
          const monthKey = toMonthKey(monthValue);
          const month = monthKey ? monthLabel(monthKey) : '';
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

  // Apply month filter then text search
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-28">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-5 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <div className="md:hidden">
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
              Rent <span className="text-[#1e3a5f]">Receipts</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              {profile?.businessName || 'Issued Invoices & History'}
            </p>
          </div>

          <div className="hidden md:block">
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
              Rent Receipts & Invoices
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Manage and print issued tenant receipts
            </p>
          </div>
        </div>

        <span className="px-3 py-1 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-full text-xs font-bold">
          {receipts.length} Total Issued
        </span>
      </header>

      <main className="p-4 space-y-4 max-w-md md:max-w-4xl mx-auto">

        {/* Hero summary card */}
        <div className="bg-white rounded-[32px] p-5 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedMonth === 'ALL' ? 'Total Collected (All Time)' : `Collected — ${selectedMonthLabel}`}
            </p>
            <h2 className="text-2xl font-black text-slate-900 mt-0.5">
              ₹{totalCollectedAmount.toLocaleString('en-IN')}
            </h2>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {monthFiltered.length} receipt{monthFiltered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 text-[#1e3a5f] flex items-center justify-center font-bold">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Month filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#1e3a5f]" />
              <span className="text-xs font-bold text-slate-700">Filter by Month</span>
            </div>
            <button
              onClick={() => setShowMonthPicker(v => !v)}
              className="text-[10px] font-bold text-[#1e3a5f] hover:underline"
            >
              {showMonthPicker ? 'Hide' : 'Show months'}
            </button>
          </div>

          {/* Scrollable month pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedMonth('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedMonth === 'ALL'
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>
            {monthOptions.map(mk => (
              <button
                key={mk}
                onClick={() => setSelectedMonth(mk)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedMonth === mk
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {monthLabel(mk)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tenant, unit, month or description..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1e3a5f]"
          />
        </div>

        {/* Receipts list */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {selectedMonth === 'ALL' ? 'All Receipts' : selectedMonthLabel} ({filteredReceipts.length})
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Tap to view receipt</span>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-xs font-semibold text-slate-400">Loading receipts…</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                {selectedMonth !== 'ALL'
                  ? `No receipts found for ${selectedMonthLabel}.`
                  : 'No receipts found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReceipts.map((rcpt) => {
                const totalAmt = Number(rcpt.amount || 0) + Number(rcpt.electricityAmount || 0);
                return (
                  <div
                    key={rcpt.id}
                    onClick={() => setSelectedReceipt(rcpt)}
                    className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between hover:bg-slate-100/70 transition cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f] border border-[#1e3a5f]/20 flex items-center justify-center font-bold shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{rcpt.tenantName}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {rcpt.unit} • <span className="text-[#1e3a5f] font-semibold">{rcpt.month}</span>
                        </p>
                        {rcpt.description && (
                          <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] truncate" title={rcpt.description}>
                            {rcpt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">₹{totalAmt.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{rcpt.date}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
