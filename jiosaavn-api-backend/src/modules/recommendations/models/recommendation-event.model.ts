import { z } from 'zod'

export const RecommendationTrackModel = z.object({
  title: z.string().trim().max(250).optional(),
  artist: z.string().trim().max(250).optional(),
  language: z.string().trim().max(64).optional(),
  genres: z.array(z.string().trim().max(64)).max(20).optional()
})

export const RecommendationEventModel = z.object({
  eventId: z.string().trim().min(1).max(128),
  type: z.enum([
    'track_started',
    'meaningful_progress',
    'track_completed',
    'track_skipped',
    'track_replayed',
    'track_liked',
    'track_unliked',
    'track_disliked',
    'track_undisliked',
    'recommendation_selected'
  ]),
  trackId: z.string().trim().min(1).max(128),
  track: RecommendationTrackModel.optional(),
  progressSeconds: z.number().finite().min(0).max(86400).optional(),
  durationSeconds: z.number().finite().min(0).max(86400).optional(),
  occurredAt: z.string().datetime({ offset: true })
})

export const RecommendationEventsBatchModel = z.object({
  events: z.array(RecommendationEventModel).max(50)
})

export type RecommendationEvent = z.infer<typeof RecommendationEventModel>
