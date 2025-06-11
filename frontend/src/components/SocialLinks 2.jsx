import "./styles/SocialLinks.css";
import SocialRedirectModal from "./SocialRedirectModal";
import DiscordInviteModalIcon from "./DiscordInviteModalIcon"; // This is your Discord modal

const SocialSection = () => {
  return (
    <section className="social-section">
      <h2>Follow Us</h2>
      <p>Stay connected with the AWS Cloud Club at Wayne State University</p>

      <div className="social-icons">
        {/* LinkedIn */}
        <SocialRedirectModal
          label="LinkedIn"
          icon="/linkedin.svg"
          url="https://www.linkedin.com/company/aws-cloud-club-wayne-state-university/"
        />

        {/* GitHub */}
        <SocialRedirectModal
          label="GitHub"
          icon="/github.svg"
          url="https://github.com/AWS-WSU"
        />

        {/* Instagram */}
        <SocialRedirectModal
          label="Instagram"
          icon="/instagram.svg"
          url="https://www.instagram.com/awscloudwsu/"
        />

        {/* Discord */}
        <DiscordInviteModalIcon />
      </div>
    </section>
  );
};

export default SocialSection;
