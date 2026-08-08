import { motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, BadgeCheck, BookOpen, CloudUpload, Link2 } from 'lucide-react';
import SocialLinks from '../components/SocialLinks';
import { fallbackDiscordInviteUrl, openDiscordInvite } from '../utils/discordInvite';
import '../pages/styles/Landing.css';

function Resources() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDiscordResourceClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void openDiscordInvite();
  };

  return (
    <div className="landing-container">
      <section id="resources" className="resources-section">
        <div className="section-header">
          <h2>Group Resources</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">
              <Link2 size={20} />
            </div>
            <span></span>
          </div>
        </div>

        <div className="resources-container">
          <motion.div
            className="resource-card"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <CloudUpload size={22} aria-hidden="true" />
            </div>
            <h3>AWS Free Tier Access</h3>
            <p>Ask the group about AWS student access and recommended learning paths.</p>
            <a
              href={fallbackDiscordInviteUrl}
              className="resource-link"
              target="_blank"
              rel="noreferrer"
              onClick={handleDiscordResourceClick}
            >
              Ask on Discord <ArrowRight size={15} aria-hidden="true" />
            </a>
          </motion.div>

          <motion.div
            className="resource-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <BadgeCheck size={22} aria-hidden="true" />
            </div>
            <h3>Certification Vouchers</h3>
            <p>Ask the group about current certification opportunities and eligibility.</p>
            <a
              href={fallbackDiscordInviteUrl}
              className="resource-link"
              target="_blank"
              rel="noreferrer"
              onClick={handleDiscordResourceClick}
            >
              Ask on Discord <ArrowRight size={15} aria-hidden="true" />
            </a>
          </motion.div>

          <motion.div
            className="resource-card"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <BookOpen size={22} aria-hidden="true" />
            </div>
            <h3>Learning Materials</h3>
            <p>Open the challenge handbook for classroom setup, authoring, and operations.</p>
            <a href="/docs/" className="resource-link">
              Open Handbook <ArrowRight size={15} aria-hidden="true" />
            </a>
          </motion.div>
        </div>

        <motion.div
          className="testimonials-container"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <h3>What Our Members Say</h3>
          <div className="testimonials-slider">
            <div className="testimonial">
              <p>
                Being on the board for the AWS Student Builder Group really pushed me out of my
                comfort zone. As a finance major, I wasn't fluent in technology terms at first but
                organizing events helped me pick up so many concepts I wouldn't have learned in the
                classroom. It gave me the confidence to navigate technical conversations, which I
                rely on now in my role at Deloitte, where I work closely with AWS in technology risk
                advisory practice.
              </p>
              <div className="testimonial-author">
                <img src="/mahdyya.jpeg" alt="Jane Doe" />
                <div>
                  <strong>Mahdyya Chowdury</strong>
                  <span>Finance, '25</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <SocialLinks />

      <section className="cta-section">
        <motion.div
          className="cta-card"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2>{user ? 'Welcome back!' : 'Ready to start your cloud journey?'}</h2>
          <p>
            {user
              ? 'Check out upcoming events and stay connected with the community.'
              : 'Join our community today and get access to workshops, networking events, and resources to accelerate your career.'}
          </p>
          <button
            className="join-button pulse-animation"
            onClick={() => navigate(user ? '/events' : '/auth?mode=signup')}
          >
            {user ? 'View Events' : 'Join the Group'}
          </button>
        </motion.div>
      </section>
    </div>
  );
}

export default Resources;
