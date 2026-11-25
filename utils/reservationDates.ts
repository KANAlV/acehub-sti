const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface ScheduleEntryReference {
  schedule_entry_id: string;
}

interface RescheduleReservationReference {
  type: string;
  description: string;
  day: string;
}

export function formatReservationDate(date: Date) {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isValidReservationDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day >= 1 && day <= daysInMonth[month - 1];
}

export function reservationDateMatches(value: string, date: Date) {
  const storedValue = value.trim();
  if (isValidReservationDate(storedValue)) {
    return storedValue === formatReservationDate(date);
  }

  return (
    storedValue.toLowerCase() === WEEKDAY_NAMES[date.getDay()].toLowerCase()
  );
}

export function getReservationsForDate<T extends { day: string }>(
  reservations: T[],
  date: Date,
) {
  return reservations.filter((reservation) =>
    reservationDateMatches(reservation.day, date),
  );
}

export function getRescheduledScheduleEntry<T extends ScheduleEntryReference>(
  reservation: Pick<RescheduleReservationReference, "type" | "description">,
  entries: T[],
) {
  if (reservation.type.trim().toLowerCase() !== "reschedule") return null;

  const scheduleEntryId = reservation.description.trim();
  return (
    entries.find((entry) => entry.schedule_entry_id === scheduleEntryId) ?? null
  );
}

function reservationMatchesWeek(value: string, date: Date) {
  const storedValue = value.trim();
  if (!isValidReservationDate(storedValue)) {
    return reservationDateMatches(storedValue, date);
  }

  const year = Number(storedValue.slice(0, 4));
  const month = Number(storedValue.slice(5, 7));
  const day = Number(storedValue.slice(8, 10));
  const reservationDate = new Date(year, month - 1, day);
  const reservationWeekStart = new Date(
    reservationDate.getFullYear(),
    reservationDate.getMonth(),
    reservationDate.getDate() - reservationDate.getDay(),
  );
  const targetWeekStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - date.getDay(),
  );

  return reservationWeekStart.getTime() === targetWeekStart.getTime();
}

export function isScheduleEntryRescheduledOnDate(
  scheduleEntryId: string,
  reservations: RescheduleReservationReference[],
  date: Date,
) {
  return reservations.some(
    (reservation) =>
      reservation.type.trim().toLowerCase() === "reschedule" &&
      reservation.description.trim() === scheduleEntryId &&
      reservationMatchesWeek(reservation.day, date),
  );
}
