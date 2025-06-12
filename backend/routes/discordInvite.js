const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

router.get('/discord-invite', async (req, res) => {
  try {
    const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID } = process.env;

    if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
      console.error('Missing Discord configuration');
      return res.status(500).json({ error: 'Discord integration not configured' });
    }

    const response = await axios.post(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/invites`,
      {
        max_age: 0,
        max_uses: 0,
        temporary: false,
        unique: true
      },
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const invite = response.data;
    console.log('Discord invite generated successfully');
    return res.json({ inviteUrl: `https://discord.gg/${invite.code}` });
  } catch (error) {
    console.error('Error generating Discord invite:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Failed to generate invite',
      message: error.response?.data?.message || 'Discord API error'
    });
  }
});

module.exports = router;
