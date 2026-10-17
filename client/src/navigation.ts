// Google Maps turn-by-turn to one address (opens the Maps app on the phone).
export function navigationUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}
