
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

  const switchMode = (mode) => {
    setIsSignup(mode);
    setError('');
    setMessage('');
  };

  const inputClass =
    'w-full py-2.5 bg-transparent text-xs font-bold text-ink dark:text-white placeholder:text-muted/50 focus:outline-none';

  const fieldClass =
    'flex items-center gap-2.5 px-3.5 bg-white/80 dark:bg-white/10 border border-white/90 dark:border-white/15 rounded-[16px] focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50 transition-all';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass-panel-strong dark:bg-[#121838]/90 border border-white/90 dark:border-white/20 max-w-md w-full rounded-card p-6 sm:p-7 shadow-glass-lg my-auto animate-in fade-in motion-reduce:animate-none">

        {/* Brand Icon & Heading */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-tile bg-gradient-to-tr from-primary to-primary2 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary/25">
            <LockKeyhole className="w-5 h-5 stroke-[2]" />
          </div>

          <h2 className="text-xl font-extrabold text-ink dark:text-white tracking-tight">
            RentPilot
          </h2>

          <p className="text-xs text-muted dark:text-muted/80 mt-1">
            {isSignup
              ? 'Create your landlord account to get started'
              : 'Log in to manage your properties and rent'}
          </p>
        </div>

        {/* Segmented Sign Up / Log In Toggle */}
        <div className="grid grid-cols-2 p-1 bg-white/60 dark:bg-white/5 border border-white/80 dark:border-white/10 rounded-tile mb-5">
          <button
            type="button"
            onClick={() => switchMode(true)}
            className={`py-2 text-xs font-bold rounded-[14px] transition-all duration-200 ${isSignup
                ? 'bg-white dark:bg-white/15 text-primary dark:text-white shadow-sm'
                : 'text-muted dark:text-muted/70 hover:text-ink dark:hover:text-white'
              }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => switchMode(false)}
            className={`py-2 text-xs font-bold rounded-[14px] transition-all duration-200 ${!isSignup
                ? 'bg-white dark:bg-white/15 text-primary dark:text-white shadow-sm'
                : 'text-muted dark:text-muted/70 hover:text-ink dark:hover:text-white'
              }`}
          >
            Log In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-semibold">
          {isSignup && (
            <>
              <div>
                <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1">Full Name</label>
                <div className={fieldClass}>
                  <User className="w-4 h-4 text-muted shrink-0 stroke-[2]" />
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
                <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1">Business / Property Name</label>
                <div className={fieldClass}>
                  <Building2 className="w-4 h-4 text-muted shrink-0 stroke-[2]" />
                  <input
                    type="text"
                    required
                    autoComplete="organization"
                    placeholder="e.g. Skyline Heights"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1">Phone Number</label>
                <div className={fieldClass}>
                  <Phone className="w-4 h-4 text-muted shrink-0 stroke-[2]" />
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1">Email Address</label>
            <div className={fieldClass}>
              <Mail className="w-4 h-4 text-muted shrink-0 stroke-[2]" />
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
            <label className="block text-ink dark:text-white/80 text-xs font-bold mb-1">Password</label>
            <div className={fieldClass}>
              <LockKeyhole className="w-4 h-4 text-muted shrink-0 stroke-[2]" />
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
            <div role="alert" className="p-3 rounded-tile bg-rose/10 border border-rose/20 text-rose text-xs font-medium break-words">
              {error}
            </div>
          )}

          {message && (
            <div role="status" className="p-3 rounded-tile bg-teal/10 border border-teal/20 text-teal text-xs font-medium break-words">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-primary to-primary2 hover:opacity-95 disabled:opacity-60 text-white font-bold rounded-btn flex items-center justify-center gap-2 shadow-md shadow-primary/25 active:scale-95 transition-all mt-2"
          >
            <span>
              {loading
                ? 'Please wait...'
                : isSignup
                  ? 'Create Account'
                  : 'Log In'}
            </span>
            {!loading && <ArrowRight className="w-4 h-4 stroke-[2]" />}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/60 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white/80 dark:bg-[#1a2244] px-2.5 py-0.5 rounded-full font-bold text-muted border border-white/60 dark:border-white/10">
                Or explore without sign in
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3 bg-white/70 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 text-ink dark:text-white font-bold rounded-btn flex items-center justify-center gap-2 border border-white/80 dark:border-white/10 active:scale-95 transition-all text-xs"
          >
            <UserCheck className="w-4 h-4 text-primary shrink-0 stroke-[2]" />
            <span>Continue as Guest (Demo Mode)</span>
          </button>
        </form>
      </div>
    </div>
  );
}
