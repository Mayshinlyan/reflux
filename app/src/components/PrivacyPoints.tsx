import { Camera, Check, type LucideIcon, Shield } from 'lucide-react-native';

import { PointList } from './PointList';

/** The longer wording for Settings; onboarding keeps the short one so the first screen stays light. */
const AI_DETAIL =
  "To check meals and write Bellie's summaries, we send your meal photos or descriptions, symptoms, lifestyle tags and conditions to an AI service, along with anything you type when checking a meal. For recipe ideas in the Kitchen, we send what you pick on the sheet, your condition, and food names only: your favorite foods, foods that bothered you and foods you don't eat. The notes on your entries, your medications and your name stay on your phone. If you send feedback, the message is kept without your name.";

const POINTS: readonly { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Shield, title: 'Stored on your phone', body: 'Your diary stays on your phone.' },
  {
    icon: Camera,
    title: 'Meal checks and summaries use AI',
    body: "To check meals, write Bellie's summaries and suggest recipes, we send your meals, symptoms and conditions to an AI service, along with anything you type when checking a meal. The notes on your entries, your medications and your name stay on your phone.",
  },
  {
    icon: Check,
    title: 'Not medical advice',
    body: 'A day in my belly gives general guidance. Talk to your doctor about your symptoms.',
  },
];

/** What happens to their data, and that this isn't medical advice (onboarding and Settings). `welcome` words the first point as a benefit (Figma 01g) and keeps the AI point short; Settings spells it out (photos, lifestyle tags, feedback). */
export function PrivacyPoints({ welcome = false }: { welcome?: boolean }) {
  const points = welcome
    ? [{ ...POINTS[0], title: 'Private by default' }, ...POINTS.slice(1)]
    : [POINTS[0], { ...POINTS[1], body: AI_DETAIL }, POINTS[2]];
  return <PointList points={points} />;
}
