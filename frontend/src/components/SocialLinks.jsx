import "./styles/SocialLinks.css";
import { discordAPI } from "../utils/api";

const SocialSection = () => {
  const handleSocialClick = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDiscordClick = async () => {
    try {
      console.log("Fetching fresh Discord invite...");
      const data = await discordAPI.getInvite();
      console.log("Discord API response:", data);

      if (data && data.inviteUrl) {
        console.log("Using fresh invite URL:", data.inviteUrl);
        window.open(data.inviteUrl, "_blank", "noopener,noreferrer");
      } else if (data && data.invite_url) {
        // Check for alternative property name
        console.log("Using fresh invite URL (alt property):", data.invite_url);
        window.open(data.invite_url, "_blank", "noopener,noreferrer");
      } else {
        console.warn("No invite URL returned from API, response:", data);
        console.warn("Using fallback Discord invite");
        window.open(
          "https://discord.gg/BX8nCQHU",
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (err) {
      console.error("Failed to fetch Discord invite:", err);
      console.error("Error details:", err.message, err.response?.data);
      console.warn("Using fallback Discord invite");
      window.open(
        "https://discord.gg/BX8nCQHU",
        "_blank",
        "noopener,noreferrer"
      );
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
          style={{ cursor: "pointer", width: "40px", margin: "0 6px" }}
          onClick={() =>
            handleSocialClick(
              "https://www.linkedin.com/company/aws-cloud-club-wayne-state-university/"
            )
          }
        />
        <img
          src="/github.svg"
          alt="GitHub"
          style={{ cursor: "pointer", width: "40px", margin: "0 6px" }}
          onClick={() => handleSocialClick("https://github.com/AWS-WSU")}
        />
        <img
          src="/instagram.svg"
          alt="Instagram"
          style={{ cursor: "pointer", width: "40px", margin: "0 6px" }}
          onClick={() =>
            handleSocialClick("https://www.instagram.com/awscloudwsu/")
          }
        />
        <img
          src="/discord.svg"
          alt="Join Discord"
          style={{ cursor: "pointer", width: "40px", margin: "0 6px" }}
          onClick={handleDiscordClick}
        />
      </div>
    </section>
  );
};

export default SocialSection;
