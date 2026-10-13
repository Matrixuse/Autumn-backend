import { z } from 'zod'

export const UserModel = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  avatar: z.string().optional(),
  createdAt: z.string().datetime()
})

export type User = z.infer<typeof UserModel>