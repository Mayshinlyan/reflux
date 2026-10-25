import { Camera, Check, type LucideIcon, Shield } from 'lucide-react-native';

import { PointList } from './PointList';

const POINTS: readonly { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Shield, title: 'Stored on your phone', body: 'Your diary stays on your phone.' },
  {
    icon: Camera,
    title: 'Meal checks and summaries use AI',
    body: "To check meals and write Bellie's summaries, we send your meals, symptoms and conditions to an AI service, along with anything you type when checking a meal. The notes on your entries, your medications and your name stay on your phone.",
  },
  {
    icon: Check,
    title: 'Not medical advice',
    body: 'A day in my belly gives general guidance. Talk to your doctor about your symptoms.',
  },
];

/** What happens to their data, and that this isn't medical advice (onboarding and Settings). `welcome` words the first point as a benefit (Figma 01g). */
export function PrivacyPoints({ welcome = false }: { welcome?: boolean }) {
  const points = welcome ? [{ ...POINTS[0], title: 'Private by default' }, ...POINTS.slice(1)] : POINTS;
  return <PointList points={points} />;
}
