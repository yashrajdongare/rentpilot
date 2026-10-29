
import React, { useState, useEffect } from 'react';
import {
  Save,
  Download,
  User,
  Shield,
  CheckCircle2,
  LogOut,
  Smartphone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const emptyProfile = {
  name: '',
  businessName: '',
  phone: '',
  upiId: '',
};

export default function Settings() {
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

        // Merge any locally-stored upiId (since DB column may not exist yet)
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

      // Try saving with upi_id first; if column does not exist in Supabase, fall back gracefully
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
          // If the upi_id column doesn't exist in Supabase profiles table, save without it
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
    } catch (err) {
      setError(err.message || 'Unable to save your profile.');
    } finally {
      setSaving(false);
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
    } catch (err) {
      setError(err.message || 'Unable to export the backup.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-28">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-5 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <div className="md:hidden">
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
              App <span className="text-[#1e3a5f]">Settings</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Owner Profile & Data Backup
            </p>
          </div>

          <div className="hidden md:block">
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
              Account & Application Settings
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Manage profile information and data backups
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-md md:max-w-4xl mx-auto">
        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-bold">
              Profile details saved successfully!
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-semibold break-words"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Owner Details
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                These details appear on receipts and reminders.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-4">
              Loading owner details...
            </p>
          ) : (
            <>
              <div>
                <label className="block text-slate-600 text-xs font-bold mb-1">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. John Doe"
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-xs font-bold mb-1">
                  Property / Business Name *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder="e.g. Skyline Heights / Doe Properties"
                  value={profile.businessName}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      businessName: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-xs font-bold mb-1">
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-xs font-bold mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#1e3a5f]" />
                  UPI ID for Rent Collection (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. mobile@upi or username@okhdfcbank"
                  value={profile.upiId || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, upiId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Included in WhatsApp payment reminders so tenants can pay directly.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-[#1e3a5f] hover:bg-[#162b47] disabled:opacity-60 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition mt-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </>
          )}
        </form>

        {/* App Installation / PWA */}
        <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] space-y-3">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
            <img src="/logo.png" alt="RentPilot" className="w-10 h-10 rounded-xl object-contain shadow-xs shrink-0" />
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Install Mobile App (PWA)
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Install directly on Android or Desktop
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            RentPilot is a full Progressive Web App. Install it directly onto your phone to get a standalone app experience with offline support and the new app icon.
          </p>

          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full py-3 bg-[#1e3a5f] hover:bg-[#162b47] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition"
          >
            <Smartphone className="w-4 h-4" />
            <span>{isInstalled ? 'App Already Installed ✅' : 'Install RentPilot on Phone'}</span>
          </button>
        </div>

        <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Data Backup & Export
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Export your application data
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Download your currently stored properties, tenants, profile and receipt data in a JSON backup file.
          </p>

          <button
            type="button"
            onClick={handleExportBackup}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 border border-slate-200/70"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Data Backup (JSON)</span>
          </button>
        </div>

        {/* Account Logout */}
        <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <button
            type="button"
            onClick={async () => {
              if (window.confirm('Are you sure you want to log out of RentPilot?')) {
                localStorage.removeItem('rentpilot_guest_mode');
                await supabase.auth.signOut();
                window.location.reload();
              }
            }}
            className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 border border-rose-200/60"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </main>
    </div>
  );
}
