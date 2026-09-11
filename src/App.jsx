import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import NotAuthorized from './pages/NotAuthorized';
import Dashboard from './pages/Dashboard';
import TenantList from './pages/TenantList';
import TenantCreate from './pages/TenantCreate';
import TenantDetail from './pages/TenantDetail';
import DivisionCreate from './pages/DivisionCreate';
import DivisionDetail from './pages/DivisionDetail';

export default function App() {
  // 'checking' | 'signed-out' | 'checking-admin' | 'not-admin' | 'admin'
  const [state, setState] = useState('checking');
  const [session, setSession] = useState(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      handleSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        handleSession(nextSession);
      }
    );

    async function handleSession(nextSession) {
      setSession(nextSession);
      if (!nextSession) {
        setState('signed-out');
        return;
      }
      setState('checking-admin');
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (!isMounted) return;
      if (error) {
        console.error('is_platform_admin check failed', error);
        setState('not-admin');
        return;
      }
      setState(data ? 'admin' : 'not-admin');
    }

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === 'checking' || state === 'checking-admin') {
    return <div className="boot-screen mono">Checking access…</div>;
  }

  if (state === 'signed-out') {
    return <Login />;
  }

  if (state === 'not-admin') {
    return <NotAuthorized email={session?.user?.email} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard email={session?.user?.email} />} />
        <Route
          path="/tenants"
          element={<TenantList email={session?.user?.email} />}
        />
        <Route
          path="/tenants/new"
          element={<TenantCreate email={session?.user?.email} />}
        />
        <Route
          path="/tenants/:tenantId"
          element={<TenantDetail email={session?.user?.email} />}
        />
        <Route
          path="/tenants/:tenantId/divisions/new"
          element={<DivisionCreate email={session?.user?.email} />}
        />
        <Route
          path="/tenants/:tenantId/divisions/:divisionId"
          element={<DivisionDetail email={session?.user?.email} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
