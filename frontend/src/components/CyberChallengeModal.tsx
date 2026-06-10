import { useState } from 'react';
import type { MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, Lock, Terminal, X } from 'lucide-react';
import type { AwsCredentials } from '../types/auth';
import './styles/CyberChallengeModal.css';

type CopiedField = 'accessKey' | 'secretKey' | 'region';

interface CyberChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  awsCredentials: AwsCredentials | null;
}

function CyberChallengeModal({ isOpen, onClose, awsCredentials }: CyberChallengeModalProps) {
  const [copiedField, setCopiedField] = useState<CopiedField | null>(null);

  const copyToClipboard = async (text: string, field: CopiedField): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('failed to copy.', err);
    }
  };

  if (!isOpen || !awsCredentials) return null;

  const credentialFields: Array<{
    label: string;
    value: string;
    copyField: CopiedField;
    copyLabel: string;
    type?: 'text' | 'password';
  }> = [
    {
      label: 'Access key ID',
      value: awsCredentials.accessKeyId,
      copyField: 'accessKey',
      copyLabel: 'Copy access key ID',
    },
    {
      label: 'Secret access key',
      value: awsCredentials.secretAccessKey,
      copyField: 'secretKey',
      copyLabel: 'Copy secret access key',
      type: 'password',
    },
    {
      label: 'Region',
      value: 'us-east-1',
      copyField: 'region',
      copyLabel: 'Copy AWS region',
    },
  ];

  const cliCommands = [
    `aws configure set aws_access_key_id ${awsCredentials.accessKeyId}`,
    'aws configure set aws_secret_access_key [YOUR_SECRET_KEY]',
    'aws configure set default.region us-east-1',
  ].join('\n');

  return (
    <AnimatePresence>
      <motion.div
        className="cyber-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cyber-modal-content"
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        >
          <div className="cyber-modal-header">
            <div className="cyber-header-icon">
              <Lock size={26} aria-hidden="true" />
            </div>
            <div className="cyber-header-copy">
              <span>Challenge #5</span>
              <h2>AWS Access Challenge</h2>
              <p>Credentials and next steps for your assigned AWS lab workspace.</p>
            </div>
            <button className="cyber-close-button" onClick={onClose} aria-label="Close modal">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="cyber-modal-body">
            <section className="cyber-modal-card cyber-modal-credentials">
              <div className="cyber-section-heading">
                <h3>Credentials</h3>
                <p>Use these values only for this challenge workspace. Keep them private.</p>
              </div>

              <div className="cyber-credential-list">
                {credentialFields.map((field) => (
                  <div className="cyber-credential-field" key={field.copyField}>
                    <label>{field.label}</label>
                    <div className="cyber-credential-control">
                      <input
                        type={field.type ?? 'text'}
                        value={field.value}
                        readOnly
                        className="cyber-credential-input"
                      />
                      <button
                        className={`cyber-copy-button ${copiedField === field.copyField ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(field.value, field.copyField)}
                        aria-label={field.copyLabel}
                      >
                        {copiedField === field.copyField ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <Copy size={16} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="cyber-modal-card cyber-challenge-details">
              <div className="cyber-section-heading">
                <h3>Instructions</h3>
                <p>Configure AWS, locate your secret file, then use its value to continue.</p>
              </div>

              <ol className="cyber-instruction-steps">
                <li className="cyber-step">
                  <span className="cyber-step-number">1</span>
                  <p>Configure the AWS CLI with the credentials above.</p>
                </li>
                <li className="cyber-step">
                  <span className="cyber-step-number">2</span>
                  <p>
                    Open the S3 bucket <code>wayne-aws-club-secrets</code>.
                  </p>
                </li>
                <li className="cyber-step">
                  <span className="cyber-step-number">3</span>
                  <p>Find your assigned secret file and read its contents.</p>
                </li>
                <li className="cyber-step">
                  <span className="cyber-step-number">4</span>
                  <p>Use the recovered value to continue to the next challenge.</p>
                </li>
              </ol>
            </section>

            <section className="cyber-cli-example">
              <h4>
                <Terminal size={18} aria-hidden="true" /> AWS CLI setup
              </h4>
              <pre className="code-block">
                <code>{cliCommands}</code>
              </pre>
            </section>
          </div>

          <div className="cyber-modal-footer">
            <button className="cyber-primary-button" onClick={onClose}>
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CyberChallengeModal;
