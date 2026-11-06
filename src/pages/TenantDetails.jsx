import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  DoorOpen,
  Plus,
  ReceiptIndianRupee,
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
  Home,
} from 'lucide-react';
import RecordPaymentModal from '../components/RecordPaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import GlassCard from '../components/ui/GlassCard';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import BottomSheet from '../components/ui/BottomSheet';
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
  const [activeDetailTab, setActiveDetailTab] = useState('LEDGER');
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
    dueDay: 10,
  });

  let landlordProfile = {};
  try {
    landlordProfile = JSON.parse(
      localStorage.getItem('landlordProfile') || '{}'
    );
  } catch {
    landlordProfile = {};
  }

  const loadTenant = React.useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    setLoadError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please sign in to view tenant details.');
      }

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
        throw new Error('Tenant not found or you do not have permission to view them.');
      }

      let propertyName = 'Property';

      if (data.property_id) {
        const { data: propertyData } = await supabase
          .from('properties')
          .select('name')
          .eq('id', data.property_id)
          .eq('owner_id', user.id)
          .maybeSingle();

        if (propertyData?.name) {
          propertyName = propertyData.name;
        }
      }

      const { data: paymentRows, error: paymentError } = await supabase
        .from('payments')
        .select(
          'id, tenant_id, payment_date, payment_month, rent_amount, electricity_amount, total_amount, payment_method, electricity_previous_reading, electricity_new_reading, electricity_units, electricity_unit_rate, receipt_number, description, created_at'
        )
        .eq('tenant_id', id)
        .eq('owner_id', user.id)
        .order('payment_date', { ascending: false });

      if (paymentError) throw paymentError;

      try {
        const { data: docRows } = await supabase
          .from('tenant_documents')
          .select('*')
          .eq('tenant_id', id)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });
        if (docRows && docRows.length > 0) {
          setAadhaarDocument(docRows[0]);
        }
      } catch (docErr) {
        console.warn('Could not load tenant documents:', docErr);
      }

      let parsedNotes = {};
      try {
        parsedNotes = JSON.parse(data.notes || '{}');
      } catch {
        parsedNotes = {};
      }
      const aadharNum = parsedNotes?.aadhar_number || '';

      const moveIn = data.move_in_date || '';
      const rent = Number(data.monthly_rent) || 0;
      const dueDay = Number(data.due_day) || 10;

      const formattedTenant = {
        ...data,
        name: data.full_name,
        propertyName,
        address: data.permanent_address || '',
        rent,
        deposit: Number(data.security_deposit) || 0,
        startDate: moveIn,
        moveInDate: moveIn,
        dueDay,
        isPostPaid: true,
        idProof: aadharNum,
        agreementExpiry: data.lease_expires_on
          ? new Date(`${data.lease_expires_on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
          : (data.lease_type === 'UNTIL_LEAVES' ? 'Until Tenant Leaves' : ''),
        flatNo: data.unit_label || '',
        unit: data.unit_label
          ? `${data.unit_label} (${propertyName})`
          : propertyName,
        status: (data.status || 'active').toLowerCase(),
      };

      const databaseReceipts = (paymentRows || []).map((payment) => {
        const pMonth = payment.payment_month || payment.payment_date;
        const pMonthKey = toMonthKey(pMonth);
        const displayMonth = pMonthKey ? fmtMonthLabel(pMonthKey) : '';
        const periodInfo = calculatePeriodRange(moveIn, pMonthKey);

        return {
          id: payment.id,
          receiptNumber: payment.receipt_number || `RP-${payment.id.slice(0, 8)}`,
          tenantId: payment.tenant_id,
          tenantName: data.full_name,
          phone: data.phone || '',
          unit: formattedTenant.unit,
          amount: Number(payment.rent_amount) || 0,
          electricityAmount: Number(payment.electricity_amount) || 0,
          prevReading: Number(payment.electricity_previous_reading) || 0,
          currReading: Number(payment.electricity_new_reading) || 0,
          consumedUnits: Number(payment.electricity_units) || 0,
          totalAmount: Number(payment.total_amount) || 0,
          paymentMode: payment.payment_method || 'UPI',
          description: payment.description || '',
          month: displayMonth,
          monthKey: pMonthKey,
          paymentMonth: payment.payment_month,
          payment_month: payment.payment_month,
          date: payment.payment_date
            ? new Date(`${payment.payment_date}T12:00:00`).toLocaleDateString('en-GB')
            : '',
          paymentDate: payment.payment_date,
          periodRange: periodInfo.range,
          collectionMode: 'Post-Paid (Previous Month)',
          calculationMethod: 'Fixed (1st of Every Month)',
          createdAt: payment.created_at,
        };
      });

      let legacyReceipts = [];
      try {
        const savedReceipts = JSON.parse(
          localStorage.getItem('app_receipts') || '[]'
        );
        legacyReceipts = savedReceipts.filter(
          (receipt) =>
            String(receipt.tenantId) === String(id) &&
            !databaseReceipts.some((dbR) => String(dbR.id) === String(receipt.id))
        );
      } catch (storageError) {
        console.warn('Could not read older receipts:', storageError);
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

      setPayments([...databaseReceipts, ...legacyReceipts]);
    } catch (err) {
      console.error('Error loading tenant details:', err);
      setLoadError(err.message || 'Could not load tenant details.');
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

  const monthLedger = useMemo(() => {
    if (!tenant) return [];
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayDateStr = now.toLocaleDateString('en-CA');
    const dueDay = tenant.dueDay || 10;
    const moveInDate = tenant.moveInDate || tenant.move_in_date || tenant.startDate || '';

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

    const paidByMonth = {};
    payments.forEach((p) => {
      const mk = getPaymentMonthKey(p);
      if (!mk) return;
      if (!paidByMonth[mk]) paidByMonth[mk] = 0;
      paidByMonth[mk] += Number(p.amount) || 0;
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

      const dueDateStr = calculateDueDate(mk, dueDay);
      const nextMk = getNextMonthKey(mk);
      const dueNote = `Due on ${dueDay} ${fmtShortMonth(nextMk)}`;

      let status;
      if (balance <= 0.009) {
        status = 'PAID';
      } else if (paid > 0) {
        status = 'PARTIAL';
      } else if (todayDateStr <= dueDateStr) {
        status = 'UPCOMING';
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
    return rows.reverse();
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

      const moveOutDate = new Date().toLocaleDateString('en-CA');

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

    setTenant((previous) => ({
      ...previous,
      last_electricity_reading: receipt.currReading,
      last_electricity_reading_date: receipt.paymentDate,
    }));

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
          console.warn('Could not save document record:', docErr);
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
      setIsEditModalOpen(false);
      alert('Tenant details updated successfully!');
    } catch (error) {
      console.error('Error updating tenant:', error);
      alert(error.message || 'Failed to update tenant details.');
    }
  };

  const startWhatsApp = () => {
    const cleanPhone = tenant.phone ? tenant.phone.replace(/[^0-9]/g, '') : '';
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (!phoneWithCode) {
      alert('No valid phone number is available for this tenant.');
      return;
    }
    window.open(`https://wa.me/${phoneWithCode}`, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-xs font-bold text-muted">
        Loading tenant details...
      </div>
    );
  }

  if (loadError || !tenant) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <div className="rounded-card p-6 glass-panel text-center max-w-sm space-y-3">
          <p className="text-xs font-bold text-rose">
            {loadError || 'Tenant not found.'}
          </p>
          <button
            onClick={() => navigate('/tenants')}
            className="w-full py-2.5 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold active:scale-95 shadow-sm"
          >
            Back to Tenants
          </button>
        </div>
      </div>
    );
  }

  const isActiveTenant = tenant.status === 'active';

  const detailTabs = [
    { id: 'LEDGER', label: 'Rent Ledger', count: ledgerPendingCount > 0 ? ledgerPendingCount : undefined },
    { id: 'HISTORY', label: 'Payment History', count: payments.length },
  ];

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* Sticky Glass Top Header */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-btn glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition active:scale-95 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <h1 className="text-base font-black text-ink dark:text-white leading-none">
            Tenant Details
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3 py-1.5 rounded-btn glass-panel text-primary dark:text-[#8d99ff] hover:bg-primary/15 text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2]" />
            <span>Edit</span>
          </button>

          {isActiveTenant && (
            <button
              onClick={handleVacateTenant}
              className="px-3 py-1.5 rounded-btn bg-rose/10 hover:bg-rose/20 text-rose border border-rose/20 text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <DoorOpen className="w-3.5 h-3.5 stroke-[2]" />
              <span>Vacate</span>
            </button>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {/* Main Tenant Profile Hero Card */}
        <GlassCard className="animate-fade-up space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={tenant.name} size="lg" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-ink dark:text-white tracking-tight truncate">
                  {tenant.name}
                </h2>
                <StatusBadge status={isActiveTenant ? 'PAID' : 'INACTIVE'} />
              </div>

              <p className="text-xs text-muted dark:text-[#98a3c4] font-semibold mt-0.5 truncate">
                {tenant.unit}
              </p>
            </div>
          </div>

          {tenant.address && (
            <div className="rounded-btn p-2.5 glass-panel-strong border border-white/90 dark:border-white/10 flex items-start gap-2 text-xs">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5 stroke-[2]" />
              <p className="text-muted dark:text-[#98a3c4] font-medium leading-relaxed">
                {tenant.address}
              </p>
            </div>
          )}

          {/* Quick Contact Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <a
              href={`tel:${tenant.phone}`}
              className="py-2.5 px-3 rounded-btn glass-panel text-ink dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Phone className="w-3.5 h-3.5 text-primary stroke-[2]" />
              <span>Call ({tenant.phone})</span>
            </a>

            <button
              type="button"
              onClick={startWhatsApp}
              className="py-2.5 px-3 rounded-btn bg-teal/15 hover:bg-teal/25 text-teal border border-teal/25 text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 stroke-[2]" />
              <span>WhatsApp</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/80 dark:border-white/10 text-xs">
            <span className="text-muted dark:text-[#98a3c4] font-semibold">
              Joined: <strong className="text-ink dark:text-white font-extrabold">{tenant.startDate || 'N/A'}</strong>
            </span>
            <span className="text-[10px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
              Post-Paid • Due {tenant.dueDay || 10}th
            </span>
          </div>
        </GlassCard>

        {/* 3 Metric Tiles (Rent, Deposit, Total Paid) */}
        <div className="grid grid-cols-3 gap-2.5 animate-fade-up">
          <StatTile
            label="Rent"
            value={`₹${monthlyRent.toLocaleString('en-IN')}`}
            color="primary"
          />
          <StatTile
            label="Deposit"
            value={`₹${securityDeposit.toLocaleString('en-IN')}`}
            color="indigo"
          />
          <StatTile
            label="Total Paid"
            value={`₹${totalCollected.toLocaleString('en-IN')}`}
            color="teal"
          />
        </div>

        {/* KYC & Document Record Tile */}
        <GlassCard className="animate-fade-up space-y-2.5 text-xs">
          <h3 className="text-[11px] font-extrabold text-muted dark:text-[#98a3c4] uppercase tracking-wider">
            KYC &amp; Agreement Details
          </h3>

          <div className="flex items-center justify-between py-1 border-b border-white/60 dark:border-white/10">
            <span className="flex items-center gap-1.5 text-muted dark:text-[#98a3c4] font-semibold">
              <ShieldCheck className="w-4 h-4 text-primary stroke-[2]" />
              Aadhaar / ID Card
            </span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-ink dark:text-white">
                {tenant.idProof || (aadhaarDocument ? 'Document Verified' : 'Not Provided')}
              </span>
              {aadhaarDocument?.file_path && (
                <button
                  type="button"
                  onClick={() => setIsDocPreviewOpen(true)}
                  className="px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-extrabold transition active:scale-95"
                >
                  View Photo
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-1.5 text-muted dark:text-[#98a3c4] font-semibold">
              <Calendar className="w-4 h-4 text-primary stroke-[2]" />
              Agreement Validity
            </span>
            <span className="font-extrabold text-ink dark:text-white">
              {tenant.agreementExpiry || 'Not Specified'}
            </span>
          </div>
        </GlassCard>

        {/* Primary Collect Button */}
        {isActiveTenant && (
          <button
            type="button"
            onClick={() => { setPreselectedMonth(null); setPreselectedAmount(null); setIsPayModalOpen(true); }}
            className="w-full py-3.5 px-4 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Rent Payment</span>
          </button>
        )}

        {/* Ledger vs Payment History Section */}
        <GlassCard className="animate-fade-up space-y-4">
          <SegmentedTabs
            tabs={detailTabs}
            activeTab={activeDetailTab}
            onChange={setActiveDetailTab}
          />

          {/* Ledger View */}
          {activeDetailTab === 'LEDGER' && (
            <div className="space-y-3">
              {ledgerTotalOutstanding > 0 && (
                <div className="rounded-tile p-3.5 bg-rose/10 border border-rose/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-rose font-extrabold uppercase tracking-wider">Total Outstanding</p>
                      <p className="text-base font-black text-rose mt-0.5">₹{ledgerTotalOutstanding.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Overdue Dues</p>
                      <p className="text-sm font-black text-rose mt-0.5">₹{overdueBalance.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              )}

              {monthLedger.length === 0 ? (
                <p className="text-center text-xs text-muted py-6">No ledger records available.</p>
              ) : (
                <div className="space-y-2">
                  {monthLedger.map((row) => {
                    const isPaid = row.status === 'PAID';
                    const isPartial = row.status === 'PARTIAL';
                    const isUpcoming = row.status === 'UPCOMING';

                    return (
                      <div
                        key={row.monthKey}
                        className="rounded-tile p-3 glass-panel-strong border border-white/90 dark:border-white/10 flex items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-extrabold text-ink dark:text-white">{row.label}</p>
                            <StatusBadge status={row.status} />
                          </div>

                          <p className="text-[11px] text-muted dark:text-[#98a3c4] font-semibold">
                            {isPaid
                              ? `Paid ₹${row.paid.toLocaleString('en-IN')}`
                              : isPartial
                                ? `Paid ₹${row.paid.toLocaleString('en-IN')} • Balance ₹${row.balance.toLocaleString('en-IN')}`
                                : `Due ₹${row.due.toLocaleString('en-IN')}`}
                            <span className="opacity-75 ml-1">• {row.dueNote}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {row.receipts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(row.receipts[0])}
                              className="w-7 h-7 rounded-btn glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition active:scale-95"
                              title="View receipt"
                            >
                              <ReceiptIndianRupee className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          )}

                          {!isPaid && isActiveTenant && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSendLedgerWhatsAppReminder(row)}
                                className="w-7 h-7 rounded-btn bg-teal/15 text-teal flex items-center justify-center transition active:scale-95"
                                title="Send WhatsApp reminder"
                              >
                                <MessageCircle className="w-3.5 h-3.5 stroke-[2]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreselectedMonth(row.monthKey);
                                  setPreselectedAmount(isPartial ? row.balance : row.due);
                                  setIsPayModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-[10px] font-extrabold active:scale-95 transition"
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
            </div>
          )}

          {/* History View */}
          {activeDetailTab === 'HISTORY' && (
            <div>
              {payments.length === 0 ? (
                <p className="text-center text-xs text-muted py-6">
                  No payment records available.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment, index) => {
                    const rentAmount = Number(payment.amount) || 0;
                    const electricityAmount = Number(payment.electricityAmount) || 0;
                    const totalPaid = rentAmount + electricityAmount;

                    return (
                      <div
                        key={payment.id || index}
                        onClick={() => setSelectedReceipt(payment)}
                        className="rounded-tile p-3 glass-panel-strong hover:bg-white dark:hover:bg-[#1a2142] flex items-center justify-between text-xs cursor-pointer transition active:scale-[0.99] border border-white/90 dark:border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-btn bg-primary/10 text-primary flex items-center justify-center font-bold">
                            <ReceiptIndianRupee className="w-4 h-4 stroke-[2]" />
                          </div>

                          <div>
                            <p className="font-extrabold text-ink dark:text-white">
                              {payment.month || 'Rent Payment'}
                            </p>
                            <p className="text-muted dark:text-[#98a3c4] text-[11px] font-medium">
                              {payment.date || ''} •{' '}
                              <span className="text-primary dark:text-[#8d99ff] font-bold">
                                {payment.paymentMode || 'UPI'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <span className="font-black text-teal text-sm block">
                              ₹{totalPaid.toLocaleString('en-IN')}
                            </span>
                            {electricityAmount > 0 && (
                              <span className="text-[10px] text-muted block font-medium">
                                Elec: ₹{electricityAmount.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>

                          <ChevronRight className="w-4 h-4 text-muted" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </main>

      {/* Edit Tenant BottomSheet */}
      <BottomSheet
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Tenant"
        subtitle={`Update details for ${tenant?.name}`}
      >
        <form onSubmit={handleUpdateProfile} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Permanent Address
            </label>
            <textarea
              rows={2}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="w-full px-3.5 py-2 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-ink dark:text-white mb-1">
                Monthly Rent (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={editForm.rent}
                onChange={(e) => setEditForm({ ...editForm, rent: e.target.value })}
                className="w-full px-3.5 py-2 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-extrabold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink dark:text-white mb-1">
                Security Deposit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.deposit}
                onChange={(e) => setEditForm({ ...editForm, deposit: e.target.value })}
                className="w-full px-3.5 py-2 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-extrabold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Aadhaar / ID Card No.
            </label>
            <input
              type="text"
              placeholder="xxxx xxxx xxxx"
              value={editForm.idProof}
              onChange={(e) => setEditForm({ ...editForm, idProof: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Agreement Expiry Date
            </label>
            <input
              type="date"
              value={editForm.agreementExpiry}
              onChange={(e) => setEditForm({ ...editForm, agreementExpiry: e.target.value })}
              className="w-full px-3.5 py-2 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Rent Due Day of Month (1 - 28)
            </label>
            <input
              type="number"
              min="1"
              max="28"
              value={editForm.dueDay ?? 10}
              onChange={(e) => setEditForm({ ...editForm, dueDay: e.target.value })}
              className="w-full px-3.5 py-2 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-extrabold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="py-3 px-3 rounded-btn glass-panel text-muted hover:text-ink dark:hover:text-white font-bold text-xs active:scale-95 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="py-3 px-3 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white font-extrabold text-xs shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Update</span>
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Aadhaar Preview Modal */}
      <BottomSheet
        isOpen={isDocPreviewOpen && !!aadhaarDocument}
        onClose={() => setIsDocPreviewOpen(false)}
        title="ID Proof Document"
        subtitle={aadhaarDocument?.file_name || 'Aadhaar Card'}
      >
        <div className="space-y-3">
          <div className="rounded-card overflow-hidden glass-panel-strong border border-white/90 dark:border-white/10 flex items-center justify-center min-h-[220px]">
            {aadhaarDocument?.file_path && (aadhaarDocument.file_path.startsWith('data:image') || aadhaarDocument.file_path.startsWith('http')) ? (
              <img
                src={aadhaarDocument.file_path}
                alt="Aadhaar Card"
                className="w-full h-auto max-h-[50vh] object-contain rounded-xl"
              />
            ) : (
              <div className="p-6 text-center">
                <p className="text-xs text-muted font-bold">
                  {aadhaarDocument?.file_name || 'ID Document'}
                </p>
              </div>
            )}
          </div>

          <a
            href={aadhaarDocument?.file_path}
            download={aadhaarDocument?.file_name || 'aadhaar_document'}
            className="w-full py-3 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-primary/20"
          >
            <Download className="w-4 h-4 stroke-[2]" />
            <span>Download Document</span>
          </a>
        </div>
      </BottomSheet>

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
