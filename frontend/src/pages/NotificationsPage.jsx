import { useState } from 'react'
import { CalendarDays, CheckCheck, Music4, Sparkles } from 'lucide-react'

const badgeStyles = {
  1: 'bg-transparent',
  4: 'bg-transparent',
  8: 'bg-transparent',
  10: 'bg-transparent',
  12: 'bg-transparent',
  2: 'bg-red-900 border-[#f9d976]/50 shadow-[0_0_0_1px_rgba(249,217,118,0.4)]',
  3: 'bg-blue-900 border-[#9ad0ff]/50 shadow-[0_0_0_1px_rgba(154,208,255,0.4)]',
  5: 'bg-green-900 border-[#f7a7a6]/50 shadow-[0_0_0_1px_rgba(247,167,166,0.4)]',
  6: 'bg-purple-900 border-[#c9b6ff]/50 shadow-[0_0_0_1px_rgba(201,182,255,0.4)]',
  7: 'bg-teal-900 border-[#a7e8d8]/50 shadow-[0_0_0_1px_rgba(167,232,216,0.4)]',
  9: 'bg-orange-900 border-[#ffd4a8]/50 shadow-[0_0_0_1px_rgba(255,212,168,0.4)]',
  11: 'bg-pink-900 border-[#ffd6e7]/50 shadow-[0_0_0_1px_rgba(255,214,231,0.4)]',
}

const notifications = [
  {
    id: 1,
    type: 'new-release',
    title: 'New album drop',
    text: 'The new album by Arijit Singh is live. Start listening now.',
    time: '2 hours ago',
    unread: true,
    icon: Music4,
  },
  {
    id: 2,
    type: 'recommendation',
    title: 'Fresh for you',
    text: 'Based on your listening, we have 12 songs matched to your mood.',
    time: '5 hours ago',
    unread: true,
    icon: Sparkles,
  },
  {
    id: 3,
    type: 'reminder',
    title: 'Daily listening streak',
    text: 'You are 3 songs away from keeping your streak alive today.',
    time: 'Today',
    unread: false,
    icon: CalendarDays,
  },
  {
    id: 4,
    type: 'liked',
    title: 'Playlist update',
    text: 'Your “Late Night Mix” playlist was updated with 5 new tracks.',
    time: 'Yesterday',
    unread: false,
    icon: CheckCheck,
  },
  {
    id: 5,
    type: 'concert',
    title: 'Concert nearby',
    text: 'Diljit Dosanjh is performing in your city next month. Get your tickets now!',
    time: '2 days ago',
    unread: true,
    icon: Music4,
  },
  {
    id: 6,
    type: 'social',
    title: 'Friends activity',
    text: 'Rahul started listening to your public playlist “Chill Vibes”.',
    time: '3 days ago',
    unread: false,
    icon: Sparkles,
  },
  {
    id: 7,
    type: 'trending',
    title: 'Rising on the charts',
    text: '“Midnight Melodies” is trending at #1 in your country today.',
    time: '3 days ago',
    unread: true,
    icon: CalendarDays,
  },
  {
    id: 8,
    type: 'Wrapped',
    title: 'Your Month in Music',
    text: 'Your Monthly listening summary is ready! Check out your top artist.',
    time: '5 days ago',
    unread: false,
    icon: CheckCheck,
  },
  {
    id: 9,
    type: 'new-release',
    title: 'New album drop',
    text: 'The new album by Karan Aujla is live. Start listening now.',
    time: '7 days ago',
    unread: false,
    icon: Music4,
  },
  {
    id: 10,
    type: 'recommendation',
    title: 'New for you',
    text: 'For you, we have latest songs matched to your vibe.',
    time: '7 days ago',
    unread: false,
    icon: Sparkles,
  },
  {
    id: 11,
    type: 'artist-message',
    title: 'Artist shoutout',
    text: 'Karan Aujla just shared a message with her top fans.',
    time: '15 days ago',
    unread: false,
    icon: CalendarDays,
  },
  {
    id: 12,
    type: 'live-stream',
    title: 'Artist is Live',
    text: 'Anuv Jain just started a live audio listening party. Join the room now!',
    time: '2 weeks ago',
    unread: false,
    icon: CheckCheck,
  },
]

export default function NotificationsPage() {
  const [notificationItems, setNotificationItems] = useState(notifications)

  return (
    <div className="mx-auto w-full pb-10 pt-4 sm:px-6 lg:px-8">
      <div className="space-y-1">
        {notificationItems.map(({ id, title, text, time, unread, icon: Icon }) => {
          const useAppLogo = [1, 4, 8, 10, 12].includes(id)
          const badgeClass = badgeStyles[id] || 'bg-white/5 border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]'

          return (
            <button
              type="button"
              key={id}
              disabled={!unread}
              onClick={() => {
                setNotificationItems((currentItems) =>
                  currentItems.map((item) =>
                    item.id === id ? { ...item, unread: false } : item,
                  ),
                )
              }}
              className={`flex w-full items-start gap-2 rounded p-1 text-left shadow-lg transition hover:border-white/20 hover:bg-white/5 ${
                unread ? 'bg-white/7' : 'bg-transparent'
              }`}
            >
              <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border ${badgeClass}`}>
                {useAppLogo ? (
                  <img
                    src="/logo2.png"
                    alt="Autumn logo"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <Icon size={15} className="text-white" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-white/90"><b>{title}</b>: {text}</p>
                  <span className="text-xs text-white/45">{time}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
