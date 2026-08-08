import './styles/SocialLinks.css';
import { openDiscordInvite } from '../utils/discordInvite';

const SocialSection = () => {
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
          href="https://www.instagram.com/aws_sbg_wsu/"
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
          onClick={() => void openDiscordInvite()}
          aria-label="Join the AWS Student Builder Group Discord"
        >
          <img src="/discord.svg" alt="" />
        </button>
      </div>
    </section>
  );
};

export default SocialSection;
