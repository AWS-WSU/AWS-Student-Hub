export interface BroadcastRecipient {
  email: string;
  fullName: string;
}

export interface BroadcastDefinition {
  /** Stable identifier. Doubles as the one-time-use lock in the Broadcast collection. */
  key: string;
  /** Human label shown to admins. */
  title: string;
  fromName: string;
  subject: string;
  buildHtml: (recipient: BroadcastRecipient, now?: number) => string;
  buildText: (recipient: BroadcastRecipient, now?: number) => string;
}
