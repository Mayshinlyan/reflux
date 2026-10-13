import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { cleanCustomSymptom, MAX_CUSTOM_SYMPTOM } from '@/constants/symptomItems';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with what was typed, already tidied. The caller saves it and closes the sheet. */
  onAdd: (text: string) => void;
};

/** "Add your own symptom" (Figma 03e.3): one field and an Add button. Used by the picker and My symptoms. */
export function AddSymptomSheet({ visible, onClose, onAdd }: Props) {
  const [draft, setDraft] = useState('');
  const clean = cleanCustomSymptom(draft);

  // The field starts empty each time the sheet opens, so it is cleared whenever it is left.
  const close = () => {
    setDraft('');
    onClose();
  };
  const add = () => {
    if (!clean) return;
    setDraft('');
    onAdd(clean);
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <TextField
        label="Add your own symptom"
        value={draft}
        onChangeText={setDraft}
        placeholder="e.g. Hiccups"
        maxLength={MAX_CUSTOM_SYMPTOM}
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={add}
      />
      <Button label="Add" onPress={add} disabled={!clean} />
    </BottomSheet>
  );
}
