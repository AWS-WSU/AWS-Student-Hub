import "./styles/SocialSection.css";
import { motion } from "framer-motion";

const socialLinks = [
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/company/aws-cloud-club-wayne-state-university/",
    icon: "/linkedin.svg",
  },
  {
    name: "GitHub",
    url: "https://github.com/AWS-WSU", 
    icon: "/github.svg" },
  {
    name: "Instagram",
    url: "https://www.instagram.com/awscloudwsu/",
    icon: "/instagram.svg",
  },
  { 
    name: "Discord", 
    url: "https://discord.gg/6B6BrxUu",
    icon: "/discord.svg" },
];

const SocialSection = () => {
  return (
    <section className="social-section">
      <h2>Follow Us</h2>
      <p>Stay connected with the AWS Cloud Club at Wayne State University</p>
      <div className="social-icons">
        {socialLinks.map((link) => (
          <motion.a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <img src={link.icon} alt={`${link.name} icon`} />
          </motion.a>
        ))}
      </div>
    </section>
  );
};

export default SocialSection;
