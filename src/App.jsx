
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
import InitialSetup from './components/InitialSetup';
import Logo from './components/Logo';
import {
  Home,
  Building2,
  Users,
  Receipt,
  Settings as SettingsIcon,
} from 'lucide-react';

function DesktopSidebar({ profile, isGuest, onExitGuest }) {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Properties', path: '/properties', icon: Building2 },
    { name: 'Tenants', path: '/tenants', icon: Users },
    { name: 'Receipts', path: '/receipts', icon: Receipt },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 min-h-screen flex-col justify-between p-4 sticky top-0 h-screen">
      <div>
        <div className="px-2 py-3 mb-4 border-b border-slate-100">
          <Logo size="md" showText={true} />
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#1e3a5f]/10 text-[#1e3a5f] shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-[#1e3a5f]' : 'text-slate-400'
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {isGuest && (
        <div className="p-2.5 my-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <span className="font-bold text-[11px]">Guest Mode</span>
          <button
            type="button"
            onClick={onExitGuest}
            className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition"
          >
            Sign In
          </button>
        </div>
      )}

      <div className="pt-4 border-t border-slate-100 flex items-center gap-3 px-2">
        <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-xs">
          {profile?.name ? profile.name.charAt(0).toUpperCase() : 'R'}
        </div>
        <div className="text-xs truncate">
          <p className="font-bold text-slate-800 truncate">
            {profile?.name || 'Owner'}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {profile?.businessName || 'Workspace'}
          </p>
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
    { name: 'Receipts', path: '/receipts', icon: Receipt },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 z-40 flex justify-around items-center py-2 px-2 shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
              isActive
                ? 'text-[#1e3a5f] font-bold'
                : 'text-slate-400 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-[#1e3a5f]/10 text-[#1e3a5f]'
                  : 'bg-transparent text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
            </div>
            <span className="text-[10px] mt-0.5">{item.name}</span>
          </Link>
        );
      })}
    </nav>
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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-sm font-bold text-slate-600">
        Loading RentPilot...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onGuestLogin={handleGuestLogin} />;
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
        <div className="max-w-md bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900">Unable to load profile</h2>
          <p className="text-sm text-red-600 mt-2">{profileError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 relative">
        {needsSetup && (
          <InitialSetup onComplete={handleSetupComplete} />
        )}

        <DesktopSidebar
          profile={profile}
          isGuest={isGuest}
          onExitGuest={handleExitGuest}
        />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard profile={profile} />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/properties/:id" element={<PropertyDetails />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/tenants/:id" element={<TenantDetails />} />
            <Route path="/receipts" element={<Receipts profile={profile} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <MobileBottomNav />
      </div>
    </Router>
  );
}
