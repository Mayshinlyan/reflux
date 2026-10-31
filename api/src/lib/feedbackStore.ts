export type FeedbackEntry = {
  message: string;
  appVersion?: string;
  platform?: 'ios' | 'android';
};

/** Where feedback messages are kept until someone reads them. */
export interface FeedbackStore {
  add(entry: FeedbackEntry, now: Date): Promise<void>;
}

export class InMemoryFeedbackStore implements FeedbackStore {
  readonly entries: (FeedbackEntry & { createdAt: Date })[] = [];

  async add(entry: FeedbackEntry, now: Date): Promise<void> {
    this.entries.push({ ...entry, createdAt: now });
  }
}
