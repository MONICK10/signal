export function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Coarse distance bands for anyone who isn't a mutual friend — never the
// precise figure, so the label can't be used to narrow down a fuzzed position.
const DISTANCE_BUCKETS = [
  { max: 0.15, label: 'Nearby' },
  { max: 0.3,  label: '~200m' },
  { max: 0.5,  label: '~400m' },
  { max: 0.75, label: '~600m' },
  { max: 1,    label: '~800m' },
  { max: 2,    label: '~1.5km' },
  { max: 3,    label: '~2.5km' },
  { max: 5,    label: '~4km' },
];

export function fuzzyDistance(km) {
  const bucket = DISTANCE_BUCKETS.find((b) => km <= b.max);
  return bucket ? bucket.label : '5km+';
}
