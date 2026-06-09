import AWS from 'aws-sdk';
import chalk from 'chalk';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

AWS.config.update({
  accessKeyId: process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

const iam = new AWS.IAM();
const s3 = new AWS.S3();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const askQuestion = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

const displayWarning = (): void => {
  console.log('\n' + '='.repeat(80));
  console.log(chalk.red.bold('⚠️  DESTRUCTIVE OPERATION WARNING ⚠️'));
  console.log('='.repeat(80));
  console.log(chalk.yellow('This script will:'));
  console.log(chalk.yellow('• Delete ALL IAM users starting with "club_"'));
  console.log(chalk.yellow('• Delete ALL associated IAM policies'));
  console.log(chalk.yellow('• Delete ALL access keys for these users'));
  console.log(chalk.yellow('• Delete ALL secret files in S3 bucket "wayne-aws-club-secrets"'));
  console.log(chalk.yellow('• This action is IRREVERSIBLE'));
  console.log('\n' + chalk.red.bold('USE ONLY IN DEVELOPMENT ENVIRONMENT!'));
  console.log('='.repeat(80) + '\n');
};

const getClubUsers = async (): Promise<AWS.IAM.User[]> => {
  try {
    console.log(chalk.blue('🔍 Finding all club users...'));
    const users: AWS.IAM.User[] = [];
    let marker: string | undefined;

    do {
      const params: AWS.IAM.ListUsersRequest = {
        MaxItems: 100,
        ...(marker ? { Marker: marker } : {}),
      };

      const result = await iam.listUsers(params).promise();
      const clubUsers = (result.Users || []).filter((user) => user.UserName?.startsWith('club_'));
      users.push(...clubUsers);
      marker = result.Marker;
    } while (marker);

    console.log(chalk.green(`✅ Found ${users.length} club users`));
    return users;
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error fetching users:'), getErrorMessage(error));
    return [];
  }
};

const getS3SecretFiles = async (): Promise<AWS.S3.Object[]> => {
  try {
    console.log(chalk.blue('🔍 Finding all secret files in S3...'));
    const objects: AWS.S3.Object[] = [];
    let continuationToken: string | undefined;

    do {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: 'wayne-aws-club-secrets',
        Prefix: 'secrets/',
        MaxKeys: 1000,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      };

      const result = await s3.listObjectsV2(params).promise();
      objects.push(...(result.Contents || []));
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    console.log(chalk.green(`✅ Found ${objects.length} secret files`));
    return objects;
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error fetching S3 objects:'), getErrorMessage(error));
    return [];
  }
};

const deleteUser = async (username: string): Promise<boolean> => {
  try {
    console.log(chalk.yellow(`🗑️  Deleting user: ${username}`));

    try {
      const accessKeys = await iam.listAccessKeys({ UserName: username }).promise();
      for (const key of accessKeys.AccessKeyMetadata || []) {
        if (!key.AccessKeyId) continue;
        await iam
          .deleteAccessKey({
            UserName: username,
            AccessKeyId: key.AccessKeyId,
          })
          .promise();
        console.log(chalk.gray(`   🔑 Deleted access key: ${key.AccessKeyId}`));
      }
    } catch (error: unknown) {
      console.log(chalk.red(`   ❌ Error deleting access keys: ${getErrorMessage(error)}`));
    }

    try {
      const attachedPolicies = await iam.listAttachedUserPolicies({ UserName: username }).promise();
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        if (!policy.PolicyArn) continue;
        await iam
          .detachUserPolicy({
            UserName: username,
            PolicyArn: policy.PolicyArn,
          })
          .promise();
        console.log(chalk.gray(`   📋 Detached policy: ${policy.PolicyName || policy.PolicyArn}`));

        if (policy.PolicyName?.startsWith('club_')) {
          try {
            await iam.deletePolicy({ PolicyArn: policy.PolicyArn }).promise();
            console.log(chalk.gray(`   🗑️  Deleted policy: ${policy.PolicyName}`));
          } catch (deletePolicyError: unknown) {
            console.log(
              chalk.red(
                `   ❌ Error deleting policy ${policy.PolicyName}: ${getErrorMessage(deletePolicyError)}`
              )
            );
          }
        }
      }
    } catch (error: unknown) {
      console.log(chalk.red(`   ❌ Error handling policies: ${getErrorMessage(error)}`));
    }

    try {
      const inlinePolicies = await iam.listUserPolicies({ UserName: username }).promise();
      for (const policyName of inlinePolicies.PolicyNames || []) {
        await iam
          .deleteUserPolicy({
            UserName: username,
            PolicyName: policyName,
          })
          .promise();
        console.log(chalk.gray(`   📄 Deleted inline policy: ${policyName}`));
      }
    } catch (error: unknown) {
      console.log(chalk.red(`   ❌ Error deleting inline policies: ${getErrorMessage(error)}`));
    }

    try {
      const groups = await iam.listGroupsForUser({ UserName: username }).promise();
      for (const group of groups.Groups || []) {
        if (!group.GroupName) continue;
        await iam
          .removeUserFromGroup({
            UserName: username,
            GroupName: group.GroupName,
          })
          .promise();
        console.log(chalk.gray(`   👥 Removed from group: ${group.GroupName}`));
      }
    } catch (error: unknown) {
      console.log(chalk.red(`   ❌ Error removing from groups: ${getErrorMessage(error)}`));
    }

    await iam.deleteUser({ UserName: username }).promise();
    console.log(chalk.green('   ✅ User deleted successfully'));

    return true;
  } catch (error: unknown) {
    console.error(chalk.red(`   ❌ Error deleting user ${username}:`, getErrorMessage(error)));
    return false;
  }
};

const deleteS3Objects = async (objects: AWS.S3.Object[]): Promise<boolean> => {
  if (objects.length === 0) {
    console.log(chalk.gray('📁 No S3 objects to delete'));
    return true;
  }

  try {
    console.log(chalk.yellow(`🗑️  Deleting ${objects.length} S3 objects...`));

    const batchSize = 1000;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);
      const keys = batch.map((obj) => obj.Key).filter((key): key is string => Boolean(key));

      if (keys.length === 0) continue;

      const deleteParams: AWS.S3.DeleteObjectsRequest = {
        Bucket: 'wayne-aws-club-secrets',
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: false,
        },
      };

      const result = await s3.deleteObjects(deleteParams).promise();

      if (result.Deleted) {
        result.Deleted.forEach((deleted) => {
          console.log(chalk.gray(`   📄 Deleted: ${deleted.Key}`));
        });
      }

      if (result.Errors && result.Errors.length > 0) {
        result.Errors.forEach((error) => {
          console.log(chalk.red(`   ❌ Error deleting ${error.Key}: ${error.Message}`));
        });
      }
    }

    console.log(chalk.green('✅ S3 cleanup completed'));
    return true;
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error deleting S3 objects:'), getErrorMessage(error));
    return false;
  }
};

