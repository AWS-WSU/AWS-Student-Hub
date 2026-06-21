export type UserRole = 'member' | 'moderator' | 'admin' | 'superuser';
export type UserStatus = 'active' | 'banned' | 'suspended';
export type UserGrade = '' | 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate' | 'Other';

export interface User {
  _id?: string;
  id?: string;
  username: string;
  fullName: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  major?: string;
  grade?: UserGrade;
  programmingLanguages?: string[];
  profileSetupCompleted?: boolean;
  role?: UserRole;
  status?: UserStatus;
  wantsEmails?: boolean;
  privacyPolicyAcknowledgedAt?: string | null;
  privacyPolicyVersion?: string;
  codeOfConductAcknowledgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  hasViewedAwsCredentials?: boolean;
  prizeversityUserId?: string;
  prizeversityClassroomId?: string;
  prizeversityEmail?: string;
  prizeversityMatchedName?: string;
  prizeversityShortId?: string;
  prizeversityLinkedAt?: string | null;
  prizeversityLastSyncedAt?: string | null;
}

export interface PublicProfile {
  username: string;
  fullName: string;
  profilePicture?: string;
  bio?: string;
  major?: string;
  grade?: UserGrade;
  programmingLanguages: string[];
  role: UserRole;
  lastLogin?: string;
  stats: {
    memberSince: string;
    daysSinceJoin: number;
    daysSinceLastSeen: number;
  };
}
