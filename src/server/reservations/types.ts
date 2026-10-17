export interface ReservationData {
  name: string;
  phone: string;
  email: string | null;
  reservationDate: string;
  reservationTime: string;
  guestCount: number;
  message: string | null;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';
export type ReservationFieldErrors = Partial<Record<keyof ReservationData | '_form', string>>;

export type ReservationValidationResult =
  | { success: true; data: ReservationData }
  | { success: false; fields: ReservationFieldErrors };
