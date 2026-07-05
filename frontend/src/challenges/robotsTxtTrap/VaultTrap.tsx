import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, FileSearch, LockKeyhole } from 'lucide-react';

import type { ThemeProps } from '../../types';
import './VaultTrap.css';

const ROBOTS_TRAP_FLAG = 'FLAG{robots_txt_is_a_map_not_a_lock}';

function VaultTrap({ theme: _theme }: ThemeProps) {
  return (
    <div className="vault-trap-container">
      <motion.section
        className="vault-trap-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Link to="/challenges" className="vault-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Challenges
        </Link>

        <div className="vault-icon-grid" aria-hidden="true">
          <div>
            <FileSearch size={28} />
          </div>
          <div>
            <LockKeyhole size={28} />
          </div>
        </div>

        <span className="vault-eyebrow">Vault index record</span>
        <h1>Directory listing found</h1>
        <p>
          This route was hidden from crawlers, not protected from readers. The flag below is the
          proof value for the robots.txt trap challenge.
        </p>

        <code className="vault-flag">{ROBOTS_TRAP_FLAG}</code>
      </motion.section>
    </div>
  );
}

export default VaultTrap;
