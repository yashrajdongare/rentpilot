
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white max-w-md w-full rounded-[32px] p-6 shadow-2xl border border-slate-100">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-black text-slate-900">
            Welcome to RentPilot
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Set up your landlord profile to get started
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3.5 text-xs font-semibold"
        >
          <div>
            <label className="block text-slate-600 mb-1">
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          {error && (
            <p role="alert" className="text-red-600 text-xs break-words">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1e3a5f] hover:bg-[#162b47] disabled:opacity-60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition mt-2 text-xs"
          >
            <span>{loading ? 'Saving Profile...' : 'Start Managing'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
