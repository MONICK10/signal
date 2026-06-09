export function fuzzyLocation(lat, lng) {
  return {
    lat: Math.round(lat / 0.001) * 0.001,
    lng: Math.round(lng / 0.001) * 0.001,
  };
}
