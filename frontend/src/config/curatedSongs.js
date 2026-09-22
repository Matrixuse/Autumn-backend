// Replace placeholder IDs with verified JioSaavn song IDs for fixed home-section tracks.
export const HOLLYWOOD_CURATED_TRACKS = [
  { id: 'TODO-HEADLIGHTS-ID', title: 'Headlights', artist: 'Alok, Alan Walker' },
  { id: 'TODO-AS-IT-WAS-ID', title: 'As It Was', artist: 'Harry Styles' },
  { id: 'TODO-BAD-GUY-ID', title: 'Bad Guy', artist: 'Billie Eilish' },
  { id: 'TODO-SHAPE-OF-YOU-ID', title: 'Shape of You', artist: 'Ed Sheeran' }
]

export const VERIFIED_CURATED_IDS = (tracks) => tracks
  .map((track) => track.id)
  .filter((id) => id && !String(id).startsWith('TODO-'))
