import { z } from "zod";

export const currentUserSchema = z.object({
  id: z.string(),
  openRouterUserId: z.string(),
});

export const currentUserResponseSchema = z.object({
  user: currentUserSchema,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
