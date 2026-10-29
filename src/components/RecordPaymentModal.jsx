
import React, { useState, useEffect } from 'react';
import { X, Zap, MessageCircle } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import { supabase } from '../lib/supabase';
import {
  calculateRentCharge,
  calculatePeriodRange,
  getPrevMonthKey,
  roundToTwo,
} from '../utils/billing';

export default function RecordPaymentModal({
  isOpen,
  tenant,
  onClose,
  onPaymentSuccess,
  preselectedMonth = null,   // 'YYYY-MM' — if set, pre-fill the rent month
  preselectedAmount = null,  // number — if set, pre-fill the due/balance amount
}) {
  const [amount, setAmount] = useState('');
  const [prevUnits, setPrevUnits] = useState('');
  const [currUnits, setCurrUnits] = useState('');
  const [unitRate, setUnitRate] = useState('10');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [description, setDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toLocaleDateString('en-CA')
  );
  // The rent period being settled is independent of the date money is received.
  const [rentMonth, setRentMonth] = useState(
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  );
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const moveInDate = tenant?.moveInDate || tenant?.move_in_date || tenant?.startDate || '';
  const monthlyRent = Number(tenant?.rent ?? tenant?.monthly_rent ?? 0);

  // When rentMonth changes, compute the charge and period
  const periodInfo = React.useMemo(() => {
    return calculatePeriodRange(moveInDate, rentMonth);
  }, [moveInDate, rentMonth]);

  const targetChargeAmount = React.useMemo(() => {
    return calculateRentCharge({
      monthlyRent,
      moveInDate,
      monthKey: rentMonth,
    });
  }, [monthlyRent, moveInDate, rentMonth]);

  useEffect(() => {
    if (!tenant || !isOpen) return;

    const today = new Date().toLocaleDateString('en-CA');
    setPaymentDate(today);
    setCurrUnits('');
    setUnitRate('10');
    setPaymentMode('UPI');
    setDescription('');
    setGeneratedReceipt(null);
    setIsReceiptOpen(false);
    setSaveError('');

    // Determine default rent month
    let initialMonth = preselectedMonth;
    if (!initialMonth) {
      const currentMonth = today.slice(0, 7);
      // Fixed post-paid default: previous month
      const defaultMonth = getPrevMonthKey(currentMonth);
      const moveInMonth = moveInDate ? moveInDate.slice(0, 7) : '';
      initialMonth = (moveInMonth && moveInMonth > defaultMonth) ? moveInMonth : defaultMonth;
    }
    setRentMonth(initialMonth);

    // Initial amount
    if (preselectedAmount != null) {
      setAmount(String(preselectedAmount));
    } else {
      const charge = calculateRentCharge({
        monthlyRent,
        moveInDate,
        monthKey: initialMonth,
      });
      setAmount(String(charge));
    }

    // Electricity readings
    const databaseReading =
      tenant.last_electricity_reading ??
      tenant.lastElectricityReading;

    if (databaseReading !== null && databaseReading !== undefined) {
      setPrevUnits(String(databaseReading));
    } else {
      try {
        const savedReceipts = JSON.parse(
          localStorage.getItem('app_receipts') || '[]'
        );
        const lastReceipt = savedReceipts.find(
          (receipt) => String(receipt.tenantId) === String(tenant.id)
        );
        setPrevUnits(
          lastReceipt?.currReading != null
            ? String(lastReceipt.currReading)
            : ''
        );
      } catch {
        setPrevUnits('');
      }
    }
  }, [tenant, isOpen, preselectedMonth, preselectedAmount, monthlyRent, moveInDate]);

  // When user changes rentMonth (not via preselected props), update amount to match the target charge
  const handleRentMonthChange = (newMonth) => {
    setRentMonth(newMonth);
    const charge = calculateRentCharge({
      monthlyRent,
      moveInDate,
      monthKey: newMonth,
    });
    setAmount(String(charge));
  };

  if (!isOpen || !tenant) return null;

  let landlordProfile = {};

  try {
    landlordProfile = JSON.parse(
      localStorage.getItem('landlordProfile') || '{}'
    );
  } catch {
    landlordProfile = {};
  }

  const pUnits = Number(prevUnits) || 0;
  const cUnits = Number(currUnits) || 0;
  const rate = Number(unitRate) || 0;
  const consumedUnits = Math.max(0, cUnits - pUnits);
  const lightBill = consumedUnits * rate;
  const rentVal = Number(amount) || 0;
  const grandTotal = rentVal + lightBill;

  const displayMonth = rentMonth
    ? new Date(`${rentMonth}-01T12:00:00`).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const handleSendWhatsAppReminder = () => {
    const cleanPhone = String(tenant?.phone || '').replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (!phoneWithCode) {
      alert('Tenant phone number is not available.');
      return;
    }

    const rentVal = Number(amount) || 0;
    const lightBill = consumedUnits > 0 ? consumedUnits * rate : (Number(electricityAmount) || 0);
    const grandTotal = rentVal + lightBill;

    const message =
      `*RENT DUE REMINDER* 🔔\n` +
      `Dear ${tenant.name || tenant.full_name || 'Tenant'},\n\n` +
      `This is a gentle reminder for your rent payment:\n` +
      `• *Month:* ${displayMonth}\n` +
      (periodInfo.range ? `• *Rental Period:* ${periodInfo.range}\n` : '') +
      `• *Pending Rent:* ₹${rentVal.toLocaleString('en-IN')}\n` +
      (lightBill > 0 ? `• *Electricity Bill:* ₹${lightBill.toLocaleString('en-IN')} (${consumedUnits} units)\n` : '') +
      `• *Total Payable:* ₹${grandTotal.toLocaleString('en-IN')}\n\n` +
      `Kindly clear the dues at your earliest convenience.\n` +
      (landlordProfile?.upi_id ? `UPI ID: ${landlordProfile.upi_id}\n` : '') +
      `Thank you,\n` +
      `${landlordProfile?.businessName || landlordProfile?.name || 'Landlord'}`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSaving) return;

    setSaveError('');

    if (!paymentDate) {
      setSaveError('Please select the payment date.');
      return;
    }

    if (!rentMonth) {
      setSaveError('Please select the rent month this payment is for.');
      return;
    }

    if ((prevUnits === '') !== (currUnits === '')) {
      setSaveError('Enter both previous and current electricity readings, or leave both blank.');
      return;
    }

    if (!Number.isFinite(rentVal) || rentVal < 0) {
      setSaveError('Please enter a valid rent amount.');
      return;
    }

    if (
      prevUnits !== '' &&
      currUnits !== '' &&
      cUnits < pUnits
    ) {
      setSaveError(
        'Current electricity reading cannot be less than the previous reading.'
      );
      return;
    }

    if (rate < 0) {
      setSaveError('Electricity rate cannot be negative.');
      return;
    }

    setIsSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      if (!tenant.property_id) {
        throw new Error(
          'This tenant has no linked property. Please check the tenant record.'
        );
      }

      // payment_month represents the rent period being settled, not payment_date.
      const monthDate = `${rentMonth}-01`;

      const receiptNumber = `RP-${Date.now()}`;

      const finalDescription = description.trim() || `Rent payment for ${displayMonth} (${periodInfo.range})`;

      const { data: result, error: paymentError } = await supabase.rpc(
        'record_rent_payment',
        {
          p_tenant_id: tenant.id,
          p_property_id: tenant.property_id,
          p_payment_date: paymentDate,
          p_payment_month: monthDate,
          p_rent_amount: rentVal,
          p_electricity_amount: lightBill,
          p_payment_method: paymentMode,
          p_electricity_previous_reading: prevUnits === '' ? null : pUnits,
          p_electricity_new_reading: currUnits === '' ? null : cUnits,
          p_electricity_units: currUnits === '' ? null : consumedUnits,
          p_electricity_unit_rate: currUnits === '' ? null : rate,
          p_receipt_number: receiptNumber,
          p_description: finalDescription,
        }
      );

      if (paymentError) throw paymentError;

      const savedPayment = result?.payment;
      if (!savedPayment?.id) {
        throw new Error('The payment was not confirmed by the database.');
      }

      // Update the tenant's last electricity reading.
      if (currUnits !== '') {
        const { error: readingError } = await supabase
          .from('tenants')
          .update({
            last_electricity_reading: cUnits,
            last_electricity_reading_date: paymentDate,
          })
          .eq('id', tenant.id)
          .eq('owner_id', user.id);

        if (readingError) {
          console.error(
            'Payment saved, but electricity reading update failed:',
            readingError
          );
        }
      }

      const formattedDate = new Date(
        `${paymentDate}T12:00:00`
      ).toLocaleDateString('en-GB');

      // Keep the receipt field names compatible with ReceiptModal.jsx.
      const newReceipt = {
        id: savedPayment.id,
        receiptNumber: savedPayment.receipt_number,
        tenantId: savedPayment.tenant_id,
        tenantName: tenant.name || tenant.full_name,
        phone: tenant.phone || '',
        unit: tenant.unit || tenant.unit_label || '',
        amount: rentVal,
        electricityAmount: Number(savedPayment.electricity_amount) || 0,
        prevReading: Number(savedPayment.electricity_previous_reading) || 0,
        currReading: Number(savedPayment.electricity_new_reading) || 0,
        consumedUnits: Number(savedPayment.electricity_units) || 0,
        totalAmount: grandTotal,
        paymentMode: savedPayment.payment_method || paymentMode,
        description: finalDescription,
        month: displayMonth,
        monthKey: rentMonth,
        paymentMonth: monthDate,
        payment_month: monthDate,
        date: formattedDate,
        paymentDate: savedPayment.payment_date,
        periodRange: periodInfo.range,
        collectionMode: 'Post-Paid (Previous Month)',
        calculationMethod: 'Fixed (1st of Every Month)',
        createdAt: savedPayment.created_at,
      };

      // Preserve old browser receipts and add this receipt for backward
      // compatibility. Supabase remains the authoritative payment store.
      try {
        const savedReceipts = JSON.parse(
          localStorage.getItem('app_receipts') || '[]'
        );

        localStorage.setItem(
          'app_receipts',
          JSON.stringify([newReceipt, ...savedReceipts])
        );
      } catch (storageError) {
        console.warn('Could not update local receipt cache:', storageError);
      }

      onPaymentSuccess(newReceipt);
      setGeneratedReceipt(newReceipt);
      setIsReceiptOpen(true);
    } catch (error) {
      console.error('Error recording payment:', error);
      setSaveError(
        error?.message ||
          'Unable to save the payment. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white w-full max-w-md rounded-[28px] p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Record Rent Payment
              </h2>
              <p className="text-xs text-slate-400 font-semibold">
                {tenant.name || tenant.full_name} •{' '}
                {tenant.unit || tenant.unit_label}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-full disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            <div>
              <label className="block text-slate-600 mb-1">
                Rent Amount (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
              />
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Electricity Charges (Sub-meter)
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  Units Consumed:{' '}
                  <strong className="text-[#1e3a5f] font-black">
                    {consumedUnits}
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                    Previous Reading
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={prevUnits}
                    onChange={(e) => setPrevUnits(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                    Current Reading
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={currUnits}
                    onChange={(e) => setCurrUnits(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                    Rate / Unit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitRate}
                    onChange={(e) => setUnitRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                <span className="text-[11px] text-slate-500">
                  {consumedUnits > 0
                    ? `(${consumedUnits} units × ₹${rate})`
                    : 'Electricity Total:'}
                </span>
                <span className="text-xs font-black text-amber-600">
                  ₹{lightBill.toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Description / Notes</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. October rent paid by UPI"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f] resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  Date money was received
                </p>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Rent Month Being Paid *
                </label>
                <input
                  type="month"
                  required
                  value={rentMonth}
                  onChange={(e) => handleRentMonthChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800">
                      Applies to: {displayMonth}
                    </span>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                      Post-Paid (Previous Month)
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Period: <strong className="text-slate-900">{periodInfo.range}</strong>
                  </p>

                  <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-semibold">
                      {periodInfo.isProrated ? `Prorated Rent (${periodInfo.eligibleDays}/${periodInfo.totalDays} days):` : 'Full Monthly Rent:'}
                    </span>
                    <strong className="text-[#1e3a5f] font-black">
                      ₹{targetChargeAmount.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium leading-tight">
                    💡 Landlord collects rent for {displayMonth} after the month completes.
                  </p>
                </div>
              </div>
            </div>

            <div>
                <label className="block text-slate-600 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                >
                  <option value="UPI">Google Pay / UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">
                  Total Received
                </span>
                <span className="text-xl font-black text-emerald-600">
                  ₹{grandTotal.toLocaleString()}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-medium space-y-0.5">
                <p>Rent: <strong className="text-slate-800">₹{rentVal.toLocaleString()}</strong></p>
                {lightBill > 0 && (
                  <p className="text-amber-600 font-bold">
                    Light: ₹{lightBill.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendWhatsAppReminder}
              className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99]"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Send Due Reminder on WhatsApp</span>
            </button>

            {saveError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs"
              >
                {saveError}
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="w-1/2 py-3 bg-[#1e3a5f] hover:bg-[#162b47] text-white rounded-xl font-bold transition shadow-md shadow-[#1e3a5f]/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving Payment...' : 'Record & Generate Receipt'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ReceiptModal
  isOpen={isReceiptOpen}
  receipt={generatedReceipt}
  landlordProfile={landlordProfile}
  onClose={() => {
    setIsReceiptOpen(false);
    onClose();
  }}
/>
    </>
  );
}
