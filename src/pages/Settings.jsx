import React, { useState, useEffect } from 'react';
import {
  Save,
  Download,
  FileSpreadsheet,
  User,
  Shield,
  CheckCircle2,
  LogOut,
  Smartphone,
  Moon,
  Sun,
} from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

const emptyProfile = {
  name: '',
  businessName: '',
  phone: '',
  upiId: '',
};

export default function Settings() {
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      alert('To install RentPilot on your mobile device:\n\n1. Open your browser menu (⋮ on Chrome, or Share icon on Safari).\n2. Tap "Install App" or "Add to Home Screen".\n3. The RentPilot app will appear on your home screen with the new logo!');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error('Please log in again.');

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('full_name, business_name, phone')
          .eq('id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        let loadedProfile;

        if (data) {
          loadedProfile = {
            name: data.full_name || '',
            businessName: data.business_name || '',
            phone: data.phone || '',
            upiId: data.upi_id || '',
          };
        } else {
          const metadata = user.user_metadata || {};

          loadedProfile = {
            name: metadata.full_name || '',
            businessName: metadata.business_name || '',
            phone: metadata.phone || '',
            upiId: '',
          };
        }

        try {
          const local = JSON.parse(localStorage.getItem('landlordProfile') || '{}');
          if (!loadedProfile.upiId && local.upiId) loadedProfile.upiId = local.upiId;
        } catch { /* ignore */ }

        if (active) {
          setProfile(loadedProfile);
          localStorage.setItem(
            'landlordProfile',
            JSON.stringify(loadedProfile)
          );
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load your profile.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSavedSuccess(false);

    if (
      !profile.name.trim() ||
      !profile.businessName.trim() ||
      !profile.phone.trim()
    ) {
      setError('Please complete all required fields.');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Please log in again.');

      const savedProfile = {
        name: profile.name.trim(),
        businessName: profile.businessName.trim(),
        phone: profile.phone.trim(),
        upiId: (profile.upiId || '').trim(),
      };

      const baseData = {
        id: user.id,
        full_name: savedProfile.name,
        business_name: savedProfile.businessName,
        phone: savedProfile.phone,
      };

      let saveError = null;
      if (savedProfile.upiId) {
        const { error: upiSaveError } = await supabase
          .from('profiles')
          .upsert({ ...baseData, upi_id: savedProfile.upiId }, { onConflict: 'id' });
        
        if (upiSaveError) {
          console.warn('Could not save upi_id to Supabase (column may not exist). Saving base profile and storing UPI locally:', upiSaveError.message);
          const { error: fallbackError } = await supabase
            .from('profiles')
            .upsert(baseData, { onConflict: 'id' });
          saveError = fallbackError;
        }
      } else {
        const { error } = await supabase
          .from('profiles')
          .upsert(baseData, { onConflict: 'id' });
        saveError = error;
      }

      if (saveError) throw saveError;

      setProfile(savedProfile);

      localStorage.setItem(
        'landlordProfile',
        JSON.stringify(savedProfile)
      );

      setSavedSuccess(true);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      setError(err.message || 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      showToast('Generating Excel/CSV report...', 'info');

      let paymentRows = [];
      let tenantRows = [];

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [pRes, tRes] = await Promise.all([
            supabase
              .from('payments')
              .select('id, receipt_number, payment_date, payment_month, rent_amount, electricity_amount, total_amount, payment_method, description, tenant_id')
              .order('payment_date', { ascending: false }),
            supabase
              .from('tenants')
              .select('id, full_name, unit_label, phone')
          ]);

          paymentRows = pRes.data || [];
          tenantRows = tRes.data || [];
        }
      } catch (e) {
        console.warn('Could not fetch Supabase data for export, using cache:', e);
      }

      if (paymentRows.length === 0) {
        try {
          paymentRows = JSON.parse(localStorage.getItem('app_receipts') || '[]');
        } catch { /* ignore */ }
      }

      const tenantMap = Object.fromEntries(tenantRows.map(t => [t.id, t]));

      const headers = [
        'Receipt No',
        'Payment Date',
        'Rent Month',
        'Tenant Name',
        'Unit / Room',
        'Rent (₹)',
        'Electricity (₹)',
        'Total Paid (₹)',
        'Payment Mode',
        'Notes',
      ];

      const csvEscape = (val) => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = paymentRows.map((p) => {
        const t = tenantMap[p.tenant_id] || {};
        const tenantName = p.tenantName || t.full_name || 'Tenant';
        const unit = p.unit || t.unit_label || '';
        const receiptNo = p.receiptNumber || p.receipt_number || p.id?.slice(0, 8) || 'N/A';
        const date = p.date || p.payment_date || '';
        const month = p.month || p.payment_month || '';
        const rent = Number(p.amount || p.rent_amount || 0);
        const elec = Number(p.electricityAmount || p.electricity_amount || 0);
        const total = Number(p.totalAmount || p.total_amount || (rent + elec));
        const mode = p.paymentMode || p.payment_method || 'UPI';
        const notes = p.description || '';

        return [
          csvEscape(receiptNo),
          csvEscape(date),
          csvEscape(month),
          csvEscape(tenantName),
          csvEscape(unit),
          rent,
          elec,
          total,
          csvEscape(mode),
          csvEscape(notes),
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      const todayStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `RentPilot_Rent_Report_${todayStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('Excel/CSV Report downloaded!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Could not export report', 'error');
    }
  };

  const handleExportBackup = () => {
    try {
      const data = {
        profile,
        properties: JSON.parse(
          localStorage.getItem('app_properties') || '[]'
        ),
        tenants: JSON.parse(
          localStorage.getItem('app_tenants') || '[]'
        ),
        receipts: JSON.parse(
          localStorage.getItem('app_receipts') || '[]'
        ),
      };

      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `RentPilot_Backup_${new Date()
        .toISOString()
        .split('T')[0]}.json`;

      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded', 'info');
    } catch (err) {
      setError(err.message || 'Unable to export the backup.');
    }
  };

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* Sticky Glass Top Header */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-ink dark:text-white leading-none">
            App Settings
          </h1>
          <p className="text-[10px] font-bold text-muted dark:text-[#98a3c4] uppercase tracking-wider mt-0.5">
            Owner Profile &amp; Preferences
          </p>
        </div>

        {/* Theme Quick Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-btn glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition cursor-pointer active:scale-95"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber stroke-[2]" /> : <Moon className="w-4 h-4 text-primary stroke-[2]" />}
        </button>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {savedSuccess && (
          <div className="p-3.5 rounded-tile bg-teal/15 border border-teal/25 text-teal text-xs font-bold flex items-center gap-2 animate-fade-up">
            <CheckCircle2 className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Profile details saved successfully!</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-tile bg-rose/15 border border-rose/25 text-rose text-xs font-bold animate-fade-up break-words"
          >
            {error}
          </div>
        )}

        {/* Responsive Grid for Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Owner Details Form */}
          <form onSubmit={handleSave}>
            <GlassCard className="animate-fade-up space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/60 dark:border-white/10">
                <div className="w-8 h-8 rounded-btn bg-primary/10 text-primary flex items-center justify-center">
                  <User className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
                    Owner Details
                  </h3>
                  <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium">
                    Appears on tenant receipts and WhatsApp alerts.
                  </p>
                </div>
              </div>

              {loading ? (
                <p className="text-xs text-muted py-4 text-center font-semibold">
                  Loading owner details...
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-ink dark:text-white mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Rahul Sharma"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink dark:text-white mb-1">
                      Property / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="organization"
                      placeholder="e.g. Skyline Heights / Sharma Properties"
                      value={profile.businessName}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          businessName: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink dark:text-white mb-1">
                      Contact Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="10-digit phone number"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile({ ...profile, phone: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink dark:text-white mb-1 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-primary stroke-[2]" />
                      UPI ID for Rent Collection (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or username@okhdfcbank"
                      value={profile.upiId || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, upiId: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                    <p className="text-[10px] text-muted dark:text-[#98a3c4] mt-1 font-medium">
                      Attached in WhatsApp rent reminders so tenants can pay you with one click.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3.5 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="w-4 h-4 stroke-[2]" />
                    <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                  </button>
                </>
              )}
            </GlassCard>
          </form>

          {/* Right Column: Theme, App, Backup, Logout */}
          <div className="space-y-4">
            {/* Theme Settings Card */}
            <GlassCard className="animate-fade-up space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-btn bg-primary/10 text-primary flex items-center justify-center">
                    {isDark ? <Moon className="w-4 h-4 stroke-[2]" /> : <Sun className="w-4 h-4 stroke-[2]" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
                      Theme &amp; Appearance
                    </h3>
                    <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium">
                      {isDark ? 'Dark glassmorphism theme' : 'Light glassmorphism theme'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-btn glass-panel text-xs font-extrabold text-primary dark:text-[#8d99ff] hover:bg-primary/15 transition active:scale-95 cursor-pointer"
                >
                  Switch to {isDark ? 'Light' : 'Dark'}
                </button>
              </div>
            </GlassCard>

            {/* App Installation / PWA */}
            <GlassCard className="animate-fade-up space-y-3">
              <div className="flex items-center gap-3 pb-2 border-b border-white/60 dark:border-white/10">
                <img src="/logo.png" alt="RentPilot" className="w-9 h-9 rounded-btn object-contain shadow-glass-sm shrink-0" />
                <div>
                  <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
                    Install Mobile App (PWA)
                  </h3>
                  <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium">
                    Install directly on Android, iOS or Desktop
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted dark:text-[#98a3c4] font-medium leading-relaxed">
                RentPilot is a full Progressive Web App. Install it directly onto your phone for offline support, instant receipt generation and app icon.
              </p>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3 rounded-btn glass-panel hover:bg-white/90 dark:hover:bg-white/10 text-ink dark:text-white text-xs font-extrabold flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4 stroke-[2]" />
                <span>{isInstalled ? 'App Already Installed ✅' : 'Install RentPilot on Phone'}</span>
              </button>
            </GlassCard>

            {/* Excel & Accounts Report Export */}
            <GlassCard className="animate-fade-up space-y-3.5">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/60 dark:border-white/10">
                <div className="w-8 h-8 rounded-btn bg-teal/15 text-teal flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
                    Excel &amp; Accounts Report
                  </h3>
                  <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium">
                    Export your rent ledger for Excel &amp; CA
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted dark:text-[#98a3c4] font-medium leading-relaxed">
                Download a clean, structured spreadsheet containing all tenant payments, rent dues, electricity charges, and receipt records. Compatible with MS Excel, Google Sheets, and accounting.
              </p>

              <div className="space-y-2 pt-1">
                {/* Primary Button: Download Excel / CSV */}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full py-3 px-4 rounded-btn bg-gradient-to-br from-primary to-primary2 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-primary/25 active:scale-95 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 stroke-[2]" />
                  <span>Download Excel Report (CSV)</span>
                </button>

                {/* Secondary Button: Download Full Backup (JSON) */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-2.5 px-4 rounded-btn glass-panel text-muted hover:text-ink dark:hover:text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Download Raw Backup (JSON)</span>
                </button>
              </div>
            </GlassCard>

            {/* Account Logout */}
            <div className="pt-2 animate-fade-up">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to log out of RentPilot?')) {
                    localStorage.removeItem('rentpilot_guest_mode');
                    await supabase.auth.signOut();
                    window.location.reload();
                  }
                }}
                className="w-full py-3.5 rounded-btn bg-rose/10 hover:bg-rose/20 text-rose border border-rose/25 text-xs font-extrabold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <LogOut className="w-4 h-4 stroke-[2]" />
                <span>Sign Out of Account</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
