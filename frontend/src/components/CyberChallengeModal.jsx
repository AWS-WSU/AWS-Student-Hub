import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './styles/CyberChallengeModal.css';

function CyberChallengeModal({ isOpen, onClose, awsCredentials }) {
  const [copiedField, setCopiedField] = useState(null);

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  if (!isOpen || !awsCredentials) return null;

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
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cyber-modal-header">
            <div className="challenge-icon">🔐</div>
            <h2>Cyber Challenge #5 - AWS Access</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          
          <div className="cyber-modal-body">
            <div className="challenge-intro">
              <p>Welcome to the AWS Cloud Security Challenge! You've been granted unique AWS credentials to access your challenge resources.</p>
              <div className="warning-banner">
                <span className="warning-icon">⚠️</span>
                <strong>Important:</strong> These credentials are shown only once. Save them securely!
              </div>
            </div>

            <div className="credentials-section">
              <h3>Your AWS Credentials</h3>
              
              <div className="credential-field">
                <label>Access Key ID</label>
                <div className="credential-input-group">
                  <input 
                    type="text" 
                    value={awsCredentials.accessKeyId} 
                    readOnly 
                    className="credential-input"
                  />
                  <button 
                    className={`copy-button ${copiedField === 'accessKey' ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(awsCredentials.accessKeyId, 'accessKey')}
                  >
                    {copiedField === 'accessKey' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div className="credential-field">
                <label>Secret Access Key</label>
                <div className="credential-input-group">
                  <input 
                    type="password" 
                    value={awsCredentials.secretAccessKey} 
                    readOnly 
                    className="credential-input"
                  />
                  <button 
                    className={`copy-button ${copiedField === 'secretKey' ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(awsCredentials.secretAccessKey, 'secretKey')}
                  >
                    {copiedField === 'secretKey' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div className="credential-field">
                <label>AWS Region</label>
                <div className="credential-input-group">
                  <input 
                    type="text" 
                    value="us-east-1" 
                    readOnly 
                    className="credential-input"
                  />
                  <button 
                    className={`copy-button ${copiedField === 'region' ? 'copied' : ''}`}
                    onClick={() => copyToClipboard('us-east-1', 'region')}
                  >
                    {copiedField === 'region' ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </div>

            <div className="challenge-details">
              <h3>Challenge Instructions</h3>
              <div className="instruction-steps">
                <div className="step">
                  <span className="step-number">1</span>
                  <p>Configure your AWS CLI with the credentials above</p>
                </div>
                <div className="step">
                  <span className="step-number">2</span>
                  <p>Find your secret file in the S3 bucket: <code>wayneaws-club-secrets</code></p>
                </div>
                <div className="step">
                  <span className="step-number">3</span>
                  <p>Retrieve your next challenge password from the secret file</p>
                </div>
                <div className="step">
                  <span className="step-number">4</span>
                  <p>Use the password to unlock the next phase of the challenge</p>
                </div>
              </div>
            </div>

            <div className="aws-cli-example">
              <h4>AWS CLI Setup Example:</h4>
              <div className="code-block">
                <code>
                  aws configure set aws_access_key_id {awsCredentials.accessKeyId}<br/>
                  aws configure set aws_secret_access_key [YOUR_SECRET_KEY]<br/>
                  aws configure set default.region us-east-1
                </code>
              </div>
            </div>
          </div>

          <div className="cyber-modal-footer">
            <button className="primary-button" onClick={onClose}>
              Got it! Let's start the challenge
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CyberChallengeModal;
