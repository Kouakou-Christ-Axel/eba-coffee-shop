export function formatPickupTime(date: Date): string {
  const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const day = date.getDate();
  const monthName = date.toLocaleDateString('fr-FR', { month: 'long' });
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${capitalizedDay} ${day} ${monthName} · ${hours}h${minutes}`;
}
