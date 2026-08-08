import { discordAPI } from './api';

const FALLBACK_DISCORD_INVITE_URL = 'https://discord.gg/BX8nCQHU';

const isMobileDevice = (): boolean =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const openInvite = (inviteUrl: string): void => {
  if (isMobileDevice()) {
    window.location.href = inviteUrl.replace(
      'https://discord.gg/',
      'discord://discord.com/invite/'
    );

    window.setTimeout(() => {
      window.open(inviteUrl, '_blank', 'noopener,noreferrer');
    }, 1500);
    return;
  }

  window.open(inviteUrl, '_blank', 'noopener,noreferrer');
};

export const openDiscordInvite = async (): Promise<void> => {
  try {
    const invite = await discordAPI.getInvite();
    openInvite(invite.inviteUrl || invite.invite_url || FALLBACK_DISCORD_INVITE_URL);
  } catch (error) {
    console.error('failed to fetch a fresh Discord invite.', error);
    openInvite(FALLBACK_DISCORD_INVITE_URL);
  }
};

export const fallbackDiscordInviteUrl = FALLBACK_DISCORD_INVITE_URL;
