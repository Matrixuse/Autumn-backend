import { usePlayer } from '../context/PlayerContext'

export const useUpNextQueue = () => {
  const { currentTrack, queue, currentIndex, playTrack } = usePlayer()
  return { currentTrack, queue, currentIndex, playQueuedTrack: playTrack }
}