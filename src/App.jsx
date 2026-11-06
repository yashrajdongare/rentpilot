import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import Tenants from './pages/Tenants';
import TenantDetails from './pages/TenantDetails';
import Receipts from './pages/Receipts';
import Settings from './pages/Settings';
import Pricing from './pages/Pricing';
import InitialSetup from './components/InitialSetup';
import Logo from './components/Logo';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import {
  Home,
  Building2,
  Users,
  ReceiptIndianRupee,
  Settings as SettingsIcon,
  Sun,
  Moon,
} from 'lucide-react';

function DesktopSidebar({ profile, isGuest, onExitGuest }) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Properties', path: '/properties', icon: Building2 },
    { name: 'Tenants', path: '/tenants', icon: Users },
    { name: 'Receipts', path: '/receipts', icon: ReceiptIndianRupee },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className="hidden md:flex w-60 lg:w-64 glass-nav border-r border-white/80 dark:border-white/10 min-h-screen flex-col justify-between p-4 sticky top-0 h-screen z-30 shrink-0 text-ink dark:text-white">
      <div>
        <div className="px-2 py-2.5 mb-6 border-b border-white/60 dark:border-white/10 flex items-center justify-between">
          <Logo size="md" showText={true} lightText={false} />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-xl glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition cursor-pointer active:scale-95"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber" /> : <Moon className="w-4 h-4 text-primary" />}
          </button>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-tile text-xs font-bold transition-all ${isActive
                  ? 'bg-gradient-to-r from-primary to-primary2 text-white shadow-lg shadow-primary/35 font-extrabold border border-white/40'
                  : 'text-muted dark:text-[#94a3b8] hover:bg-white/60 dark:hover:bg-white/10 hover:text-ink dark:hover:text-white'
                  }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isActive
                    ? 'bg-white/25 text-white'
                    : 'text-muted dark:text-[#94a3b8]'
                    }`}
                >
                  <Icon className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="text-xs font-extrabold">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-3 border-t border-white/60 dark:border-white/10">
        {isGuest && (
          <div className="p-3 bg-amber/15 border border-amber/30 rounded-tile text-xs text-amber dark:text-[#fbbf24] flex items-center justify-between">
            <div>
              <span className="font-extrabold text-[11px] block text-amber-900 dark:text-amber-300">Guest Mode</span>
              <span className="text-[10px] text-muted dark:text-[#94a3b8]">Preview only</span>
            </div>
            <button
              type="button"
              onClick={onExitGuest}
              className="text-[10px] font-black px-2.5 py-1 bg-amber hover:bg-amber/90 text-white rounded-btn transition shadow-xs active:scale-95 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

        <div className="flex items-center gap-2.5 px-1.5">
          <div className="w-8 h-8 rounded-tile bg-gradient-to-br from-primary to-primary2 text-white flex items-center justify-center font-black text-xs shadow-glass-sm shrink-0 border border-white/30">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'R'}
          </div>
          <div className="text-xs truncate flex-1 min-w-0">
            <p className="font-extrabold text-ink dark:text-white truncate">
              {profile?.name || 'Owner'}
            </p>
            <p className="text-[10px] text-muted dark:text-[#94a3b8] truncate">
              {profile?.businessName || 'Workspace'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const location = useLocation();

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Properties', path: '/properties', icon: Building2 },
    { name: 'Tenants', path: '/tenants', icon: Users },
    { name: 'Receipts', path: '/receipts', icon: ReceiptIndianRupee },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="md:hidden fixed bottom-3.5 left-3.5 right-3.5 max-w-[420px] mx-auto z-40 rounded-[28px] glass-nav px-2.5 py-1.5 flex justify-around items-center"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 relative ${isActive
              ? 'text-primary dark:text-[#a5b4fc] font-black scale-105'
              : 'text-muted dark:text-[#94a3b8] hover:text-ink dark:hover:text-white font-semibold'
              }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all duration-200 ${isActive
                ? 'bg-gradient-to-br from-primary to-primary2 text-white shadow-lg shadow-primary/40 border border-white/40'
                : 'bg-transparent text-muted dark:text-[#94a3b8]'
                }`}
            >
              <Icon className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black text-primary dark:text-[#a5b4fc]' : 'font-semibold text-muted dark:text-[#94a3b8]'}`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function LiquidBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none" aria-hidden="true">
      {/* Orb 1: Rich Electric Indigo/Purple in top-right */}
      <div className="liquid-orb-1 absolute -top-32 -right-24 w-[420px] h-[420px] md:w-[680px] md:h-[680px] rounded-full bg-gradient-to-br from-[#4353ff]/30 via-[#7058f4]/22 to-transparent dark:from-[#4353ff]/40 dark:via-[#7058f4]/30 blur-[105px]" />
      {/* Orb 2: Vibrant Aquamarine & Teal in left-middle */}
      <div className="liquid-orb-2 absolute top-1/3 -left-36 w-[380px] h-[380px] md:w-[600px] md:h-[600px] rounded-full bg-gradient-to-tr from-[#0ea5a0]/25 via-[#06b6d4]/18 to-transparent dark:from-[#0ea5a0]/35 dark:via-[#06b6d4]/25 blur-[105px]" />
      {/* Orb 3: Soft Violet / Coral glow in bottom-right */}
      <div className="liquid-orb-3 absolute -bottom-36 right-1/6 w-[400px] h-[400px] md:w-[640px] md:h-[640px] rounded-full bg-gradient-to-tl from-[#7058f4]/24 via-[#6366f1]/18 to-transparent dark:from-[#8b5cf6]/32 dark:via-[#6366f1]/22 blur-[115px]" />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('rentpilot_guest_mode') === 'true';
  });

  const handleGuestLogin = () => {
    localStorage.setItem('rentpilot_guest_mode', 'true');
    const guestUser = {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'guest@rentpilot.app',
      user_metadata: {
        full_name: 'Guest Landlord',
        business_name: 'Demo Workspace',
      },
    };
    const guestProf = {
      name: 'Guest Landlord',
      businessName: 'Demo Workspace',
      phone: '9876543210',
    };
    localStorage.setItem('landlordProfile', JSON.stringify(guestProf));
    setProfile(guestProf);
    setSession({ user: guestUser, isGuest: true });
    setIsGuest(true);
    setNeedsSetup(false);
  };

  const handleExitGuest = () => {
    localStorage.removeItem('rentpilot_guest_mode');
    setIsGuest(false);
    setSession(null);
    setProfile(null);
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async (user) => {
      setProfileError('');

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, business_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setProfileError(error.message);
        return;
      }

      if (data) {
        const savedProfile = {
          name: data.full_name || '',
          businessName: data.business_name || '',
          phone: data.phone || '',
        };

        localStorage.setItem(
          'landlordProfile',
          JSON.stringify(savedProfile)
        );

        setProfile(savedProfile);
        setNeedsSetup(false);
        return;
      }

      // No profile row exists yet. Check the details saved during sign-up.
      const metadata = user.user_metadata || {};

      const fullName = metadata.full_name || '';
      const businessName = metadata.business_name || '';
      const phone = metadata.phone || '';

      if (fullName && businessName && phone) {
        const { error: saveError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              full_name: fullName,
              business_name: businessName,
              phone: phone,
            },
            { onConflict: 'id' }
          );

        if (!active) return;

        if (saveError) {
          setProfileError(saveError.message);
          setProfile(null);
          setNeedsSetup(true);
          return;
        }

        const savedProfile = {
          name: fullName,
          businessName: businessName,
          phone: phone,
        };

        localStorage.setItem(
          'landlordProfile',
          JSON.stringify(savedProfile)
        );

        setProfile(savedProfile);
        setNeedsSetup(false);
      } else {
        // Existing accounts without profile details can complete setup.
        setProfile(null);
        setNeedsSetup(true);
      }
    };

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setProfileError(error.message);
        setCheckingSession(false);
        return;
      }

      const currentSession = data.session;
      setSession(currentSession);

      if (currentSession?.user) {
        await loadProfile(currentSession.user);
      } else if (localStorage.getItem('rentpilot_guest_mode') === 'true') {
        const guestUser = {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'guest@rentpilot.app',
          user_metadata: { full_name: 'Guest Landlord', business_name: 'Demo Workspace' },
        };
        const guestProf = {
          name: 'Guest Landlord',
          businessName: 'Demo Workspace',
          phone: '9876543210',
        };
        setSession({ user: guestUser, isGuest: true });
        setProfile(guestProf);
        setIsGuest(true);
        setNeedsSetup(false);
      }

      if (active) setCheckingSession(false);
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (!newSession) {
        setProfile(null);
        setNeedsSetup(false);
        setProfileError('');
        localStorage.removeItem('landlordProfile');
        setCheckingSession(false);
        return;
      }

      setCheckingSession(true);

      // Defer database work until after the auth callback finishes.
      setTimeout(() => {
        if (active) {
          loadProfile(newSession.user).finally(() => {
            if (active) setCheckingSession(false);
          });
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSetupComplete = (newProfile) => {
    setProfile(newProfile);
    setNeedsSetup(false);
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        {checkingSession ? (
          <div className="min-h-screen flex items-center justify-center app-blob-bg text-sm font-extrabold text-ink dark:text-white">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-card bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] flex items-center justify-center shadow-glass animate-pulse">
                <span className="text-white font-black text-lg">RP</span>
              </div>
              <p className="text-xs font-bold text-muted dark:text-[#98a3c4]">Loading RentPilot...</p>
            </div>
          </div>
        ) : !session ? (
          <AuthScreen onGuestLogin={handleGuestLogin} />
        ) : profileError ? (
          <div className="min-h-screen flex items-center justify-center app-blob-bg p-6">
            <div className="max-w-md w-full glass-panel-strong rounded-card p-6 border border-rose/30 shadow-glass">
              <h2 className="font-extrabold text-base text-ink dark:text-white">Unable to load profile</h2>
              <p className="text-xs text-rose mt-2 font-medium">{profileError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2.5 rounded-btn bg-gradient-to-r from-primary to-primary2 text-white text-xs font-bold active:scale-95 shadow-md shadow-primary/20"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <Router>
            <div className="min-h-screen app-blob-bg text-ink dark:text-[#eef1ff] flex flex-col md:flex-row relative">
              <LiquidBackground />

              {needsSetup && (
                <InitialSetup onComplete={handleSetupComplete} />
              )}

              {/* Desktop Glass Sidebar (Hidden on mobile, visible on tablet & desktop) */}
              <DesktopSidebar
                profile={profile}
                isGuest={isGuest}
                onExitGuest={handleExitGuest}
              />

              {/* Main Content Viewport: Full width responsive container */}
              <div className="flex-1 min-w-0 flex flex-col relative z-10">
                <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-5 md:p-6 lg:p-8 md:pb-8 pb-24">
                  <Routes>
                    <Route path="/" element={<Dashboard profile={profile} />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route path="/properties/:id" element={<PropertyDetails />} />
                    <Route path="/tenants" element={<Tenants />} />
                    <Route path="/tenants/:id" element={<TenantDetails />} />
                    <Route path="/receipts" element={<Receipts profile={profile} />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/pricing" element={<Pricing />} />
                  </Routes>
                </main>

                {/* Mobile Bottom Navigation (Hidden on tablet & desktop) */}
                <MobileBottomNav />
              </div>
            </div>
          </Router>
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}
