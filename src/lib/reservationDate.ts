const amsterdamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayInAmsterdam(now = new Date()): string {
  const parts = amsterdamDate.formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function reservationDateError(value: string, now = new Date()): string | undefined {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return 'Vul een geldige datum in (JJJJ-MM-DD).';
  }
  if (value < todayInAmsterdam(now)) return 'Kies vandaag of een toekomstige datum.';
  if (date.getUTCDay() === 1) return 'Turuncu is op maandag gesloten.';
  if (date.getUTCDay() === 0) return 'Turuncu is op zondag gesloten.';
}
