import { createContext, useContext } from 'react';

// Who is signed in and what they may do. Set once by App after sign in.
//   isOperator   a ScoRack platform operator: everything, every venue
//   venues       otherwise, the venues this person belongs to, with their role
//                and the venue's status (active, suspended, blocked)
//   userId       the signed in person's id, to mark "you" in the team list
export const AccessContext = createContext({ isOperator: false, venues: [], userId: null });

export const useAccess = () => useContext(AccessContext);

// What the signed in person may do at one venue.
//   canView    can open it. A blocked venue can't be opened by its staff.
//   canChange  can change things. Only while the venue is active.
//   isOwner    can manage the team, which also needs the venue to be active.
export function useVenueAccess(tenantId) {
  const { isOperator, venues } = useAccess();
  if (isOperator) {
    return { known: true, isOperator: true, venue: null, status: null, role: 'operator', canView: true, canChange: true, isOwner: true };
  }
  const venue = venues.find((v) => v.tenant_id === tenantId);
  if (!venue) {
    return { known: false, isOperator: false, venue: null, status: null, role: null, canView: false, canChange: false, isOwner: false };
  }
  const active = venue.status === 'active';
  return {
    known: true,
    isOperator: false,
    venue,
    status: venue.status,
    role: venue.role,
    canView: venue.status !== 'blocked',
    canChange: active,
    isOwner: active && venue.role === 'owner',
  };
}
