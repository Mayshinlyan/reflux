import { Camera, Check, type LucideIcon, Shield } from 'lucide-react-native';

import { PointList } from './PointList';

/** The longer wording for Settings; onboarding keeps the short one so the first screen stays light. */
const AI_DETAIL =
  "To check meals and write Bellie's summaries, we send your meal photos or descriptions, symptoms, lifestyle tags and conditions to an AI service, along with anything you type when checking a meal. The notes on your entries, your medications and your name stay on your phone. If you send feedback, the message is kept without your name.";

type Point = { icon: LucideIcon; title: string; body: string };

const STORED: Point = {
  icon: Shield,
  title: 'Stored on your phone',
  body: 'Your diary stays on your phone.',
};
const AI: Point = {
  icon: Camera,
  title: 'Meal checks and summaries use AI',
  body: "To check meals and write Bellie's summaries, we send your meals, symptoms and conditions to an AI service, along with anything you type when checking a meal. The notes on your entries, your medications and your name stay on your phone.",
};
const NOT_ADVICE: Point = {
  icon: Check,
  title: 'Not medical advice',
  body: 'A day in my belly gives general guidance. Talk to your doctor about your symptoms.',
};

/** What happens to their data, and that this isn't medical advice (onboarding and Settings). `welcome` words the first point as a benefit (Figma 01g) and keeps the AI point short; Settings spells it out (photos, lifestyle tags, feedback). */
export function PrivacyPoints({ welcome = false }: { welcome?: boolean }) {
  const points = welcome
    ? [{ ...STORED, title: 'Private by default' }, AI, NOT_ADVICE]
    : [STORED, { ...AI, body: AI_DETAIL }, NOT_ADVICE];
  return <PointList points={points} />;
}
