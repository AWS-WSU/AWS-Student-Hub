const {
  IAMClient,
  ListUsersCommand,
  ListAccessKeysCommand,
  DeleteAccessKeyCommand,
  ListAttachedUserPoliciesCommand,
  DetachUserPolicyCommand,
  DeletePolicyCommand,
  ListUserPoliciesCommand,
  DeleteUserPolicyCommand,
  ListGroupsForUserCommand,
  RemoveUserFromGroupCommand,
  DeleteUserCommand,
} = require('@aws-sdk/client-iam');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');
const readline = require('readline');
const chalk = require('chalk');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

const displayWarning = () => {
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

const getClubUsers = async () => {
  try {
    console.log(chalk.blue('🔍 Finding all club users...'));
    const users = [];
    let marker;

    do {
      const result = await iamClient.send(
        new ListUsersCommand({
          MaxItems: 100,
          ...(marker && { Marker: marker }),
        })
      );

      const clubUsers = result.Users.filter((user) => user.UserName.startsWith('club_'));
      users.push(...clubUsers);

      marker = result.Marker;
    } while (marker);

    console.log(chalk.green(`✅ Found ${users.length} club users`));
    return users;
  } catch (error) {
    console.error(chalk.red('❌ Error fetching users:'), error.message);
    return [];
  }
};

const getS3SecretFiles = async () => {
  try {
    console.log(chalk.blue('🔍 Finding all secret files in S3...'));
    const objects = [];
    let continuationToken;

    do {
      const result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: 'wayne-aws-club-secrets',
          Prefix: 'secrets/',
          MaxKeys: 1000,
          ...(continuationToken && { ContinuationToken: continuationToken }),
        })
      );
      if (result.Contents) {
        objects.push(...result.Contents);
      }
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    console.log(chalk.green(`✅ Found ${objects.length} secret files`));
    return objects;
  } catch (error) {
    console.error(chalk.red('❌ Error fetching S3 objects:'), error.message);
    return [];
  }
};

const deleteUser = async (username) => {
  try {
    console.log(chalk.yellow(`🗑️  Deleting user: ${username}`));

    try {
      const accessKeys = await iamClient.send(
        new ListAccessKeysCommand({ UserName: username })
      );
      for (const key of accessKeys.AccessKeyMetadata) {
        await iamClient.send(
          new DeleteAccessKeyCommand({
            UserName: username,
            AccessKeyId: key.AccessKeyId,
          })
        );
        console.log(chalk.gray(`   🔑 Deleted access key: ${key.AccessKeyId}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error deleting access keys: ${error.message}`));
    }

    try {
      const attachedPolicies = await iamClient.send(
        new ListAttachedUserPoliciesCommand({ UserName: username })
      );
      for (const policy of attachedPolicies.AttachedPolicies) {
        await iamClient.send(
          new DetachUserPolicyCommand({
            UserName: username,
            PolicyArn: policy.PolicyArn,
          })
        );
        console.log(chalk.gray(`   📋 Detached policy: ${policy.PolicyName}`));

        if (policy.PolicyName.startsWith('club_')) {
          try {
            await iamClient.send(new DeletePolicyCommand({ PolicyArn: policy.PolicyArn }));
            console.log(chalk.gray(`   🗑️  Deleted policy: ${policy.PolicyName}`));
          } catch (deletePolicyError) {
            console.log(
              chalk.red(
                `   ❌ Error deleting policy ${policy.PolicyName}: ${deletePolicyError.message}`
              )
            );
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error handling policies: ${error.message}`));
    }

    try {
      const inlinePolicies = await iamClient.send(
        new ListUserPoliciesCommand({ UserName: username })
      );
      for (const policyName of inlinePolicies.PolicyNames) {
        await iamClient.send(
          new DeleteUserPolicyCommand({
            UserName: username,
            PolicyName: policyName,
          })
        );
        console.log(chalk.gray(`   📄 Deleted inline policy: ${policyName}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error deleting inline policies: ${error.message}`));
    }

    try {
      const groups = await iamClient.send(
        new ListGroupsForUserCommand({ UserName: username })
      );
      for (const group of groups.Groups) {
        await iamClient.send(
          new RemoveUserFromGroupCommand({
            UserName: username,
            GroupName: group.GroupName,
          })
        );
        console.log(chalk.gray(`   👥 Removed from group: ${group.GroupName}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error removing from groups: ${error.message}`));
    }

    await iamClient.send(new DeleteUserCommand({ UserName: username }));
    console.log(chalk.green(`   ✅ User deleted successfully`));

    return true;
  } catch (error) {
    console.error(chalk.red(`   ❌ Error deleting user ${username}:`, error.message));
    return false;
  }
};

const deleteS3Objects = async (objects) => {
  if (objects.length === 0) {
    console.log(chalk.gray('📁 No S3 objects to delete'));
    return true;
  }

  try {
    console.log(chalk.yellow(`🗑️  Deleting ${objects.length} S3 objects...`));

    const batchSize = 1000;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);

      const result = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: 'wayne-aws-club-secrets',
          Delete: {
            Objects: batch.map((obj) => ({ Key: obj.Key })),
            Quiet: false,
          },
        })
      );

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
  } catch (error) {
    console.error(chalk.red('❌ Error deleting S3 objects:'), error.message);
    return false;
  }
};

const testAWSCredentials = async () => {
  try {
    console.log(chalk.blue('🧪 Testing AWS credentials...'));
    await iamClient.send(new ListUsersCommand({ MaxItems: 1 }));
    console.log(chalk.green('✅ AWS credentials are valid'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ AWS credentials test failed:'), error.message);
    console.log(
      chalk.yellow('Please verify your AWS credentials have the necessary IAM permissions')
    );
    return false;
  }
};

const runCleanup = async () => {
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
    console.log(chalk.green(`✅ Cleaned up S3 secret files`));
    console.log(chalk.yellow('⚠️  Remember to also clean up your MongoDB users if needed'));
    console.log('='.repeat(50));
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error during cleanup:'), error.message);
  } finally {
    rl.close();
  }
};

const checkAWSCredentials = () => {
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

    runCleanup().catch((error) => {
      console.error(chalk.red('❌ Script failed:'), error.message);
      process.exit(1);
    });
  });
}

module.exports = { runCleanup };
