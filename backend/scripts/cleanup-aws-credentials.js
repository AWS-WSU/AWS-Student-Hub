const AWS = require('aws-sdk');
const readline = require('readline');
const chalk = require('chalk');
const path = require('path');

// Load environment variables from the correct path
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const iam = new AWS.IAM();
const s3 = new AWS.S3();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function for prompts
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Display warning banner
const displayWarning = () => {
  console.log('\n' + '='.repeat(80));
  console.log(chalk.red.bold('⚠️  DESTRUCTIVE OPERATION WARNING ⚠️'));
  console.log('='.repeat(80));
  console.log(chalk.yellow('This script will:'));
  console.log(chalk.yellow('• Delete ALL IAM users starting with "club_"'));
  console.log(chalk.yellow('• Delete ALL associated IAM policies'));
  console.log(chalk.yellow('• Delete ALL access keys for these users'));
  console.log(chalk.yellow('• Delete ALL secret files in S3 bucket "wayneaws-club-secrets"'));
  console.log(chalk.yellow('• This action is IRREVERSIBLE'));
  console.log('\n' + chalk.red.bold('USE ONLY IN DEVELOPMENT ENVIRONMENT!'));
  console.log('='.repeat(80) + '\n');
};

// Get all club users
const getClubUsers = async () => {
  try {
    console.log(chalk.blue('🔍 Finding all club users...'));
    const users = [];
    let marker;
    
    do {
      const params = {
        MaxItems: 100,
        ...(marker && { Marker: marker })
      };
      
      const result = await iam.listUsers(params).promise();
      
      // Filter users that start with "club_"
      const clubUsers = result.Users.filter(user => user.UserName.startsWith('club_'));
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

// Get all S3 objects in secrets folder
const getS3SecretFiles = async () => {
  try {
    console.log(chalk.blue('🔍 Finding all secret files in S3...'));
    const objects = [];
    let continuationToken;
    
    do {
      const params = {
        Bucket: 'wayneaws-club-secrets',
        Prefix: 'secrets/',
        MaxKeys: 1000,
        ...(continuationToken && { ContinuationToken: continuationToken })
      };
      
      const result = await s3.listObjectsV2(params).promise();
      objects.push(...result.Contents);
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
    
    console.log(chalk.green(`✅ Found ${objects.length} secret files`));
    return objects;
  } catch (error) {
    console.error(chalk.red('❌ Error fetching S3 objects:'), error.message);
    return [];
  }
};

// Delete a single IAM user and all associated resources
const deleteUser = async (username) => {
  try {
    console.log(chalk.yellow(`🗑️  Deleting user: ${username}`));
    
    // 1. List and delete all access keys
    try {
      const accessKeys = await iam.listAccessKeys({ UserName: username }).promise();
      for (const key of accessKeys.AccessKeyMetadata) {
        await iam.deleteAccessKey({
          UserName: username,
          AccessKeyId: key.AccessKeyId
        }).promise();
        console.log(chalk.gray(`   🔑 Deleted access key: ${key.AccessKeyId}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error deleting access keys: ${error.message}`));
    }
    
    // 2. List and detach all user policies
    try {
      const attachedPolicies = await iam.listAttachedUserPolicies({ UserName: username }).promise();
      for (const policy of attachedPolicies.AttachedPolicies) {
        await iam.detachUserPolicy({
          UserName: username,
          PolicyArn: policy.PolicyArn
        }).promise();
        console.log(chalk.gray(`   📋 Detached policy: ${policy.PolicyName}`));
        
        // Delete the policy if it's a club-specific policy
        if (policy.PolicyName.startsWith('club_')) {
          try {
            await iam.deletePolicy({ PolicyArn: policy.PolicyArn }).promise();
            console.log(chalk.gray(`   🗑️  Deleted policy: ${policy.PolicyName}`));
          } catch (deletePolicyError) {
            console.log(chalk.red(`   ❌ Error deleting policy ${policy.PolicyName}: ${deletePolicyError.message}`));
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error handling policies: ${error.message}`));
    }
    
    // 3. List and delete all inline policies
    try {
      const inlinePolicies = await iam.listUserPolicies({ UserName: username }).promise();
      for (const policyName of inlinePolicies.PolicyNames) {
        await iam.deleteUserPolicy({
          UserName: username,
          PolicyName: policyName
        }).promise();
        console.log(chalk.gray(`   📄 Deleted inline policy: ${policyName}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error deleting inline policies: ${error.message}`));
    }
    
    // 4. Remove user from all groups
    try {
      const groups = await iam.getGroupsForUser({ UserName: username }).promise();
      for (const group of groups.Groups) {
        await iam.removeUserFromGroup({
          UserName: username,
          GroupName: group.GroupName
        }).promise();
        console.log(chalk.gray(`   👥 Removed from group: ${group.GroupName}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error removing from groups: ${error.message}`));
    }
    
    // 5. Finally, delete the user
    await iam.deleteUser({ UserName: username }).promise();
    console.log(chalk.green(`   ✅ User deleted successfully`));
    
    return true;
  } catch (error) {
    console.error(chalk.red(`   ❌ Error deleting user ${username}:`, error.message));
    return false;
  }
};

// Delete S3 objects
const deleteS3Objects = async (objects) => {
  if (objects.length === 0) {
    console.log(chalk.gray('📁 No S3 objects to delete'));
    return true;
  }
  
  try {
    console.log(chalk.yellow(`🗑️  Deleting ${objects.length} S3 objects...`));
    
    // Delete objects in batches of 1000 (S3 limit)
    const batchSize = 1000;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);
      
      const deleteParams = {
        Bucket: 'wayneaws-club-secrets',
        Delete: {
          Objects: batch.map(obj => ({ Key: obj.Key })),
          Quiet: false
        }
      };
      
      const result = await s3.deleteObjects(deleteParams).promise();
      
      if (result.Deleted) {
        result.Deleted.forEach(deleted => {
          console.log(chalk.gray(`   📄 Deleted: ${deleted.Key}`));
        });
      }
      
      if (result.Errors && result.Errors.length > 0) {
        result.Errors.forEach(error => {
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

// Test AWS credentials
const testAWSCredentials = async () => {
  try {
    console.log(chalk.blue('🧪 Testing AWS credentials...'));
    // Use a less restrictive operation - list users instead of getUser
    await iam.listUsers({ MaxItems: 1 }).promise();
    console.log(chalk.green('✅ AWS credentials are valid'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ AWS credentials test failed:'), error.message);
    console.log(chalk.yellow('Please verify your AWS credentials have the necessary IAM permissions'));
    return false;
  }
};

// Main cleanup function
const runCleanup = async () => {
  try {
    displayWarning();
    
    // Double confirmation
    const confirm1 = await askQuestion(chalk.red('Type "DELETE" to continue: '));
    if (confirm1.toUpperCase() !== 'DELETE') {
      console.log(chalk.yellow('❌ Operation cancelled'));
      rl.close();
      return;
    }
    
    const confirm2 = await askQuestion(chalk.red('Are you absolutely sure? Type "YES" to proceed: '));
    if (confirm2.toUpperCase() !== 'YES') {
      console.log(chalk.yellow('❌ Operation cancelled'));
      rl.close();
      return;
    }
    
    console.log('\n' + chalk.blue.bold('🚀 Starting cleanup process...\n'));
    
    // Get all resources
    const [users, s3Objects] = await Promise.all([
      getClubUsers(),
      getS3SecretFiles()
    ]);
    
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
    
    // Delete IAM users
    let successCount = 0;
    for (const user of users) {
      const success = await deleteUser(user.UserName);
      if (success) successCount++;
      console.log(''); // Empty line for readability
    }
    
    console.log('='.repeat(50));
    console.log(chalk.blue.bold('Starting S3 Cleanup'));
    console.log('='.repeat(50));
    
    // Delete S3 objects
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

// Check if AWS credentials are configured
const checkAWSCredentials = () => {
  console.log(chalk.cyan('🔍 Checking environment variables...'));
  console.log(`AWS_ADMIN_ACCESS_KEY_ID: ${process.env.AWS_ADMIN_ACCESS_KEY_ID ? '✓ Set' : '✗ Not set'}`);
  console.log(`AWS_ADMIN_SECRET_ACCESS_KEY: ${process.env.AWS_ADMIN_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Not set'}`);
  
  const accessKeyId = process.env.AWS_ADMIN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_ADMIN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  
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

// Run the script
if (require.main === module) {
  checkAWSCredentials();
  console.log(chalk.cyan('Environment file path:'), path.join(__dirname, '../.env'));
  console.log('');
  
  testAWSCredentials().then(isValid => {
    if (!isValid) {
      console.log(chalk.red('❌ Aborting cleanup due to credential issues'));
      process.exit(1);
    }
    
    runCleanup().catch(error => {
      console.error(chalk.red('❌ Script failed:'), error.message);
      process.exit(1);
    });
  });
}

module.exports = { runCleanup };