const testAWSCredentials = async (): Promise<boolean> => {
  try {
    console.log(chalk.blue('🧪 Testing AWS credentials...'));
    await iam.listUsers({ MaxItems: 1 }).promise();
    console.log(chalk.green('✅ AWS credentials are valid'));
    return true;
  } catch (error: unknown) {
    console.error(chalk.red('❌ AWS credentials test failed:'), getErrorMessage(error));
    console.log(
      chalk.yellow('Please verify your AWS credentials have the necessary IAM permissions')
    );
    return false;
  }
};

const runCleanup = async (): Promise<void> => {
  try {
    displayWarning();

    const confirm1 = await askQuestion(chalk.red('Type "DELETE" to continue: '));
    if (confirm1.toUpperCase() !== 'DELETE') {
      console.log(chalk.yellow('❌ Operation cancelled'));
      rl.close();
      return;
    }

    const confirm2 = await askQuestion(
      chalk.red('Are you absolutely sure? Type "YES" to proceed: ')
    );
    if (confirm2.toUpperCase() !== 'YES') {
      console.log(chalk.yellow('❌ Operation cancelled'));
      rl.close();
      return;
    }

    console.log('\n' + chalk.blue.bold('🚀 Starting cleanup process...\n'));

    const [users, s3Objects] = await Promise.all([getClubUsers(), getS3SecretFiles()]);

    if (users.length === 0 && s3Objects.length === 0) {
      console.log(chalk.green('✅ No resources found to clean up!'));
      rl.close();
      return;
    }

    console.log('\n' + chalk.yellow.bold('📋 Cleanup Summary:'));
    console.log(chalk.yellow(`   • ${users.length} IAM users to delete`));
    console.log(chalk.yellow(`   • ${s3Objects.length} S3 objects to delete`));

    const finalConfirm = await askQuestion(chalk.red('\nProceed with deletion? (y/N): '));
    if (finalConfirm.toLowerCase() !== 'y' && finalConfirm.toLowerCase() !== 'yes') {
      console.log(chalk.yellow('❌ Operation cancelled'));
      rl.close();
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log(chalk.blue.bold('Starting IAM User Cleanup'));
    console.log('='.repeat(50));

    let successCount = 0;
    for (const user of users) {
      if (!user.UserName) continue;
      const success = await deleteUser(user.UserName);
      if (success) successCount++;
      console.log('');
    }

    console.log('='.repeat(50));
    console.log(chalk.blue.bold('Starting S3 Cleanup'));
    console.log('='.repeat(50));

    await deleteS3Objects(s3Objects);

    console.log('\n' + '='.repeat(50));
    console.log(chalk.green.bold('🎉 Cleanup Complete!'));
    console.log('='.repeat(50));
    console.log(chalk.green(`✅ Successfully deleted ${successCount}/${users.length} IAM users`));
    console.log(chalk.green('✅ Cleaned up S3 secret files'));
    console.log(chalk.yellow('⚠️  Remember to also clean up your MongoDB users if needed'));
    console.log('='.repeat(50));
  } catch (error: unknown) {
    console.error(chalk.red('\n❌ Fatal error during cleanup:'), getErrorMessage(error));
  } finally {
    rl.close();
  }
};

const checkAWSCredentials = (): boolean => {
  console.log(chalk.cyan('🔍 Checking environment variables...'));
  console.log(
    `AWS_ADMIN_ACCESS_KEY_ID: ${process.env.AWS_ADMIN_ACCESS_KEY_ID ? '✓ Set' : '✗ Not set'}`
  );
  console.log(
    `AWS_ADMIN_SECRET_ACCESS_KEY: ${process.env.AWS_ADMIN_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Not set'}`
  );

  const accessKeyId = process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.log(chalk.red('❌ AWS credentials not found!'));
    console.log(chalk.yellow('Expected format in .env file:'));
    console.log('AWS_ADMIN_ACCESS_KEY_ID=your_access_key_here');
    console.log('AWS_ADMIN_SECRET_ACCESS_KEY=your_secret_key_here');
    return false;
  }

  console.log(chalk.green('✅ AWS credentials found and configured'));
  return true;
};

if (require.main === module) {
  checkAWSCredentials();
  console.log(chalk.cyan('Environment file path:'), path.join(__dirname, '../.env'));
  console.log('');

  testAWSCredentials().then((isValid) => {
    if (!isValid) {
      console.log(chalk.red('❌ Aborting cleanup due to credential issues'));
      process.exit(1);
    }

    runCleanup().catch((error: unknown) => {
      console.error(chalk.red('❌ Script failed:'), getErrorMessage(error));
      process.exit(1);
    });
  });
}

export { runCleanup };
