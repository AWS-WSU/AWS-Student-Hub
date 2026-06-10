import {
  DeleteAccessKeyCommand,
  DeletePolicyCommand,
  DeleteUserCommand,
  DeleteUserPolicyCommand,
  DetachUserPolicyCommand,
  IAMClient,
  ListAccessKeysCommand,
  ListAttachedUserPoliciesCommand,
  ListGroupsForUserCommand,
  ListUserPoliciesCommand,
  ListUsersCommand,
  RemoveUserFromGroupCommand,
} from '@aws-sdk/client-iam';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import logger from '../config/logger';

const log = logger.child({ module: 'cleanup-aws-credentials' });

dotenv.config({ path: path.join(__dirname, '../.env') });

interface ClubUser {
  UserName?: string;
}

interface S3SecretObject {
  Key?: string;
}

const accessKeyId = process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

const iamClient = new IAMClient({
  region: 'us-east-1',
  credentials,
});

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials,
});

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
  log.info('\\n' + '='.repeat(80));
  log.info(chalk.red.bold('destructive operation warning.'));
  log.info('='.repeat(80));
  log.info(chalk.yellow('this script will perform the following actions.'));
  log.info(chalk.yellow('delete all iam users starting with "club_".'));
  log.info(chalk.yellow('delete all associated iam policies.'));
  log.info(chalk.yellow('delete all access keys for these users.'));
  log.info(chalk.yellow('delete all secret files in s3 bucket "wayne-aws-club-secrets".'));
  log.info(chalk.yellow('this action is irreversible.'));
  log.info('\\n' + chalk.red.bold('use only in development environment.'));
  log.info('='.repeat(80) + '\\n');
};

const getClubUsers = async (): Promise<ClubUser[]> => {
  try {
    log.info(chalk.blue('finding all club users.'));
    const users: ClubUser[] = [];
    let marker: string | undefined;

    do {
      const result = await iamClient.send(
        new ListUsersCommand({
          MaxItems: 100,
          ...(marker ? { Marker: marker } : {}),
        })
      );

      const clubUsers = (result.Users || []).filter((user) => user.UserName?.startsWith('club_'));
      users.push(...clubUsers);
      marker = result.Marker;
    } while (marker);

    log.info(chalk.green(`found ${users.length} club users.`));
    return users;
  } catch (error: unknown) {
    log.error(chalk.red('error fetching users.'), getErrorMessage(error));
    return [];
  }
};

const getS3SecretFiles = async (): Promise<S3SecretObject[]> => {
  try {
    log.info(chalk.blue('finding all secret files in s3.'));
    const objects: S3SecretObject[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: 'wayne-aws-club-secrets',
          Prefix: 'secrets/',
          MaxKeys: 1000,
          ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        })
      );

      objects.push(...(result.Contents || []));
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    log.info(chalk.green(`found ${objects.length} secret files.`));
    return objects;
  } catch (error: unknown) {
    log.error(chalk.red('error fetching s3 objects.'), getErrorMessage(error));
    return [];
  }
};

