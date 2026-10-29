
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LockKeyhole, Mail, ArrowRight, User, Building2, Phone, UserCheck } from 'lucide-react';

export default function AuthScreen({ onGuestLogin }) {
  const [isSignup, setIsSignup] = useState(true);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: anonError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            full_name: 'Guest Landlord',
            business_name: 'Demo Workspace',
          },
        },
      });

      if (anonError) {
        if (onGuestLogin) {
          onGuestLogin();
          return;
        }
        throw anonError;
      }
    } catch {
      if (onGuestLogin) {
        onGuestLogin();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              business_name: businessName.trim(),
              phone: phone.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        // If email confirmation is disabled, a session may be available immediately.
        // In that case, save the profile directly to the profiles table.
        if (data.session && data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert(
              {
                id: data.user.id,
                full_name: fullName.trim(),
                business_name: businessName.trim(),
                phone: phone.trim(),
              },
              { onConflict: 'id' }
            );

          if (profileError) {
            throw new Error(
              `Your account was created, but saving your profile failed: ${profileError.message}`
            );
          }

          setMessage('Account created successfully.');
        } else {
          // Supabase stores these details in user metadata until the user confirms
          // their email and logs in. App.jsx will save them to profiles afterward.
          setMessage(
            'Account created. Check your email to confirm your address, then log in.'
          );
          setIsSignup(false);
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) throw loginError;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setMessage('');
  };

  const inputClass =
    'w-full py-3 bg-transparent text-xs font-bold text-slate-900 focus:outline-none';

  const fieldClass =
    'flex items-center gap-2 px-3.5 bg-slate-50 border border-slate-200 rounded-xl';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white max-w-md w-full rounded-[32px] p-6 shadow-2xl border border-slate-100 my-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <LockKeyhole className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-black text-slate-900">
            Welcome to RentPilot
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            {isSignup
              ? 'Create your landlord account'
              : 'Log in to manage your properties'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          {isSignup && (
            <>
              <div>
                <label className="block text-slate-600 mb-1">Full Name</label>
                <div className={fieldClass}>
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Business Name</label>
                <div className={fieldClass}>
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    required
                    autoComplete="organization"
                    placeholder="Enter your business name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Phone Number</label>
                <div className={fieldClass}>
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-slate-600 mb-1">Email Address</label>
            <div className={fieldClass}>
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Password</label>
            <div className={fieldClass}>
              <LockKeyhole className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-red-600 text-xs break-words">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="text-emerald-700 text-xs break-words">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1e3a5f] hover:bg-[#162b47] disabled:opacity-60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition"
          >
            <span>
              {loading
                ? 'Please wait...'
                : isSignup
                  ? 'Create Account'
                  : 'Log In'}
            </span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 font-bold text-slate-400">Or explore without sign in</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-2 border border-slate-200 transition text-xs active:scale-95"
          >
            <UserCheck className="w-4 h-4 text-[#1e3a5f]" />
            <span>Continue as Guest (Demo Mode)</span>
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          {isSignup ? 'Already have an account?' : 'New to RentPilot?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="font-bold text-[#1e3a5f] hover:underline"
          >
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
