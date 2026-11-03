import { Camera, Check, Shield } from 'lucide-react-native';

import { type Point, PointList } from './PointList';

/** The longer wording for Settings; onboarding keeps the short one so the first screen stays light. */
const AI_DETAIL =
  "To check meals and write Bellie's summaries, we send your meal photos or descriptions, symptoms, lifestyle tags and conditions to an AI service, along with anything you type when checking a meal. For recipe ideas in the Kitchen, we send what you pick on the sheet, your condition, and food names only: your favorite foods, foods that bothered you and foods you don't eat, plus the food names in your fridge if you use it. If you scan your fridge, those photos go to the same service only to find the ingredients, with their location and other details removed, and they are not kept; the list stays on your phone. The notes on your entries, your medications and your name stay on your phone. If you send feedback, the message is kept without your name.";

const POINTS: readonly Point[] = [
  { icon: Shield, title: 'Stored on your phone', body: 'Your diary stays on your phone.' },
  {
    icon: Camera,
    title: 'Meal checks and summaries use AI',
    body: "To check meals, write Bellie's summaries and suggest recipes, we send your meals, symptoms and conditions to an AI service, along with anything you type when checking a meal. Fridge photos go too, only to find ingredients. The notes on your entries, your medications and your name stay on your phone.",
  },
  {
    icon: Check,
    title: 'Not medical advice',
    body: 'A day in my belly gives general guidance. Talk to your doctor about your symptoms.',
  },
];

/** The short onboarding wording (Figma 17e): one line per point, the AI one at most two. Settings spells it out. */
const WELCOME_POINTS: readonly Point[] = [
  { icon: Shield, title: 'No sign-in', body: 'What you send is linked to a random ID, not to your name.' },
  {
    icon: Camera,
    title: 'Meal checks use AI',
    body: 'Only the photo or text you add is sent, never your name or notes.',
  },
  { icon: Check, title: 'Not medical advice', body: 'General guidance only. Ask your doctor.' },
];

/** What happens to their data, and that this isn't medical advice (onboarding and Settings). `welcome` uses the short wording; Settings spells it out (photos, lifestyle tags, feedback). */
export function PrivacyPoints({ welcome = false }: { welcome?: boolean }) {
  return (
    <PointList
      points={welcome ? WELCOME_POINTS : [POINTS[0], { ...POINTS[1], body: AI_DETAIL }, POINTS[2]]}
    />
  );
}
