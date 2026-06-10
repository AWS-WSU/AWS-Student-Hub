import './styles/SocialLinks.css';
import { discordAPI } from '../utils/api';

const SocialSection = () => {
  const handleSocialClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  const handleDiscordClick = async () => {
    try {
      console.log('fetching fresh discord invite.');
      const data = await discordAPI.getInvite();
      console.log('discord api response.', data);

      let inviteUrl: string | null = null;
      if (data && data.inviteUrl) {
        inviteUrl = data.inviteUrl;
      } else if (data && data.invite_url) {
        inviteUrl = data.invite_url;
      } else {
        console.warn('no invite url returned from api, using fallback.');
        inviteUrl = 'https://discord.gg/BX8nCQHU';
      }

      // Handle mobile Discord links
      if (isMobile()) {
        const discordAppUrl = inviteUrl.replace(
          'https://discord.gg/',
          'discord://discord.com/invite/'
        );
        window.location.href = discordAppUrl;

        // Fallback to browser after delay if app doesn't open
        setTimeout(() => {
          window.open(inviteUrl, '_blank', 'noopener,noreferrer');
        }, 1500);
      } else {
        window.open(inviteUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('failed to fetch discord invite.', err);
      const error = err as Error & { response?: { data?: unknown } };
      console.error('error details.', error.message, error.response?.data);
      console.warn('using fallback discord invite.');

      const fallbackUrl = 'https://discord.gg/BX8nCQHU';
      if (isMobile()) {
        window.location.href = 'discord://discord.com/invite/BX8nCQHU';
        setTimeout(() => {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }, 1500);
      } else {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <section className="social-section">
      <h2>Follow Us</h2>
      <p>Stay connected with the AWS Cloud Club at Wayne State University</p>
      <div className="social-icons">
        <img
          src="/linkedin.svg"
          alt="LinkedIn"
          style={{ cursor: 'pointer', width: '40px', margin: '0 6px' }}
          onClick={() =>
            handleSocialClick(
              'https://www.linkedin.com/company/aws-cloud-club-wayne-state-university/'
            )
          }
        />
        <img
          src="/github.svg"
          alt="GitHub"
          style={{ cursor: 'pointer', width: '40px', margin: '0 6px' }}
          onClick={() => handleSocialClick('https://github.com/AWS-WSU')}
        />
        <img
          src="/instagram.svg"
          alt="Instagram"
          style={{ cursor: 'pointer', width: '40px', margin: '0 6px' }}
          onClick={() => handleSocialClick('https://www.instagram.com/awscloudwsu/')}
        />
        <img
          src="/discord.svg"
          alt="Join Discord"
          style={{ cursor: 'pointer', width: '40px', margin: '0 6px' }}
          onClick={handleDiscordClick}
        />
      </div>
    </section>
  );
};

export default SocialSection;
