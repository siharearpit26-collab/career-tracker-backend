import { z } from 'zod';

export const connectEmailSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().url('Invalid redirect URI'),
});

export const confirmClassificationSchema = z.object({
  isCorrect: z.boolean(),
  correctedClassification: z
    .enum(['recruitment', 'rejection', 'offer', 'interview', 'follow_up', 'unrelated'])
    .optional(),
  correctedApplicationId: z.string().optional(),
});

export type ConnectEmailInput = z.infer<typeof connectEmailSchema>;
export type ConfirmClassificationInput = z.infer<typeof confirmClassificationSchema>;