const deleteUser = async (username: string): Promise<boolean> => {
  try {
    log.info(chalk.yellow(`deleting user ${username}.`));

    try {
      const accessKeys = await iamClient.send(new ListAccessKeysCommand({ UserName: username }));
      for (const key of accessKeys.AccessKeyMetadata || []) {
        if (!key.AccessKeyId) continue;
        await iamClient.send(
          new DeleteAccessKeyCommand({
            UserName: username,
            AccessKeyId: key.AccessKeyId,
          })
        );
        log.info(chalk.gray(`deleted access key ${key.AccessKeyId}.`));
      }
    } catch (error: unknown) {
      log.info(chalk.red('error deleting access keys.'), getErrorMessage(error));
    }

    try {
      const attachedPolicies = await iamClient.send(
        new ListAttachedUserPoliciesCommand({ UserName: username })
      );
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        if (!policy.PolicyArn) continue;
        await iamClient.send(
          new DetachUserPolicyCommand({
            UserName: username,
            PolicyArn: policy.PolicyArn,
          })
        );
        log.info(chalk.gray(`detached policy ${policy.PolicyName || policy.PolicyArn}.`));

        if (policy.PolicyName?.startsWith('club_')) {
          try {
            await iamClient.send(new DeletePolicyCommand({ PolicyArn: policy.PolicyArn }));
            log.info(chalk.gray(`deleted policy ${policy.PolicyName}.`));
          } catch (deletePolicyError: unknown) {
            log.info(
              chalk.red(`error deleting policy ${policy.PolicyName}.`),
              getErrorMessage(deletePolicyError)
            );
          }
        }
      }
    } catch (error: unknown) {
      log.info(chalk.red('error handling policies.'), getErrorMessage(error));
    }

    try {
      const inlinePolicies = await iamClient.send(
        new ListUserPoliciesCommand({ UserName: username })
      );
      for (const policyName of inlinePolicies.PolicyNames || []) {
        await iamClient.send(
          new DeleteUserPolicyCommand({
            UserName: username,
            PolicyName: policyName,
          })
        );
        log.info(chalk.gray(`deleted inline policy ${policyName}.`));
      }
    } catch (error: unknown) {
      log.info(chalk.red('error deleting inline policies.'), getErrorMessage(error));
    }

    try {
      const groups = await iamClient.send(new ListGroupsForUserCommand({ UserName: username }));
      for (const group of groups.Groups || []) {
        if (!group.GroupName) continue;
        await iamClient.send(
          new RemoveUserFromGroupCommand({
            UserName: username,
            GroupName: group.GroupName,
          })
        );
        log.info(chalk.gray(`removed from group ${group.GroupName}.`));
      }
    } catch (error: unknown) {
      log.info(chalk.red('error removing from groups.'), getErrorMessage(error));
    }

    await iamClient.send(new DeleteUserCommand({ UserName: username }));
    log.info(chalk.green('user deleted successfully.'));

    return true;
  } catch (error: unknown) {
    log.error(chalk.red(`error deleting user ${username}.`), getErrorMessage(error));
    return false;
  }
};

const deleteS3Objects = async (objects: S3SecretObject[]): Promise<boolean> => {
  if (objects.length === 0) {
    log.info(chalk.gray('no s3 objects to delete.'));
    return true;
  }

  try {
    log.info(chalk.yellow(`deleting ${objects.length} s3 objects.`));

    const batchSize = 1000;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);
      const keys = batch.map((obj) => obj.Key).filter((key): key is string => Boolean(key));

      if (keys.length === 0) continue;

      const result = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: 'wayne-aws-club-secrets',
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: false,
          },
        })
      );

      if (result.Deleted) {
        result.Deleted.forEach((deleted) => {
          log.info(chalk.gray(`deleted ${deleted.Key}.`));
        });
      }

      if (result.Errors && result.Errors.length > 0) {
        result.Errors.forEach((error) => {
          log.info(chalk.red(`error deleting ${error.Key}.`), error.Message);
        });
      }
    }

    log.info(chalk.green('s3 cleanup completed.'));
    return true;
  } catch (error: unknown) {
    log.error(chalk.red('error deleting s3 objects.'), getErrorMessage(error));
    return false;
  }
};

const testAWSCredentials = async (): Promise<boolean> => {
  try {
    log.info(chalk.blue('testing aws credentials.'));
    await iamClient.send(new ListUsersCommand({ MaxItems: 1 }));
    log.info(chalk.green('aws credentials are valid.'));
    return true;
  } catch (error: unknown) {
    log.error(chalk.red('aws credentials test failed.'), getErrorMessage(error));
    log.info(
      chalk.yellow('please verify your aws credentials have the necessary iam permissions.')
    );
    return false;
  }
};

