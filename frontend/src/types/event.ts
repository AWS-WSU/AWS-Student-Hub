export type EventStatus = 'draft' | 'published';

export interface Event {
  _id: string;
  title: string;
  startTime: string;
  isRemote: boolean | 'true' | 'false';
  zoomLink?: string;
  address?: string;
  directions?: string;
  locationName?: string;
  description?: string;
  thumbnailUrl?: string;
  meetupUrl?: string;
  status?: EventStatus;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventFormPayload {
  title?: string;
  startTime?: string;
  date?: string;
  time?: string;
  isRemote?: boolean | string;
  zoomLink?: string;
  address?: string;
  directions?: string;
  locationName?: string;
  description?: string;
  meetupUrl?: string;
  status?: EventStatus;
  thumbnail?: File | Blob | null;
}
