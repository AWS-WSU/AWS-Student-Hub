import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

const iam = new AWS.IAM();
const s3 = new AWS.S3();
const CHALLENGE_BUCKET = process.env.AWS_CHALLENGE_BUCKET || 'wayne-aws-club-secrets-prod';

export interface ChallengeUserResult {
  access_key: string;
  secret_key: string;
  password: string;
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const generateRandomPassword = (length = 12): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

const createIAMPolicy = (username: string) => {
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

export const createChallengeUser = async (username: string): Promise<ChallengeUserResult> => {
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
    const createUserParams: AWS.IAM.CreateUserRequest = {
      UserName: iamUsername,
      Tags: [
        {
          Key: 'Purpose',
          Value: 'ChallengeParticipant',
        },
        {
          Key: 'CreatedBy',
          Value: 'StudentHubBackend',
        },
      ],
    };

    await iam.createUser(createUserParams).promise();
    console.log('✅ Step 1 complete: IAM user created');

    const policyDocument = JSON.stringify(createIAMPolicy(username));
    const policyName = `club_${username}_policy`;

    console.log(`Step 2: Creating IAM policy: ${policyName}`);
    const createPolicyParams: AWS.IAM.CreatePolicyRequest = {
      PolicyName: policyName,
      PolicyDocument: policyDocument,
      Description: `S3 read access policy for challenge participant ${username}`,
    };

    const createPolicyResult = await iam.createPolicy(createPolicyParams).promise();
    const policyArn = createPolicyResult.Policy?.Arn;

    if (!policyArn) {
      throw new Error('IAM policy ARN was not returned');
    }

    console.log('✅ Step 2 complete: IAM policy created');

    const attachPolicyParams: AWS.IAM.AttachUserPolicyRequest = {
      UserName: iamUsername,
      PolicyArn: policyArn,
    };

    console.log(`Step 3: Attaching policy to user: ${iamUsername}`);
    await iam.attachUserPolicy(attachPolicyParams).promise();
    console.log('✅ Step 3 complete: Policy attached to user');

    const createAccessKeyParams: AWS.IAM.CreateAccessKeyRequest = {
      UserName: iamUsername,
    };

    console.log(`Step 4: Creating access key for user: ${iamUsername}`);
    const createAccessKeyResult = await iam.createAccessKey(createAccessKeyParams).promise();
    const accessKey = createAccessKeyResult.AccessKey;

    if (!accessKey?.AccessKeyId || !accessKey.SecretAccessKey) {
      throw new Error('IAM access key was not returned');
    }

    console.log('✅ Step 4 complete: Access key created');

    const s3Key = `secrets/${username}.txt`;
    const s3Content = `next_password=${challengePassword}`;

    const s3Params: AWS.S3.PutObjectRequest = {
      Bucket: CHALLENGE_BUCKET,
      Key: s3Key,
      Body: s3Content,
      ContentType: 'text/plain',
    };

    console.log(`Step 5: Uploading secret file to S3: ${s3Key}`);
    await s3.putObject(s3Params).promise();
    console.log('✅ Step 5 complete: Secret file uploaded to S3');

    console.log(`Successfully created challenge user: ${username}`);

    return {
      access_key: accessKey.AccessKeyId,
      secret_key: accessKey.SecretAccessKey,
      password: challengePassword,
    };
  } catch (error: unknown) {
    console.error('Error creating challenge user:', error);

    try {
      console.log(`Attempting cleanup for failed user creation: ${username}`);
      const iamUsername = `club_${username}`;

      try {
        const listPoliciesResult = await iam
          .listAttachedUserPolicies({ UserName: iamUsername })
          .promise();
        for (const policy of listPoliciesResult.AttachedPolicies || []) {
          if (!policy.PolicyArn) continue;
          await iam
            .detachUserPolicy({ UserName: iamUsername, PolicyArn: policy.PolicyArn })
            .promise();
          if (policy.PolicyName?.startsWith(`club_${username}_policy`)) {
            await iam.deletePolicy({ PolicyArn: policy.PolicyArn }).promise();
          }
        }
      } catch (cleanupError: unknown) {
        console.error('Error during policy cleanup:', cleanupError);
      }

      try {
        const listAccessKeysResult = await iam.listAccessKeys({ UserName: iamUsername }).promise();
        for (const accessKey of listAccessKeysResult.AccessKeyMetadata || []) {
          if (!accessKey.AccessKeyId) continue;
          await iam
            .deleteAccessKey({ UserName: iamUsername, AccessKeyId: accessKey.AccessKeyId })
            .promise();
        }
      } catch (cleanupError: unknown) {
        console.error('Error during access key cleanup:', cleanupError);
      }

      try {
        await iam.deleteUser({ UserName: iamUsername }).promise();
      } catch (cleanupError: unknown) {
        console.error('Error during user cleanup:', cleanupError);
      }
    } catch (cleanupError: unknown) {
      console.error('Error during cleanup:', cleanupError);
    }

    throw new Error(`Failed to create challenge user: ${getErrorMessage(error)}`, { cause: error });
  }
};