const runCleanup = async (): Promise<void> => {
  try {
    displayWarning();

    const confirm1 = await askQuestion(chalk.red('Type "DELETE" to continue: '));
    if (confirm1.toUpperCase() !== 'DELETE') {
      log.info(chalk.yellow('operation cancelled.'));
      rl.close();
      return;
    }

    const confirm2 = await askQuestion(
      chalk.red('Are you absolutely sure? Type "YES" to proceed: ')
    );
    if (confirm2.toUpperCase() !== 'YES') {
      log.info(chalk.yellow('operation cancelled.'));
      rl.close();
      return;
    }

    log.info('\\n' + chalk.blue.bold('starting cleanup process.'));

    const [users, s3Objects] = await Promise.all([getClubUsers(), getS3SecretFiles()]);

    if (users.length === 0 && s3Objects.length === 0) {
      log.info(chalk.green('no resources found to clean up.'));
      rl.close();
      return;
    }

    log.info('\\n' + chalk.yellow.bold('cleanup summary.'));
    log.info(chalk.yellow(`${users.length} iam users to delete.`));
    log.info(chalk.yellow(`${s3Objects.length} s3 objects to delete.`));

    const finalConfirm = await askQuestion(chalk.red('\nProceed with deletion? (y/N): '));
    if (finalConfirm.toLowerCase() !== 'y' && finalConfirm.toLowerCase() !== 'yes') {
      log.info(chalk.yellow('operation cancelled.'));
      rl.close();
      return;
    }

    log.info('\\n' + '='.repeat(50));
    log.info(chalk.blue.bold('starting iam user cleanup.'));
    log.info('='.repeat(50));

    let successCount = 0;
    for (const user of users) {
      if (!user.UserName) continue;
      const success = await deleteUser(user.UserName);
      if (success) successCount++;
      log.info('');
    }

    log.info('='.repeat(50));
    log.info(chalk.blue.bold('starting s3 cleanup.'));
    log.info('='.repeat(50));

    await deleteS3Objects(s3Objects);

    log.info('\\n' + '='.repeat(50));
    log.info(chalk.green.bold('cleanup complete.'));
    log.info('='.repeat(50));
    log.info(chalk.green(`successfully deleted ${successCount}/${users.length} iam users.`));
    log.info(chalk.green('cleaned up s3 secret files.'));
    log.info(chalk.yellow('remember to also clean up your mongodb users if needed.'));
    log.info('='.repeat(50));
  } catch (error: unknown) {
    log.error(chalk.red('fatal error during cleanup.'), getErrorMessage(error));
  } finally {
    rl.close();
  }
};

const checkAWSCredentials = (): boolean => {
  log.info(chalk.cyan('checking environment variables.'));
  log.info(`aws admin access key id ${process.env.AWS_ADMIN_ACCESS_KEY_ID ? 'set' : 'not set'}.`);
  log.info(
    `aws admin secret access key ${process.env.AWS_ADMIN_SECRET_ACCESS_KEY ? 'set' : 'not set'}.`
  );

  if (!accessKeyId || !secretAccessKey) {
    log.info(chalk.red('aws credentials not found.'));
    log.info(chalk.yellow('expected format in .env file.'));
    log.info('AWS_ADMIN_ACCESS_KEY_ID=your_access_key_here');
    log.info('AWS_ADMIN_SECRET_ACCESS_KEY=your_secret_key_here');
    return false;
  }

  log.info(chalk.green('aws credentials found and configured.'));
  return true;
};

if (require.main === module) {
  checkAWSCredentials();
  log.info(chalk.cyan('environment file path.'), path.join(__dirname, '../.env'));
  log.info('');

  testAWSCredentials().then((isValid) => {
    if (!isValid) {
      log.info(chalk.red('aborting cleanup due to credential issues.'));
      process.exit(1);
    }

    runCleanup().catch((error: unknown) => {
      log.error(chalk.red('script failed.'), getErrorMessage(error));
      process.exit(1);
    });
  });
}

export { runCleanup };
