const {
  IAMClient,
  CreateUserCommand,
  CreatePolicyCommand,
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  ListAttachedUserPoliciesCommand,
  DetachUserPolicyCommand,
  DeletePolicyCommand,
  ListAccessKeysCommand,
  DeleteAccessKeyCommand,
  DeleteUserCommand,
} = require('@aws-sdk/client-iam');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const iamClient = new IAMClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const generateRandomPassword = (length = 12) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

const CHALLENGE_BUCKET = process.env.AWS_CHALLENGE_BUCKET || 'wayne-aws-club-secrets-prod';

const createIAMPolicy = (username) => {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${CHALLENGE_BUCKET}/secrets/${username}.txt`,
      },
    ],
  };
};

const createChallengeUser = async (username) => {
  try {
    console.log(`Creating challenge user for: ${username}`);
    console.log('AWS Config check:', {
      hasAdminAccessKey: !!process.env.AWS_ADMIN_ACCESS_KEY_ID,
      hasAdminSecretKey: !!process.env.AWS_ADMIN_SECRET_ACCESS_KEY,
      region: process.env.CUSTOM_AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_S3_BUCKET,
    });

    const iamUsername = `club_${username}`;
    const challengePassword = generateRandomPassword(12);

    console.log(`Step 1: Creating IAM user: ${iamUsername}`);
    await iamClient.send(
      new CreateUserCommand({
        UserName: iamUsername,
        Tags: [
          { Key: 'Purpose', Value: 'ChallengeParticipant' },
          { Key: 'CreatedBy', Value: 'StudentHubBackend' },
        ],
      })
    );
    console.log(`✅ Step 1 complete: IAM user created`);

    const policyDocument = JSON.stringify(createIAMPolicy(username));
    const policyName = `club_${username}_policy`;

    console.log(`Step 2: Creating IAM policy: ${policyName}`);
    const createPolicyResult = await iamClient.send(
      new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: policyDocument,
        Description: `S3 read access policy for challenge participant ${username}`,
      })
    );
    console.log(`✅ Step 2 complete: IAM policy created`);

    console.log(`Step 3: Attaching policy to user: ${iamUsername}`);
    await iamClient.send(
      new AttachUserPolicyCommand({
        UserName: iamUsername,
        PolicyArn: createPolicyResult.Policy.Arn,
      })
    );
    console.log(`✅ Step 3 complete: Policy attached to user`);

    console.log(`Step 4: Creating access key for user: ${iamUsername}`);
    const createAccessKeyResult = await iamClient.send(
      new CreateAccessKeyCommand({ UserName: iamUsername })
    );
    console.log(`✅ Step 4 complete: Access key created`);

    const s3Key = `secrets/${username}.txt`;
    const s3Content = `next_password=${challengePassword}`;

    console.log(`Step 5: Uploading secret file to S3: ${s3Key}`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: CHALLENGE_BUCKET,
        Key: s3Key,
        Body: s3Content,
        ContentType: 'text/plain',
      })
    );
    console.log(`✅ Step 5 complete: Secret file uploaded to S3`);

    console.log(`Successfully created challenge user: ${username}`);

    return {
      access_key: createAccessKeyResult.AccessKey.AccessKeyId,
      secret_key: createAccessKeyResult.AccessKey.SecretAccessKey,
      password: challengePassword,
    };
  } catch (error) {
    console.error('Error creating challenge user:', error);

    try {
      console.log(`Attempting cleanup for failed user creation: ${username}`);
      const iamUsername = `club_${username}`;

      try {
        const listPoliciesResult = await iamClient.send(
          new ListAttachedUserPoliciesCommand({ UserName: iamUsername })
        );
        for (const policy of listPoliciesResult.AttachedPolicies) {
          await iamClient.send(
            new DetachUserPolicyCommand({ UserName: iamUsername, PolicyArn: policy.PolicyArn })
          );
          if (policy.PolicyName.startsWith(`club_${username}_policy`)) {
            await iamClient.send(new DeletePolicyCommand({ PolicyArn: policy.PolicyArn }));
          }
        }
      } catch (cleanupError) {
        console.error('Error during policy cleanup:', cleanupError);
      }

      try {
        const listAccessKeysResult = await iamClient.send(
          new ListAccessKeysCommand({ UserName: iamUsername })
        );
        for (const accessKey of listAccessKeysResult.AccessKeyMetadata) {
          await iamClient.send(
            new DeleteAccessKeyCommand({
              UserName: iamUsername,
              AccessKeyId: accessKey.AccessKeyId,
            })
          );
        }
      } catch (cleanupError) {
        console.error('Error during access key cleanup:', cleanupError);
      }

      try {
        await iamClient.send(new DeleteUserCommand({ UserName: iamUsername }));
      } catch (cleanupError) {
        console.error('Error during user cleanup:', cleanupError);
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }

    throw new Error(`Failed to create challenge user: ${error.message}`, { cause: error });
  }
};

module.exports = {
  createChallengeUser,
};
