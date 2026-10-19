export const statusLabels = { pending: 'In afwachting', confirmed: 'Bevestigd', cancelled: 'Geannuleerd' } as const;
export type ReservationStatus = keyof typeof statusLabels;
export type StatusFilter = ReservationStatus | 'all';

export function reservationPersonalDetails(row: {
  name: string | null; phone: string | null; email: string | null; message: string | null; is_anonymized: number;
}) {
  if (row.is_anonymized) return { name: 'Geanonimiseerd', phone: null, email: null, message: null };
  return { name: row.name ?? 'Geanonimiseerd', phone: row.phone, email: row.email, message: row.message };
}

export function statusFilter(value: string | null): StatusFilter {
  return value === 'pending' || value === 'confirmed' || value === 'cancelled' ? value : 'all';
}

export function validTransition(expected: string, target: string): boolean {
  return (expected === 'pending' && (target === 'confirmed' || target === 'cancelled'))
    || (expected === 'confirmed' && target === 'cancelled');
}

export function validReservationId(id: string): boolean {
  return /^[1-9]\d{0,19}$/.test(id) && BigInt(id) <= 18446744073709551615n;
}
