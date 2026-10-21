import { Camera, Check, type LucideIcon, Shield } from 'lucide-react-native';

import { PointList } from './PointList';

const POINTS: readonly { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Shield, title: 'Stored on your phone', body: 'Your entries never leave your device.' },
  {
    icon: Camera,
    title: 'Meal checks use AI',
    body: "Only the photo or description you add, and what you're managing, is sent to check a meal.",
  },
  {
    icon: Check,
    title: 'Not medical advice',
    body: 'a day in my belly gives general guidance. Talk to your doctor about your symptoms.',
  },
];

/** What happens to their data, and that this isn't medical advice (onboarding and Settings). `welcome` words the first point as a benefit (Figma 01g). */
export function PrivacyPoints({ welcome = false }: { welcome?: boolean }) {
  const points = welcome ? [{ ...POINTS[0], title: 'Private by default' }, ...POINTS.slice(1)] : POINTS;
  return <PointList points={points} />;
}
