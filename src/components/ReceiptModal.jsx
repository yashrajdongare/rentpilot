import React, { useRef } from 'react';
import { Download, Share2, CheckCircle2 } from 'lucide-react';
import BottomSheet from './ui/BottomSheet';

export default function ReceiptModal({
  isOpen,
  receipt,
  landlordProfile,
  onClose,
}) {
  const receiptRef = useRef(null);

  if (!isOpen || !receipt) return null;

  const description = String(
    receipt.description ??
    receipt.notes ??
    receipt.payment_description ??
    ''
  ).trim();

  const periodRangeText = typeof receipt.periodRange === 'object'
    ? (receipt.periodRange?.range || '')
    : (receipt.periodRange || '');

  const rentAmount = Number(receipt.amount) || 0;
  const electricityAmount = Number(receipt.electricityAmount) || 0;
  const grandTotal = rentAmount + electricityAmount;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text =
      `*RENT RECEIPT - ${receipt.month || ''}*\n` +
      `Property: ${landlordProfile?.businessName || 'RentPilot'}\n` +
      `Owner: ${landlordProfile?.name || 'Owner'} (${landlordProfile?.phone || ''})\n\n` +
      `Tenant: ${receipt.tenantName || 'N/A'} (${receipt.unit || 'N/A'})\n` +
      (periodRangeText ? `Rental Period: ${periodRangeText}\n` : '') +
      (receipt.collectionMode ? `Mode: ${receipt.collectionMode}\n` : '') +
      `Rent Amount: ₹${rentAmount.toLocaleString('en-IN')}\n` +
      (electricityAmount > 0
        ? `Electricity Bill: ₹${electricityAmount.toLocaleString('en-IN')}\n`
        : '') +
      `*Total Paid: ₹${grandTotal.toLocaleString('en-IN')}*\n` +
      `Payment Mode: ${receipt.paymentMode || 'UPI'}\n` +
      `Date: ${receipt.date || 'N/A'}\n` +
      (description ? `Description: ${description}\n` : '') +
      `\nStatus: PAID ✅\n` +
      `— Generated via RentPilot`;

    const phone = String(receipt.phone || '').replace(/\D/g, '');
    const phoneWithCode =
      phone.length === 10 ? `91${phone}` : phone;

    const url = phoneWithCode
      ? `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Receipt"
      subtitle={`Receipt #${receipt.receiptNumber || 'N/A'}`}
    >
      <div className="space-y-4">
        {/* Printable/Display Glass Receipt Container */}
        <div
          ref={receiptRef}
          className="rounded-card p-5 glass-panel-strong border border-white/90 dark:border-white/10 space-y-4"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-white/80 dark:border-white/10">
            <h3 className="text-base font-black text-ink dark:text-white tracking-tight">
              {landlordProfile?.businessName || 'RentPilot Properties'}
            </h3>
            <p className="text-xs text-muted dark:text-[#98a3c4] mt-0.5 font-medium">
              Landlord: {landlordProfile?.name || 'Owner'} {landlordProfile?.phone ? `• ${landlordProfile.phone}` : ''}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-teal/15 text-teal border border-teal/25 text-[10px] font-extrabold uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Verified Paid</span>
            </div>
          </div>

          {/* Tenant & Date info */}
          <div className="flex justify-between items-start text-xs font-semibold">
            <div>
              <p className="text-muted dark:text-[#98a3c4] text-[10px] uppercase font-extrabold tracking-wider">
                Tenant Details
              </p>
              <p className="text-ink dark:text-white font-extrabold mt-0.5">
                {receipt.tenantName || 'N/A'}
              </p>
              <p className="text-primary dark:text-[#8d99ff] text-[11px] font-bold mt-0.5">
                {receipt.unit || 'N/A'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-muted dark:text-[#98a3c4] text-[10px] uppercase font-extrabold tracking-wider">
                Payment Date
              </p>
              <p className="text-ink dark:text-white font-bold mt-0.5">
                {receipt.date || 'N/A'}
              </p>
              <p className="text-primary dark:text-[#8d99ff] text-[11px] font-extrabold mt-0.5">
                {receipt.month || ''}
              </p>
              {periodRangeText && (
                <p className="text-[10px] text-muted font-medium mt-0.5">
                  {periodRangeText}
                </p>
              )}
            </div>
          </div>

          {/* Amount breakdown */}
          <div className="space-y-2 pt-2 border-t border-white/80 dark:border-white/10 text-xs">
            <div className="flex justify-between font-semibold text-muted dark:text-[#98a3c4]">
              <span>Rent Amount</span>
              <span className="font-extrabold text-ink dark:text-white">
                ₹{rentAmount.toLocaleString('en-IN')}
              </span>
            </div>

            {electricityAmount > 0 && (
              <div className="flex justify-between font-semibold text-muted dark:text-[#98a3c4]">
                <span>
                  Electricity Charges (
                  {receipt.consumedUnits
                    ? `${receipt.consumedUnits} units`
                    : 'Sub-meter'}
                  )
                </span>
                <span className="font-extrabold text-amber">
                  ₹{electricityAmount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div className="flex justify-between font-semibold text-muted dark:text-[#98a3c4]">
              <span>Payment Mode</span>
              <span className="font-extrabold text-primary dark:text-[#8d99ff]">
                {receipt.paymentMode || 'UPI'}
              </span>
            </div>

            {description && (
              <div className="pt-2 border-t border-white/60 dark:border-white/10 text-xs">
                <p className="text-muted text-[10px] uppercase font-bold">
                  Notes
                </p>
                <p className="mt-0.5 font-semibold text-ink dark:text-white whitespace-pre-wrap break-words">
                  {description}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center text-sm font-black text-ink dark:text-white pt-2 border-t border-white/80 dark:border-white/10">
              <span>Total Paid</span>
              <span className="text-xl font-black text-teal">
                ₹{grandTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="py-3 px-3 rounded-btn glass-panel text-ink dark:text-white font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2]" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="py-3 px-3 rounded-btn bg-gradient-to-br from-primary to-primary2 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary/30 border border-white/20 active:scale-95 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4 stroke-[2]" />
            <span>WhatsApp Receipt</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
