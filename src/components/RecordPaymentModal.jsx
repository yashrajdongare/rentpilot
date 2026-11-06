import React, { useState, useEffect } from 'react';
import { Zap, MessageCircle, Check, Wallet } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import BottomSheet from './ui/BottomSheet';
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
  const [rentMonth, setRentMonth] = useState(
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  );
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const moveInDate = tenant?.moveInDate || tenant?.move_in_date || tenant?.startDate || '';
  const monthlyRent = Number(tenant?.rent ?? tenant?.monthly_rent ?? 0);

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
    setShowDetails(false);

    let initialMonth = preselectedMonth;
    if (!initialMonth) {
      const currentMonth = today.slice(0, 7);
      const defaultMonth = getPrevMonthKey(currentMonth);
      const moveInMonth = moveInDate ? moveInDate.slice(0, 7) : '';
      initialMonth = (moveInMonth && moveInMonth > defaultMonth) ? moveInMonth : defaultMonth;
    }
    setRentMonth(initialMonth);

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

  const paymentModes = [
    { id: 'UPI', label: 'UPI / GPay' },
    { id: 'Cash', label: 'Cash' },
    { id: 'Bank Transfer', label: 'Bank' },
    { id: 'Cheque', label: 'Cheque' },
  ];

  return (
    <>
      <BottomSheet
        isOpen={isOpen && !isReceiptOpen}
        onClose={onClose}
        title="Collect Rent"
        subtitle={`${tenant.name || tenant.full_name} • ${tenant.unit || tenant.unit_label}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Big Amount Header Card */}
          <div className="rounded-card p-5 glass-panel-strong border border-white/90 dark:border-white/10 text-center relative overflow-hidden">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted dark:text-[#98a3c4]">
              Total Payable ({displayMonth})
            </span>
            <div className="text-4xl font-black text-ink dark:text-white tracking-tight mt-1">
              ₹{grandTotal.toLocaleString('en-IN')}
            </div>

            <div className="flex items-center justify-center gap-3 text-xs font-semibold text-muted dark:text-[#98a3c4] mt-2">
              <span>Rent: ₹{rentVal.toLocaleString('en-IN')}</span>
              {lightBill > 0 && (
                <span className="text-amber font-bold">
                  • Electricity: ₹{lightBill.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {/* Payment Mode Chips */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#98a3c4] mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {paymentModes.map((mode) => {
                const isSelected = paymentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentMode(mode.id)}
                    className={`py-2 px-1 rounded-btn text-xs font-extrabold transition-all duration-150 flex items-center justify-center gap-1 active:scale-95 cursor-pointer select-none ${isSelected
                        ? 'bg-gradient-to-br from-primary to-primary2 text-white shadow-md shadow-primary/30 border border-white/20'
                        : 'glass-panel text-muted dark:text-[#94a3b8] hover:text-ink dark:hover:text-white'
                      }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span className="truncate">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rent Amount Input */}
          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Rent Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-base font-extrabold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          {/* Collapsible Electricity / Sub-meter Charges */}
          <div className="rounded-tile p-3.5 glass-panel border border-white/80 dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-ink dark:text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber fill-amber" />
                Electricity Sub-meter
              </span>
              <span className="text-[10px] text-muted dark:text-[#98a3c4] font-bold">
                Units: <strong className="text-ink dark:text-white font-black">{consumedUnits}</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-muted font-bold mb-0.5">
                  Prev Unit
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={prevUnits}
                  onChange={(e) => setPrevUnits(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted font-bold mb-0.5">
                  Current Unit
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={currUnits}
                  onChange={(e) => setCurrUnits(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted font-bold mb-0.5">
                  Rate / Unit (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {consumedUnits > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-white/60 dark:border-white/10 text-xs">
                <span className="text-muted font-medium">
                  {consumedUnits} units × ₹{rate}
                </span>
                <span className="font-extrabold text-amber">
                  +₹{lightBill.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {/* Toggle More Details (Dates, Notes) */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-bold text-primary dark:text-[#8d99ff] hover:underline cursor-pointer"
            >
              {showDetails ? '− Hide payment dates & notes' : '+ Edit payment dates & notes'}
            </button>

            {showDetails && (
              <div className="mt-2 space-y-3 p-3.5 rounded-tile glass-panel border border-white/60 dark:border-white/10 animate-fade-up">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-muted mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-muted mb-1">
                      Rent Month
                    </label>
                    <input
                      type="month"
                      required
                      value={rentMonth}
                      onChange={(e) => handleRentMonthChange(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted mb-1">
                    Notes / Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. October rent settled via UPI"
                    className="w-full px-3 py-2 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Send Reminder on WhatsApp */}
          <button
            type="button"
            onClick={handleSendWhatsAppReminder}
            className="w-full py-2.5 px-3 rounded-btn glass-panel border border-teal/30 text-teal hover:bg-teal/15 font-extrabold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 stroke-[2]" />
            <span>Send Due Reminder on WhatsApp</span>
          </button>

          {saveError && (
            <div className="p-3 rounded-btn bg-rose/15 border border-rose/30 text-rose text-xs font-bold">
              {saveError}
            </div>
          )}

          {/* Full-width Gradient "Mark as Paid" Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3.5 px-4 rounded-btn bg-gradient-to-br from-primary to-primary2 text-white font-extrabold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-white/20"
          >
            <Wallet className="w-4 h-4 stroke-[2.5]" />
            <span>{isSaving ? 'Processing Payment...' : 'Mark as Paid & Generate Receipt'}</span>
          </button>
        </form>
      </BottomSheet>

      {/* Generated Receipt Modal */}
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
