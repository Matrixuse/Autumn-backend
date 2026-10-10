import { useEffect, useState } from 'react'

export const useDailyRotationDate = () => {
  const [rotationDate, setRotationDate] = useState(() => new Date())

  useEffect(() => {
    let timeoutId
    const scheduleNextDay = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timeoutId = window.setTimeout(() => {
        setRotationDate(new Date())
        scheduleNextDay()
      }, nextMidnight.getTime() - now.getTime() + 25)
    }

    scheduleNextDay()
    return () => window.clearTimeout(timeoutId)
  }, [])

  return rotationDate
}
