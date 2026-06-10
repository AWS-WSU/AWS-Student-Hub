import axios from 'axios';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.get('/discord-invite', async (_req, res): Promise<void> => {
  try {
    const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID } = process.env;

    if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
      console.error('missing discord configuration.');
      res.status(500).json({ error: 'Discord integration not configured' });
      return;
    }

    console.log('creating discord invite for channel.', DISCORD_CHANNEL_ID);

    const response = await axios.post(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/invites`,
      {
        max_age: 0,
        max_uses: 0,
        temporary: false,
        unique: true,
      },
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const invite = response.data as { code: string };
    console.log('discord invite generated successfully.', invite.code);
    res.json({
      inviteUrl: `https://discord.gg/${invite.code}`,
      success: true,
    });
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const data = axios.isAxiosError(error) ? error.response?.data : undefined;
    const message = axios.isAxiosError(error)
      ? ((error.response?.data as { message?: string } | undefined)?.message ?? error.message)
      : error instanceof Error
        ? error.message
        : 'Discord API error';

    console.error('error generating discord invite.', data || message);

    if (status === 403) {
      console.error('bot lacks permissions to create invites in the channel.');
    } else if (status === 404) {
      console.error('channel not found or bot not in server.');
    }

    res.status(500).json({
      error: 'Failed to generate invite',
      message,
      success: false,
    });
  }
});

export default router;
