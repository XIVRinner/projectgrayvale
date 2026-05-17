import { z } from "zod";

export const notificationDeliveryPolicySchema = z.union([
  z.literal("client-only"),
  z.literal("server-only"),
  z.literal("client-and-server")
]);

export const notificationChannelSchema = z.union([
  z.literal("toast"),
  z.literal("system-chat"),
  z.literal("silent")
]);

export const notificationAudienceSchema = z.union([
  z.literal("local"),
  z.literal("global")
]);

export const toastVariantSchema = z.union([
  z.literal("level-up"),
  z.literal("friend-request"),
  z.literal("guild-invite"),
  z.literal("skill-unlock"),
  z.literal("attribute-unlock"),
  z.literal("game-updated"),
  z.literal("achievement-earned")
]);

export const notificationPolicySchema = z
  .object({
    eventType: z.string().min(1),
    deliveryPolicy: notificationDeliveryPolicySchema,
    channels: z.array(notificationChannelSchema).min(1),
    audience: notificationAudienceSchema,
    toastVariant: toastVariantSchema.optional(),
    chatTemplate: z.string().min(1).optional(),
    serverFanout: z.boolean()
  })
  .strict();

export const notificationPolicyCatalogSchema = z.array(notificationPolicySchema);

export type NotificationDeliveryPolicy = z.infer<typeof notificationDeliveryPolicySchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;
export type NotificationPolicy = z.infer<typeof notificationPolicySchema>;
