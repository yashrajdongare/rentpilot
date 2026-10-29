
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  DoorOpen,
  Plus,
  Receipt,
  ChevronRight,
  Edit3,
  MessageCircle,
  ShieldCheck,
  Calendar,
  MapPin,
  X,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  BookOpen,
  Download,
  Upload,
} from 'lucide-react';
import RecordPaymentModal from '../components/RecordPaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import { supabase } from '../lib/supabase';
import {
  calculateRentCharge,
  calculateDueDate,
  calculatePeriodRange,
  toMonthKey,
  fmtMonthLabel,
  fmtShortMonth,
  getNextMonthKey,
  roundToTwo,
} from '../utils/billing';

export default function TenantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Which tab is active in the lower section: 'LEDGER' | 'HISTORY'
  const [activeDetailTab, setActiveDetailTab] = useState('LEDGER');
  // For pre-selecting month when opening payment modal from ledger
  const [preselectedMonth, setPreselectedMonth] = useState(null);
  const [preselectedAmount, setPreselectedAmount] = useState(null);
  const [aadhaarDocument, setAadhaarDocument] = useState(null);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [editAadharFile, setEditAadharFile] = useState(null);
  const [editAadharPreview, setEditAadharPreview] = useState('');

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: '',
    rent: '',
    deposit: '',
    idProof: '',
    agreementExpiry: '',
  });

  let landlordProfile = {};

  try {
    landlordProfile = JSON.parse(
      localStorage.getItem('landlordProfile') || '{}'
    );
  } catch {
    landlordProfile = {};
  }

  const loadTenant = React.useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLoadError('');

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        throw new Error('Please sign in to view tenant details.');
      }

      // Load the tenant belonging to the signed-in owner.
      const { data, error } = await supabase
        .from('tenants')
        .select(
          'id, owner_id, property_id, full_name, phone, permanent_address, unit_label, monthly_rent, security_deposit, move_in_date, move_out_date, last_electricity_reading, last_electricity_reading_date, status, rent_collection_mode, rent_calculation_method, due_day, rent_start_date, lease_type, lease_start_date, lease_period_value, lease_period_unit, lease_expires_on, notes'
        )
        .eq('id', id)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Tenant not found or you do not have access.'
        );
      }

      let parsedNotes = {};
      try {
        parsedNotes = JSON.parse(data.notes || '{}');
      } catch {
        parsedNotes = {};
      }

      // Query tenant_documents
      const { data: docRows } = await supabase
        .from('tenant_documents')
        .select('id, document_type, file_path, file_name, created_at')
        .eq('tenant_id', id)
        .eq('owner_id', user.id);

      const aadhaarDoc = (docRows || []).find((d) => d.document_type === 'aadhaar');
      setAadhaarDocument(aadhaarDoc || null);

      // Load property defaults
      const { data: property, error: propertyError } =
        await supabase
          .from('properties')
          .select('name, rent_collection_mode, rent_calculation_method, due_day')
          .eq('id', data.property_id)
          .eq('owner_id', user.id)
          .maybeSingle();

      if (propertyError) throw propertyError;

      const propertyName =
        property?.name || 'Property unavailable';

      const rentCollectionMode = data.rent_collection_mode || property?.rent_collection_mode || 'POST_PAID';
      const rentCalculationMethod = data.rent_calculation_method || property?.rent_calculation_method || 'RELATIVE';
      const dueDay = Number(data.due_day || property?.due_day || 10);
      const moveInDate = data.move_in_date || '';
      const rentStartDate = data.rent_start_date || moveInDate;
      const leaseType = data.lease_type || 'UNTIL_LEAVES';
      const agreementExpiry = data.lease_expires_on 
        ? new Date(`${data.lease_expires_on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
        : (leaseType === 'UNTIL_LEAVES' ? 'Until Tenant Leaves' : '');

      const aadharNum = parsedNotes.aadhar_number || '';

      const formattedTenant = {
        ...data,
        name: data.full_name,
        propertyName,
        flatNo: data.unit_label || '',
        unit: data.unit_label
          ? `${data.unit_label} (${propertyName})`
          : propertyName,
        address: data.permanent_address || '',
        rent: data.monthly_rent,
        deposit: data.security_deposit,
        moveInDate,
        rentStartDate,
        startDate: rentStartDate || moveInDate,
        rentCollectionMode,
        rentCalculationMethod,
        dueDay,
        isPostPaid: rentCollectionMode === 'POST_PAID',
        leaseType,
        idProof: aadharNum || (aadhaarDoc ? 'Aadhaar Verified' : ''),
        roomType: parsedNotes.room_type || '',
        agreementExpiry,
      };

      // Load payment records from Supabase.
      const { data: paymentRows, error: paymentsError } =
        await supabase
          .from('payments')
          .select(
            'id, tenant_id, payment_date, payment_month, rent_amount, electricity_amount, total_amount, payment_method, electricity_previous_reading, electricity_new_reading, electricity_units, electricity_unit_rate, receipt_number, description, created_at'
          )
          .eq('tenant_id', id)
          .eq('owner_id', user.id)
          .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      const databaseReceipts = (paymentRows || []).map(
        (row) => {
          const monthValue =
            row.payment_month || row.payment_date;

          const monthDate = monthValue
            ? new Date(
                `${monthValue.slice(0, 7)}-15T12:00:00`
              )
            : null;

          const dateValue = row.payment_date
            ? new Date(`${row.payment_date}T12:00:00`)
            : null;

          return {
            id: row.id,
            receiptNumber: row.receipt_number,
            tenantId: row.tenant_id,
            tenantName: formattedTenant.name,
            phone: formattedTenant.phone || '',
            unit: formattedTenant.unit,
            amount: Number(row.rent_amount) || 0,
            electricityAmount:
              Number(row.electricity_amount) || 0,
            prevReading:
              Number(row.electricity_previous_reading) || 0,
            currReading:
              Number(row.electricity_new_reading) || 0,
            consumedUnits:
              Number(row.electricity_units) || 0,
            totalAmount: Number(row.total_amount) || 0,
            paymentMode: row.payment_method || 'UPI',
            description: row.description || '',
            periodRange:
              monthValue && formattedTenant.moveInDate
                ? calculatePeriodRange(
                    formattedTenant.moveInDate,
                    monthValue.slice(0, 7)
                  ).range
                : '',
            collectionMode: 'Post-Paid',
            month: monthDate
              ? monthDate.toLocaleString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })
              : 'Rent Payment',
            date: dateValue
              ? dateValue.toLocaleDateString('en-GB')
              : '',
            paymentDate: row.payment_date,
            paymentMonth: row.payment_month,
            monthKey: row.payment_month ? row.payment_month.slice(0, 7) : (row.payment_date ? row.payment_date.slice(0, 7) : ''),
            createdAt: row.created_at,
          };
        }
      );

      // Preserve older receipts that exist only in this browser.
      let legacyReceipts = [];

      try {
        const savedReceipts = JSON.parse(
          localStorage.getItem('app_receipts') || '[]'
        );

        legacyReceipts = savedReceipts
          .filter(
            (receipt) =>
              String(receipt.tenantId) === String(id) &&
              !databaseReceipts.some(
                (saved) =>
                  String(saved.id) === String(receipt.id)
              )
          )
          .map((receipt) => ({
            ...receipt,
            tenantName:
              receipt.tenantName || formattedTenant.name,
            phone: receipt.phone || formattedTenant.phone || '',
            unit: receipt.unit || formattedTenant.unit,
          }));
      } catch (storageError) {
        console.warn(
          'Could not read older browser receipts:',
          storageError
        );
      }

      setTenant(formattedTenant);

      setEditForm({
        name: formattedTenant.name || '',
        phone: formattedTenant.phone || '',
        address: formattedTenant.address || '',
        rent: formattedTenant.rent ?? '',
        deposit: formattedTenant.deposit ?? '',
        idProof: aadharNum,
        agreementExpiry: data.lease_expires_on || '',
        dueDay: data.due_day || 10,
      });

      // Database records first, older browser receipts afterward.
      setPayments([...databaseReceipts, ...legacyReceipts]);
    } catch (err) {
      console.error('Error loading tenant details:', err);
      setLoadError(
        err.message || 'Could not load tenant details.'
      );
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTenant(true);
  }, [loadTenant]);

  const monthlyRent = Number(tenant?.rent) || 0;
  const securityDeposit = Number(tenant?.deposit) || 0;

  const totalCollected = payments.reduce(
    (sum, payment) =>
      sum +
      (Number(payment.amount) || 0) +
      (Number(payment.electricityAmount) || 0),
    0
  );

  // ── Month-wise Rent Ledger (Hook called unconditionally) ──────────────────
  const monthLedger = useMemo(() => {
    if (!tenant) return [];
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayDateStr = now.toLocaleDateString('en-CA');
    const dueDay = tenant.dueDay || 10;
    const moveInDate = tenant.moveInDate || tenant.move_in_date || tenant.startDate || '';

    // Determine start month from move_in_date
    let startKey = todayKey;
    if (moveInDate && String(moveInDate).length >= 7) {
      startKey = String(moveInDate).slice(0, 7);
    } else if (payments.length > 0) {
      const earliest = payments[payments.length - 1];
      const pKey = toMonthKey(earliest.paymentMonth || earliest.paymentDate);
      if (pKey) startKey = pKey;
    }

    const getPaymentMonthKey = (p) => {
      if (!p) return '';
      if (p.monthKey) return p.monthKey;
      if (p.paymentMonth) return String(p.paymentMonth).slice(0, 7);
      if (p.payment_month) return String(p.payment_month).slice(0, 7);
      if (p.month && /^\d{4}-\d{2}$/.test(p.month)) return p.month;
      if (p.paymentDate) return String(p.paymentDate).slice(0, 7);
      return '';
    };

    // Map payments by month key for quick lookup
    const paidByMonth = {};
    payments.forEach((p) => {
      const mk = getPaymentMonthKey(p);
      if (!mk) return;
      if (!paidByMonth[mk]) paidByMonth[mk] = 0;
      paidByMonth[mk] += Number(p.amount) || 0; // Rent payment only
    });

    const rows = [];
    const [startY, startM] = startKey.split('-').map(Number);
    let cursor = (startY && startM) ? new Date(startY, startM - 1, 1, 12) : new Date();
    const end = new Date(`${todayKey}-01T12:00:00`);
    if (cursor > end) cursor = new Date(end);
    let guard = 0;

    while (cursor <= end && guard < 240) {
      guard++;
      const mk = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const paid = roundToTwo(paidByMonth[mk] || 0);
      const due = calculateRentCharge({
        monthlyRent,
        moveInDate,
        monthKey: mk,
      });
      const balance = Math.max(roundToTwo(due - paid), 0);

      // In Fixed Post-Paid: Rent for month mk is due on dueDay in month mk+1
      const dueDateStr = calculateDueDate(mk, dueDay);
      const nextMk = getNextMonthKey(mk);
      const dueNote = `Due on ${dueDay} ${fmtShortMonth(nextMk)}`;

      let status;
      if (balance <= 0.009) {
        status = 'PAID';
      } else if (paid > 0) {
        status = 'PARTIAL';
      } else if (todayDateStr <= dueDateStr) {
        status = 'UPCOMING'; // Not yet overdue
      } else {
        status = 'OVERDUE';
      }

      rows.push({
        monthKey: mk,
        label: fmtMonthLabel(mk),
        due,
        paid,
        balance,
        dueDate: dueDateStr,
        dueNote,
        status,
        receipts: payments.filter(
          (p) => getPaymentMonthKey(p) === mk
        ),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
    }
    return rows.reverse(); // newest first
  }, [tenant, payments, monthlyRent]);

  const ledgerPendingCount = monthLedger.filter((r) => r.status === 'OVERDUE' || r.status === 'PARTIAL').length;
  const overdueBalance = roundToTwo(
    monthLedger
      .filter((r) => r.status === 'OVERDUE')
      .reduce((s, r) => s + r.balance, 0)
  );
  const ledgerTotalOutstanding = roundToTwo(
    monthLedger.reduce((s, r) => s + r.balance, 0)
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-sm font-bold text-slate-600">
        Loading tenant details...
      </div>
    );
  }

  if (loadError || !tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8fafc] p-6">
        <p className="text-sm font-semibold text-rose-600 text-center">
          {loadError || 'Tenant not found.'}
        </p>

        <button
          onClick={() => navigate('/tenants')}
          className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold"
        >
          Back to Tenants
        </button>
      </div>
    );
  }

  const handleVacateTenant = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to vacate ${tenant.name}?`
    );

    if (!confirmed) return;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please sign in again.');
      }

      const moveOutDate = new Date()
        .toLocaleDateString('en-CA');

      const { data, error } = await supabase
        .from('tenants')
        .update({
          status: 'vacated',
          move_out_date: moveOutDate,
        })
        .eq('id', id)
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .select('id, status, move_out_date')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Tenant was not updated. They may already be vacated, or you may not have access.'
        );
      }

      alert('Tenant marked as moved out successfully.');
      navigate('/tenants');
    } catch (error) {
      console.error('Error vacating tenant:', error);
      alert(error.message || 'Failed to vacate tenant.');
    }
  };

  // Called after RecordPaymentModal confirms the payment was saved.
  const handlePaymentSuccess = (receipt) => {
    setPayments((previous) => [
      receipt,
      ...previous.filter(
        (payment) =>
          String(payment.id) !== String(receipt.id)
      ),
    ]);
    setPreselectedMonth(null);
    setPreselectedAmount(null);
    setIsPayModalOpen(false);

    // Update the display reading without changing tenant occupancy status.
    setTenant((previous) => ({
      ...previous,
      last_electricity_reading: receipt.currReading,
      last_electricity_reading_date: receipt.paymentDate,
    }));

    // Re-sync authoritative Supabase records in background
    loadTenant(false);
  };

  const handleSendLedgerWhatsAppReminder = (row) => {
    const cleanPhone = String(tenant?.phone || '').replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (!phoneWithCode) {
      alert('Tenant phone number is not available.');
      return;
    }

    const message =
      `*RENT DUE REMINDER* 🔔\n` +
      `Dear ${tenant.name || 'Tenant'},\n\n` +
      `This is a gentle reminder regarding your rent for *${row.label}*:\n` +
      `• *Pending Rent:* ₹${row.balance.toLocaleString('en-IN')}\n` +
      `• *Due Date:* ${row.dueDate}\n` +
      `• *Status:* ${row.status}\n\n` +
      `Kindly clear the pending dues.\n` +
      (landlordProfile?.upi_id ? `UPI ID: ${landlordProfile.upi_id}\n` : '') +
      `Thank you,\n` +
      `${landlordProfile?.businessName || landlordProfile?.name || 'Landlord'}`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please sign in again.');
      }

      let existingNotes = {};
      try { existingNotes = JSON.parse(tenant.notes || '{}'); } catch { existingNotes = {}; }
      const updatedNotes = {
        ...existingNotes,
        aadhar_number: editForm.idProof?.trim() || undefined,
      };

      const { data, error } = await supabase
        .from('tenants')
        .update({
          full_name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          permanent_address: editForm.address.trim(),
          monthly_rent: Number(editForm.rent),
          security_deposit: Number(editForm.deposit) || 0,
          lease_expires_on: editForm.agreementExpiry || null,
          due_day: Math.min(28, Math.max(1, Number(editForm.dueDay) || 10)),
          notes: JSON.stringify(updatedNotes),
        })
        .eq('id', id)
        .eq('owner_id', user.id)
        .select(
          'id, owner_id, property_id, full_name, phone, permanent_address, unit_label, monthly_rent, security_deposit, move_in_date, move_out_date, last_electricity_reading, last_electricity_reading_date, status, rent_collection_mode, rent_calculation_method, due_day, rent_start_date, lease_type, lease_start_date, lease_period_value, lease_period_unit, lease_expires_on, notes'
        )
        .single();

      if (error) throw error;

      if (editAadharPreview) {
        try {
          const { data: newDoc } = await supabase.from('tenant_documents').insert({
            owner_id: user.id,
            tenant_id: id,
            document_type: 'aadhaar',
            file_path: editAadharPreview,
            file_name: editAadharFile?.name || 'aadhaar_card.jpg',
            mime_type: editAadharFile?.type || 'image/jpeg',
            file_size_bytes: editAadharFile?.size || 0,
          }).select().single();
          if (newDoc) setAadhaarDocument(newDoc);
        } catch (docErr) {
          console.warn('Could not save updated document record:', docErr);
        }
      }

      const updatedTenant = {
        ...tenant,
        ...data,
        name: data.full_name,
        address: data.permanent_address || '',
        rent: data.monthly_rent,
        deposit: data.security_deposit,
        startDate: data.move_in_date || '',
        dueDay: data.due_day || 10,
        flatNo: data.unit_label || '',
        unit: data.unit_label
          ? `${data.unit_label} (${tenant.propertyName})`
          : tenant.propertyName,
        agreementExpiry: data.lease_expires_on 
          ? new Date(`${data.lease_expires_on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
          : (data.lease_type === 'UNTIL_LEAVES' ? 'Until Tenant Leaves' : ''),
      };

      setTenant(updatedTenant);

      setEditForm((previous) => ({
        ...previous,
        name: data.full_name || '',
        phone: data.phone || '',
        address: data.permanent_address || '',
        rent: data.monthly_rent ?? '',
        deposit: data.security_deposit ?? '',
      }));

      setIsEditModalOpen(false);
      alert('Tenant details updated successfully!');
    } catch (error) {
      console.error('Error updating tenant:', error);
      alert(error.message || 'Failed to update tenant details.');
    }
  };

  const startWhatsApp = () => {
    const cleanPhone = tenant.phone
      ? tenant.phone.replace(/[^0-9]/g, '')
      : '';

    const phoneWithCode =
      cleanPhone.length === 10
        ? `91${cleanPhone}`
        : cleanPhone;

    if (!phoneWithCode) {
      alert('No valid phone number is available for this tenant.');
      return;
    }

    window.open(
      `https://wa.me/${phoneWithCode}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const isActiveTenant = tenant.status === 'active';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-24">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-slate-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900" />
          </button>

          <h1 className="text-base font-bold text-slate-900">
            Tenant Details
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="text-[#1e3a5f] bg-[#1e3a5f]/10 hover:bg-[#1e3a5f]/20 p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit</span>
          </button>

          {isActiveTenant && (
            <button
              onClick={handleVacateTenant}
              className="text-rose-600 bg-rose-50 hover:bg-rose-100 p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition"
            >
              <DoorOpen className="w-4 h-4" />
              <span>Vacate</span>
            </button>
          )}
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 text-[#1e3a5f] flex items-center justify-center font-black text-xl shadow-xs">
              {tenant.name
                ? tenant.name.substring(0, 2).toUpperCase()
                : 'TN'}
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900">
                {tenant.name}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {tenant.unit}
              </p>
            </div>
          </div>

          <div className="mt-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 flex items-start gap-2 text-xs">
            <MapPin className="w-4 h-4 text-[#1e3a5f] shrink-0 mt-0.5" />
            <p className="text-slate-600 font-medium leading-relaxed">
              {tenant.address || 'No address provided'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
            <a
              href={`tel:${tenant.phone}`}
              className="py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition"
            >
              <Phone className="w-3.5 h-3.5 text-[#1e3a5f]" />
              <span>Call ({tenant.phone})</span>
            </a>

            <button
              onClick={startWhatsApp}
              className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5 transition"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-medium">
                Join Date: <strong>{tenant.startDate || 'N/A'}</strong>
              </span>
              <span className="text-[10px] font-bold text-[#1e3a5f] bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 px-2 py-0.5 rounded-md">
                {tenant.isPostPaid ? `Post-Paid (Previous Month) • Due Day ${tenant.dueDay || 10}` : `Pre-Paid (Current Month) • Due Day ${tenant.dueDay || 10}`}
              </span>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                isActiveTenant
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isActiveTenant ? 'ACTIVE' : tenant.status === 'vacated' ? 'VACATED' : 'ARCHIVED'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Rent
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              ₹{monthlyRent.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Deposit
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              ₹{securityDeposit.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Total Paid
            </p>
            <p className="text-sm font-black text-emerald-600 mt-0.5">
              ₹{totalCollected.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2.5 text-xs">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            KYC &amp; Document Records
          </h3>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
              Aadhaar / ID Proof
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                {tenant.idProof || (aadhaarDocument ? 'Document Verified' : 'Not Provided')}
              </span>
              {aadhaarDocument?.file_path && (
                <button
                  type="button"
                  onClick={() => setIsDocPreviewOpen(true)}
                  className="px-2.5 py-1 bg-[#1e3a5f]/10 text-[#1e3a5f] hover:bg-[#1e3a5f]/20 rounded-lg font-bold text-[10px] transition active:scale-95"
                >
                  View Photo
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Calendar className="w-4 h-4 text-[#1e3a5f]" />
              Agreement Validity
            </span>
            <span className="font-bold text-slate-900">
              {tenant.agreementExpiry || 'Not Specified'}
            </span>
          </div>
        </div>

        {isActiveTenant && (
          <button
            onClick={() => { setPreselectedMonth(null); setPreselectedAmount(null); setIsPayModalOpen(true); }}
            className="w-full py-3.5 bg-[#1e3a5f] hover:bg-[#162b47] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition text-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record New Payment</span>
          </button>
        )}

        {/* ── Tabs: Ledger / History ──────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveDetailTab('LEDGER')}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeDetailTab === 'LEDGER'
                  ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f] bg-[#1e3a5f]/5'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Rent Ledger
              {ledgerPendingCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none">
                  {ledgerPendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveDetailTab('HISTORY')}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeDetailTab === 'HISTORY'
                  ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f] bg-[#1e3a5f]/5'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Payment History
              <span className="bg-slate-200 text-slate-600 text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none">
                {payments.length}
              </span>
            </button>
          </div>

          <div className="p-4">
            {/* ── LEDGER TAB ── */}
            {activeDetailTab === 'LEDGER' && (
              <>
                {/* Ledger summary */}
                {ledgerTotalOutstanding > 0 && (
                  <div className="mb-3 bg-rose-50 border border-rose-200 rounded-2xl px-3.5 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Total Outstanding</p>
                        <p className="text-base font-black text-rose-700 mt-0.5">₹{ledgerTotalOutstanding.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Overdue Dues</p>
                        <p className="text-sm font-black text-rose-600 mt-0.5">₹{overdueBalance.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-rose-200/60 flex items-center justify-between text-[10px] text-rose-600 font-semibold">
                      <span>{ledgerPendingCount} unpaid / partial period{ledgerPendingCount !== 1 ? 's' : ''}</span>
                      <span>{monthLedger.filter(r => r.status === 'OVERDUE').length} overdue period{monthLedger.filter(r => r.status === 'OVERDUE').length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}

                {monthLedger.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">No ledger data. Add a move-in date to the tenant.</p>
                ) : (
                  <div className="space-y-2">
                    {monthLedger.map((row) => {
                      const isPaid = row.status === 'PAID';
                      const isPartial = row.status === 'PARTIAL';
                      const isUpcoming = row.status === 'UPCOMING';
                      const isOverdue = row.status === 'OVERDUE';

                      return (
                        <div
                          key={row.monthKey}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-xs transition ${
                            isPaid
                              ? 'bg-emerald-50/70 border-emerald-200/70'
                              : isPartial
                              ? 'bg-amber-50/70 border-amber-200/70'
                              : isUpcoming
                              ? 'bg-blue-50/50 border-blue-200/60'
                              : 'bg-rose-50/50 border-rose-200/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                              isPaid ? 'bg-emerald-100 text-emerald-600'
                              : isPartial ? 'bg-amber-100 text-amber-600'
                              : isUpcoming ? 'bg-blue-100 text-blue-600'
                              : 'bg-rose-100 text-rose-500'
                            }`}>
                              {isPaid
                                ? <CheckCircle2 className="w-4 h-4" />
                                : isPartial
                                ? <Clock className="w-4 h-4" />
                                : isUpcoming
                                ? <Clock className="w-4 h-4" />
                                : <AlertCircle className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-slate-900">{row.label}</p>
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                                  isPaid ? 'bg-emerald-100 text-emerald-800'
                                  : isPartial ? 'bg-amber-100 text-amber-800'
                                  : isUpcoming ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : isUpcoming ? 'IN PROGRESS' : 'OVERDUE'}
                                </span>
                              </div>
                              <p className={`text-[10px] font-semibold mt-0.5 ${
                                isPaid ? 'text-emerald-600'
                                : isPartial ? 'text-amber-600'
                                : isUpcoming ? 'text-blue-600'
                                : 'text-rose-500'
                              }`}>
                                {isPaid
                                  ? `Paid ₹${row.paid.toLocaleString('en-IN')}`
                                  : isPartial
                                  ? `Paid ₹${row.paid.toLocaleString('en-IN')} • Balance ₹${row.balance.toLocaleString('en-IN')}`
                                  : `Due ₹${row.due.toLocaleString('en-IN')}`}
                                <span className="text-slate-400 font-normal ml-1">
                                  • {row.dueNote}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* View receipts for this month */}
                            {row.receipts.length > 0 && (
                              <button
                                onClick={() => setSelectedReceipt(row.receipts[0])}
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-[#1e3a5f] transition cursor-pointer"
                                title="View receipt"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Collect button and WhatsApp reminder for pending/partial/upcoming */}
                            {!isPaid && isActiveTenant && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSendLedgerWhatsAppReminder(row)}
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 transition active:scale-95 cursor-pointer"
                                  title="Send WhatsApp rent reminder for this month"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setPreselectedMonth(row.monthKey);
                                    setPreselectedAmount(isPartial ? row.balance : row.due);
                                    setIsPayModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-[#1e3a5f] hover:bg-[#162b47] text-white text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer"
                                >
                                  {isPartial ? 'Pay Balance' : 'Collect'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── HISTORY TAB ── */}
            {activeDetailTab === 'HISTORY' && (
              <>
                {payments.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">
                    No payment records available.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {payments.map((payment, index) => {
                      const rentAmount = Number(payment.amount) || 0;
                      const electricityAmount = Number(payment.electricityAmount) || 0;
                      const totalPaid = rentAmount + electricityAmount;

                      return (
                        <div
                          key={payment.id || index}
                          onClick={() => setSelectedReceipt(payment)}
                          className="py-3 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 px-2 rounded-xl transition active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center font-bold">
                              <Receipt className="w-4 h-4" />
                            </div>

                            <div>
                              <p className="font-bold text-slate-900">
                                {payment.month || 'Rent Payment'}
                              </p>
                              <p className="text-slate-400 text-[11px]">
                                {payment.date || ''} •{' '}
                                <span className="text-[#1e3a5f] font-semibold">
                                  {payment.paymentMode || 'UPI'}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-right">
                            <div>
                              <span className="font-black text-emerald-600 text-sm block">
                                ₹{totalPaid.toLocaleString('en-IN')}
                              </span>

                              {electricityAmount > 0 && (
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  Electricity: ₹{electricityAmount.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>

                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[28px] p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#1e3a5f]" />
                <h2 className="text-base font-black text-slate-900">
                  Edit Tenant Details
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateProfile}
              className="space-y-3.5 text-xs font-semibold"
            >
              <div>
                <label className="block text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      phone: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Permanent Address
                </label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">
                    Rent Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.rent}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        rent: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.deposit}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        deposit: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Aadhaar / ID Card No.
                </label>
                <input
                  type="text"
                  placeholder="xxxx xxxx xxxx"
                  value={editForm.idProof}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      idProof: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Upload / Replace Aadhaar Card Photo
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 border border-dashed border-slate-300 hover:border-[#1e3a5f] rounded-xl text-xs font-semibold text-slate-600 transition">
                    <Upload className="w-3.5 h-3.5 text-[#1e3a5f]" />
                    <span className="truncate">{editAadharFile ? editAadharFile.name : 'Upload New ID Photo'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setEditAadharFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setEditAadharPreview(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                  {(editAadharPreview || aadhaarDocument?.file_path) && (
                    <img
                      src={editAadharPreview || aadhaarDocument.file_path}
                      alt="ID Preview"
                      className="w-9 h-9 object-cover rounded-lg border border-slate-200 shadow-xs shrink-0"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Agreement Expiry Date
                </label>
                <input
                  type="date"
                  value={editForm.agreementExpiry}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      agreementExpiry: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Rent Due Day of Month (1 - 28)
                </label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={editForm.dueDay ?? 10}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      dueDay: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Post-paid rent will be due on this day in the following month (e.g. 10th).
                </p>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-1/2 py-3 bg-[#1e3a5f] hover:bg-[#162b47] text-white rounded-xl font-bold transition shadow-md shadow-[#1e3a5f]/20 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aadhaar / ID Card Document Preview Modal */}
      {isDocPreviewOpen && aadhaarDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Aadhaar / ID Card Proof</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDocPreviewOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center min-h-[220px]">
              {aadhaarDocument.file_path && (aadhaarDocument.file_path.startsWith('data:image') || aadhaarDocument.file_path.startsWith('http')) ? (
                <img
                  src={aadhaarDocument.file_path}
                  alt="Aadhaar Card"
                  className="w-full h-auto max-h-[60vh] object-contain rounded-xl"
                />
              ) : (
                <div className="p-6 text-center">
                  <p className="text-xs text-slate-600 font-bold">
                    File: {aadhaarDocument.file_name || 'ID Document'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <a
                href={aadhaarDocument.file_path}
                download={aadhaarDocument.file_name || 'aadhaar_document'}
                className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#162b47] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </a>
            </div>
          </div>
        </div>
      )}

      <RecordPaymentModal
        isOpen={isPayModalOpen}
        tenant={tenant}
        preselectedMonth={preselectedMonth}
        preselectedAmount={preselectedAmount}
        onClose={() => {
          setIsPayModalOpen(false);
          setPreselectedMonth(null);
          setPreselectedAmount(null);
        }}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <ReceiptModal
        isOpen={!!selectedReceipt}
        receipt={selectedReceipt}
        landlordProfile={landlordProfile}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
