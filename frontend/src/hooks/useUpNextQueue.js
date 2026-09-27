import { usePlayer } from '../context/PlayerContext'

export const useUpNextQueue = () => {
  const { currentTrack, queue, currentIndex, playTrack, reorderQueue } = usePlayer()
  return { currentTrack, queue, currentIndex, playQueuedTrack: playTrack, reorderQueue }
}