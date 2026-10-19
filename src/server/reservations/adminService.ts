import { getDatabasePool } from '../db/pool';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { todayInAmsterdam } from '../../lib/reservationDate';
import { validReservationId, validTransition, type ReservationStatus, type StatusFilter } from './adminLogic';

export interface AdminReservation extends RowDataPacket {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  reservation_date: string;
  reservation_time: string;
  guest_count: number;
  status: ReservationStatus;
  created_at: number;
}

export async function listReservations(status: StatusFilter, now = new Date()): Promise<AdminReservation[]> {
  const [rows] = await getDatabasePool().execute<AdminReservation[]>(
    `SELECT CAST(id AS CHAR) AS id, name, phone, email, message,
       DATE_FORMAT(reservation_date, '%Y-%m-%d') AS reservation_date,
       TIME_FORMAT(reservation_time, '%H:%i') AS reservation_time, guest_count, status,
       UNIX_TIMESTAMP(created_at) AS created_at
     FROM reservations
     WHERE reservation_date >= ? AND (? = 'all' OR status = ?)
     ORDER BY reservation_date ASC, reservation_time ASC, created_at ASC, id ASC`,
    [todayInAmsterdam(now), status, status],
  );
  return rows;
}

export async function updateReservationStatus(id: string, expected: string, target: string): Promise<boolean> {
  if (!validReservationId(id) || !validTransition(expected, target)) throw new Error('Invalid reservation status action');
  const [result] = await getDatabasePool().execute<ResultSetHeader>(
    'UPDATE reservations SET status = ? WHERE id = ? AND status = ?', [target, id, expected],
  );
  return result.affectedRows === 1;
}
