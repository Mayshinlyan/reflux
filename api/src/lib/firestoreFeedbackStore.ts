import type { Firestore } from 'firebase-admin/firestore';

import type { FeedbackEntry, FeedbackStore } from './feedbackStore.js';

export type FirestoreAddLike = Pick<Firestore, 'collection'>;

export const FEEDBACK_COLLECTION = 'feedback';

/**
 * One auto-id document per message in the `feedback` collection: the text, app version, platform and time.
 * The person's uid is left out on purpose, so feedback can't be tied back to a phone's data.
 */
export class FirestoreFeedbackStore implements FeedbackStore {
  constructor(private readonly db: FirestoreAddLike) {}

  async add(entry: FeedbackEntry, now: Date): Promise<void> {
    await this.db.collection(FEEDBACK_COLLECTION).add({ ...entry, createdAt: now });
  }
}
