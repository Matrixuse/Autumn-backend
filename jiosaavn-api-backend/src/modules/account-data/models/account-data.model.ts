import { z } from 'zod'

const identifiedRecord = z.record(z.string(), z.unknown()).refine(
  (value) => {
    const id = value.id ?? value._id
    return (
      (typeof id === 'string' || typeof id === 'number') && String(id).trim().length > 0 && String(id).length <= 128
    )
  },
  { message: 'A record ID is required' }
)

export const AccountPreferencesModel = z
  .object({
    autoplay: z.boolean().optional(),
    gapless: z.boolean().optional(),
    dataSaving: z.boolean().optional()
  })
  .strict()

export const AccountDataPatchModel = z
  .object({
    listenHistory: z.array(identifiedRecord).max(500).optional(),
    userPlaylists: z.array(identifiedRecord).max(300).optional(),
    listenAgain: z.array(identifiedRecord).max(500).optional(),
    notInterested: z.array(z.string().trim().min(1).max(128)).max(5000).optional(),
    preferences: AccountPreferencesModel.optional(),
    searchHistory: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    feedback: z.array(identifiedRecord).max(100).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one account data field is required' })

export type AccountDataPatch = z.infer<typeof AccountDataPatchModel>
export type AccountRecord = z.infer<typeof identifiedRecord>

export const emptyAccountData = () => ({
  listenHistory: [] as AccountRecord[],
  userPlaylists: [] as AccountRecord[],
  listenAgain: [] as AccountRecord[],
  notInterested: [] as string[],
  preferences: { autoplay: true, gapless: false, dataSaving: false },
  searchHistory: [] as string[],
  feedback: [] as AccountRecord[]
})
