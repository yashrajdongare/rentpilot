
import React, { useState } from 'react';
import { Building, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function InitialSetup({ onComplete }) {
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !formData.name.trim() ||
      !formData.businessName.trim() ||
      !formData.phone.trim()
    ) {
      setError('Please complete all required fields.');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const profileData = {
        id: user.id,
        full_name: formData.name.trim(),
        business_name: formData.businessName.trim(),
        phone: formData.phone.trim(),
      };

      const { error: saveError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (saveError) throw saveError;

      const savedProfile = {
        name: profileData.full_name,
        businessName: profileData.business_name,
        phone: profileData.phone,
      };

      localStorage.setItem(
        'landlordProfile',
        JSON.stringify(savedProfile)
      );

      onComplete(savedProfile);
    } catch (err) {
      setError(err.message || 'Unable to save your profile.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-3 bg-white/80 dark:bg-white/5 border border-white/90 dark:border-white/10 rounded-[16px] text-xs font-bold text-ink dark:text-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in motion-reduce:animate-none">
      <div className="glass-panel-strong dark:bg-[#1a2244]/80 border border-white/80 dark:border-white/10 max-w-md w-full rounded-card p-6 sm:p-7 shadow-glass my-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-tile bg-gradient-to-tr from-primary to-primary2 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary/25">
            <Building className="w-5 h-5 stroke-[2]" />
          </div>

          <h2 className="text-xl font-extrabold text-ink dark:text-white tracking-tight">
            Welcome to RentPilot
          </h2>

          <p className="text-xs text-muted dark:text-muted/80 mt-1">
            Set up your landlord profile to get started
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 text-xs font-semibold"
        >
          <div>
            <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1.5">
              Your Full Name *
            </label>
            <input
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. John Doe"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1.5">
              Property / Business Name *
            </label>
            <input
              type="text"
              required
              autoComplete="organization"
              placeholder="e.g. Skyline Heights / Doe Properties"
              value={formData.businessName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  businessName: e.target.value,
                })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1.5">
              WhatsApp Mobile Number *
            </label>
            <input
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="10-digit mobile number"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className={inputClass}
            />
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-tile bg-rose/10 border border-rose/20 text-rose text-xs font-medium break-words">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-primary to-primary2 hover:opacity-95 disabled:opacity-60 text-white font-bold rounded-btn flex items-center justify-center gap-2 shadow-md shadow-primary/25 active:scale-95 transition-all mt-2 text-xs"
          >
            <span>{loading ? 'Saving Profile...' : 'Start Managing'}</span>
            {!loading && <ArrowRight className="w-4 h-4 stroke-[2]" />}
          </button>
        </form>
      </div>
    </div>
  );
}
