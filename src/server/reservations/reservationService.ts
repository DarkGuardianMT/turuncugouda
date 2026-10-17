import { getDatabasePool } from '../db/pool';
import type { ResultSetHeader } from 'mysql2/promise';
import type { ReservationData } from './types';

export async function createReservation(input: ReservationData) {
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    `INSERT INTO reservations
      (name, email, phone, reservation_date, reservation_time, guest_count, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [input.name, input.email, input.phone, input.reservationDate,
      input.reservationTime, input.guestCount, input.message],
  );

  return { id: result.insertId, status: 'pending' as const };
}
