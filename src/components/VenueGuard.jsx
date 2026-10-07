import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useVenueAccess } from '../lib/access';

// Venue staff can open their own venues and nothing else. The database refuses
// the rest anyway, this just sends them somewhere sensible instead of showing
// an error.
export default function VenueGuard() {
  const { tenantId } = useParams();
  const access = useVenueAccess(tenantId);
  if (!access.known || !access.canView) return <Navigate to="/" replace />;
  return <Outlet />;
}
