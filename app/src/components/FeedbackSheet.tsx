import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { sendFeedback } from '@/services/relayClient';
import { space } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { TextField } from './TextField';

/** The relay refuses anything longer (api MAX_FEEDBACK_CHARS), so the field stops here. */
export const FEEDBACK_MAX_CHARS = 2000;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the relay has saved the message. */
  onSent: () => void;
};

/** What to tell the person when sending failed; the shared messages talk about food checks, so these are our own. */
function failureMessage(error: unknown): string {
  const code = error instanceof AppError ? error.code : null;
  if (code === 'RATE_LIMITED') return "You've sent a lot of feedback today. Please try again tomorrow.";
  if (code === 'OFFLINE' || code === 'NETWORK') return 'Sending feedback needs an internet connection.';
  return "We couldn't send that. Please try again.";
}

/**
 * "Tell us what you think" (Figma 19, 27), opened from Settings, About, "Send feedback" and from History's
 * Feedback pill: one multiline field in a bottom sheet. Send stays muted until something is
 * typed. Only the typed text goes to the relay (never meals or symptoms), and a message that
 * didn't send stays in the field, so closing and reopening the sheet doesn't lose it.
 */
export function FeedbackSheet({ visible, onClose, onSent }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const trimmed = message.trim();

  const send = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    setFailed(null);
    try {
      await sendFeedback(trimmed);
    } catch (error) {
      logger.error('sendFeedback', error);
      setFailed(failureMessage(error));
      setSending(false);
      return;
    }
    setSending(false);
    setMessage('');
    onSent();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
      <AppText variant="displaySmall" accessibilityRole="header">
        Tell us what you think
      </AppText>
      <AppText color="inkSoft" style={styles.note}>
        Something missing, confusing or great? It goes straight to the team.
      </AppText>
      <TextField
        label="Your feedback"
        hideLabel
        multiline
        minHeight={112}
        maxLength={FEEDBACK_MAX_CHARS}
        placeholder="What's working? What could be better?"
        value={message}
        onChangeText={(text) => {
          setMessage(text);
          setFailed(null);
        }}
      />
      <AppText variant="caption" color="inkMuted" style={styles.footnote}>
        Only what you write here is sent. No meals or symptoms.
      </AppText>
      {failed ? (
        <AppText color="redInk" style={styles.error} accessibilityRole="alert">
          {failed}
        </AppText>
      ) : null}
      <Button
        label={sending ? 'Sending…' : 'Send'}
        disabled={!trimmed || sending}
        onPress={() => void send()}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: space.s1, marginBottom: space.s2 },
  footnote: { marginBottom: space.s2 },
  error: { marginBottom: space.s2 },
});
