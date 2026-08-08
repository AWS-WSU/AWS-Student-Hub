import './styles/SocialLinks.css';
import { discordAPI } from '../utils/api';

const SocialSection = () => {
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
      <p>Stay connected with the AWS Student Builder Group at Wayne State University</p>
      <div className="social-icons">
        <a
          className="social-icon"
          href="https://www.linkedin.com/company/aws-cloud-club-wayne-state-university/"
          target="_blank"
          rel="noreferrer"
          aria-label="AWS Student Builder Group on LinkedIn"
        >
          <img src="/linkedin.svg" alt="" />
        </a>
        <a
          className="social-icon"
          href="https://github.com/AWS-WSU"
          target="_blank"
          rel="noreferrer"
          aria-label="AWS Student Builder Group on GitHub"
        >
          <img src="/github.svg" alt="" />
        </a>
        <a
          className="social-icon"
          href="https://www.instagram.com/awscloudwsu/"
          target="_blank"
          rel="noreferrer"
          aria-label="AWS Student Builder Group on Instagram"
        >
          <img src="/instagram.svg" alt="" />
        </a>
        <a
          className="social-icon"
          href="https://www.youtube.com/@WSUAWSCloudClub"
          target="_blank"
          rel="noreferrer"
          aria-label="AWS Student Builder Group on YouTube"
        >
          <img src="/youtube.svg" alt="" />
        </a>
        <button
          type="button"
          className="social-icon"
          onClick={handleDiscordClick}
          aria-label="Join the AWS Student Builder Group Discord"
        >
          <img src="/discord.svg" alt="" />
        </button>
      </div>
    </section>
  );
};

export default SocialSection;
