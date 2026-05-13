import { SocialRepository } from "./social-repository";

export class SystemMessageService {
  constructor(private readonly socialRepository: SocialRepository) {}

  async sendToProfile(profileId: string, message: string): Promise<void> {
    await this.socialRepository.appendSystemMessage({
      targetType: "profile",
      targetId: profileId,
      body: message,
      messageType: "system",
    });
  }

  async sendToChannel(channelId: string, message: string): Promise<void> {
    await this.socialRepository.appendSystemMessage({
      targetType: "channel",
      channelId,
      body: message,
      messageType: "system",
    });
  }

  async sendToAdmins(message: string): Promise<void> {
    await this.socialRepository.appendSystemMessage({
      targetType: "admins",
      body: message,
      messageType: "moderation",
    });
  }
}
