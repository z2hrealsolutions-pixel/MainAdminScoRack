import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AccessContext } from './lib/access';
import Login from './pages/Login';
import NotAuthorized from './pages/NotAuthorized';
import Dashboard from './pages/Dashboard';
import StaffHome from './pages/StaffHome';
import TenantList from './pages/TenantList';
import TenantCreate from './pages/TenantCreate';
import TenantDetail from './pages/TenantDetail';
import DivisionCreate from './pages/DivisionCreate';
import DivisionDetail from './pages/DivisionDetail';
import TeamCreate from './pages/TeamCreate';
import TeamDetail from './pages/TeamDetail';
import RosterImport from './pages/RosterImport';
import MatchupResult from './pages/MatchupResult';
import VenueGuard from './components/VenueGuard';

export default function App() {
  // 'checking' | 'signed-out' | 'checking-access' | 'no-access' | 'ready'
  const [state, setState] = useState('checking');
  const [session, setSession] = useState(null);
  const [access, setAccess] = useState({ isOperator: false, venues: [], userId: null });

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      handleSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession);
    });

    async function handleSession(nextSession) {
      setSession(nextSession);
      if (!nextSession) {
        setState('signed-out');
        return;
      }
      setState('checking-access');
      const userId = nextSession.user ? nextSession.user.id : null;

      // Anything the person was invited to becomes access now. A failure here
      // is not fatal, an operator can still sign in without it.
      await supabase.rpc('accept_my_invites');

      const admin = await supabase.rpc('is_platform_admin');
      if (!isMounted) return;
      if (admin.error) {
        console.error('is_platform_admin check failed', admin.error);
        setState('no-access');
        return;
      }
      if (admin.data) {
        setAccess({ isOperator: true, venues: [], userId });
        setState('ready');
        return;
      }

      const mine = await supabase.rpc('my_tenants');
      if (!isMounted) return;
      if (mine.error || !mine.data || mine.data.length === 0) {
        if (mine.error) console.error('my_tenants failed', mine.error);
        setState('no-access');
        return;
      }
      setAccess({ isOperator: false, venues: mine.data, userId });
      setState('ready');
    }

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === 'checking' || state === 'checking-access') {
    return <div className="boot-screen mono">Checking access…</div>;
  }

  if (state === 'signed-out') {
    return <Login />;
  }

  if (state === 'no-access') {
    return <NotAuthorized email={session?.user?.email} />;
  }

  const email = session?.user?.email;

  return (
    <AccessContext.Provider value={access}>
      <BrowserRouter>
        <Routes>
          {access.isOperator ? (
            <>
              <Route path="/" element={<Dashboard email={email} />} />
              <Route path="/tenants" element={<TenantList email={email} />} />
              <Route path="/tenants/new" element={<TenantCreate email={email} />} />
            </>
          ) : (
            <Route path="/" element={<StaffHome email={email} />} />
          )}

          <Route element={<VenueGuard />}>
            <Route path="/tenants/:tenantId" element={<TenantDetail email={email} />} />
            <Route path="/tenants/:tenantId/divisions/new" element={<DivisionCreate email={email} />} />
            <Route path="/tenants/:tenantId/divisions/:divisionId" element={<DivisionDetail email={email} />} />
            <Route path="/tenants/:tenantId/divisions/:divisionId/teams/new" element={<TeamCreate email={email} />} />
            <Route path="/tenants/:tenantId/divisions/:divisionId/teams/:teamId" element={<TeamDetail email={email} />} />
            <Route path="/tenants/:tenantId/divisions/:divisionId/import" element={<RosterImport email={email} />} />
            <Route
              path="/tenants/:tenantId/divisions/:divisionId/matchups/:matchupId"
              element={<MatchupResult email={email} />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AccessContext.Provider>
  );
}
