import { SvgXml } from 'react-native-svg';

import type { CuisineKey } from '@/constants/cuisines';

const wrap = (inner: string) =>
  `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/**
 * One flat drawing per cuisine (Figma row 37b), each with its own subject and main colour. A `Record` over
 * `CuisineKey`, so adding a cuisine without a picture fails the type check.
 */
export const CUISINE_ART: Record<CuisineKey, string> = {
  any: wrap(
    `<ellipse cx="22" cy="30" rx="14" ry="12" fill="#D9B48A" stroke="#7A5A3A" stroke-width="1.5"/><path d="M22 18 Q22 12 28 10" stroke="#6B7A3E" stroke-width="2" stroke-linecap="round"/><ellipse cx="29" cy="9.5" rx="4" ry="2.2" fill="#6B7A3E" transform="rotate(-25 29 9.5)"/><circle cx="17" cy="30" r="1.5" fill="#3A2F25"/><circle cx="27" cy="30" r="1.5" fill="#3A2F25"/><path d="M19.5 34 Q22 36.5 24.5 34" stroke="#3A2F25" stroke-width="1.5" stroke-linecap="round"/><circle cx="13.5" cy="33" r="2" fill="#E2A3A3"/><circle cx="30.5" cy="33" r="2" fill="#E2A3A3"/><path d="M39 6 L40.6 10.4 L45 12 L40.6 13.6 L39 18 L37.4 13.6 L33 12 L37.4 10.4Z" fill="#E7B65A"/>`,
  ),
  chinese: wrap(
    `<rect x="7" y="29" width="34" height="13" rx="3" fill="#D8A35B"/><path d="M15 29V42M24 29V42M33 29V42" stroke="#B27F3C" stroke-width="1.5"/><rect x="5" y="24" width="38" height="6" rx="3" fill="#E7B65A"/><path d="M8 24 Q24 8 40 24Z" fill="#F0C56F"/><circle cx="24" cy="13" r="2.5" fill="#B27F3C"/><path d="M18 9 Q15 6 18 3 M30 9 Q27 6 30 3" stroke="#BFB5A5" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
  indian: wrap(
    `<path d="M5 24 H43 A19 17 0 0 1 5 24Z" fill="#C9623F"/><ellipse cx="24" cy="24" rx="19" ry="4.5" fill="#E8A33D"/><circle cx="17" cy="23" r="2" fill="#6F9A52"/><circle cx="25" cy="24.5" r="2.2" fill="#6F9A52"/><circle cx="31" cy="22.5" r="1.8" fill="#FBF0DC"/><path d="M16 17 Q13 13 16 9 M24 17 Q21 13 24 9 M32 17 Q29 13 32 9" stroke="#C7BBA8" stroke-width="1.5" stroke-linecap="round"/><rect x="14" y="40" width="20" height="3" rx="1.5" fill="#B24E30"/>`,
  ),
  italian: wrap(
    `<path d="M5 26 H43 A19 15 0 0 1 5 26Z" fill="#8FC3A2"/><path d="M9 26 Q13 16 17 26 T25 26 T33 26 T41 26" stroke="#EBC768" stroke-width="3.2" stroke-linecap="round"/><path d="M12 21 Q16 12 20 21 T28 21 T36 21" stroke="#EBC768" stroke-width="3.2" stroke-linecap="round"/><circle cx="31" cy="15" r="5" fill="#D2604F"/><ellipse cx="36" cy="10" rx="4.5" ry="2.4" fill="#5E8A4A" transform="rotate(-30 36 10)"/>`,
  ),
  japanese: wrap(
    `<path d="M5 33 Q5 25 12 25 H36 Q43 25 43 33 Q43 40 36 40 H12 Q5 40 5 33Z" fill="#FBF0DC" stroke="#CDB98F" stroke-width="1.5"/><path d="M3 28 Q24 6 45 28 Q24 34 3 28Z" fill="#EE8B6E"/><path d="M13 22 Q15 27 14 29 M22 17 Q24 24 23 30 M31 19 Q33 25 32 29" stroke="#FBD7C8" stroke-width="2" stroke-linecap="round"/>`,
  ),
  korean: wrap(
    `<circle cx="24" cy="24" r="21" fill="#5A4636"/><circle cx="24" cy="24" r="17" fill="#FBF0DC"/><path d="M24 24 L24 9 A15 15 0 0 1 37 16.5Z" fill="#7FA35A"/><path d="M24 24 L37 16.5 A15 15 0 0 1 37 31.5Z" fill="#E58A3A"/><path d="M24 24 L37 31.5 A15 15 0 0 1 24 39Z" fill="#8B5E3C"/><path d="M24 24 L24 39 A15 15 0 0 1 11 31.5Z" fill="#E9DDA8"/><path d="M24 24 L11 31.5 A15 15 0 0 1 11 16.5Z" fill="#D2604F"/><path d="M24 24 L11 16.5 A15 15 0 0 1 24 9Z" fill="#4E7A3E"/><circle cx="24" cy="24" r="7" fill="#FFFFFF" stroke="#E4D8C0" stroke-width="1"/><circle cx="24" cy="24" r="3.5" fill="#F2B134"/>`,
  ),
  mediterranean: wrap(
    `<path d="M5 41 Q22 32 41 7" stroke="#7A6A4A" stroke-width="2" stroke-linecap="round"/><ellipse cx="12" cy="32" rx="7" ry="2.8" fill="#7C9A52" transform="rotate(-30 12 32)"/><ellipse cx="19" cy="25" rx="7" ry="2.8" fill="#7C9A52" transform="rotate(-50 19 25)"/><ellipse cx="27" cy="19" rx="7" ry="2.8" fill="#7C9A52" transform="rotate(-35 27 19)"/><ellipse cx="34" cy="12" rx="6" ry="2.5" fill="#7C9A52" transform="rotate(-55 34 12)"/><ellipse cx="30" cy="33" rx="5.5" ry="7" fill="#5A4660" transform="rotate(20 30 33)"/><ellipse cx="39" cy="35" rx="5" ry="6.5" fill="#6B5A74" transform="rotate(-15 39 35)"/><circle cx="28.5" cy="30" r="1.4" fill="#A596AE"/><circle cx="37.8" cy="32.5" r="1.3" fill="#A596AE"/>`,
  ),
  mexican: wrap(
    `<path d="M6 22 Q9 12 13 18 T21 17 T29 17 T37 17 T42 21" stroke="#6FA253" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="14" r="3" fill="#D2604F"/><circle cx="29" cy="13" r="3" fill="#D2604F"/><circle cx="36" cy="15" r="2.5" fill="#F2B134"/><path d="M4 40 A20 20 0 0 1 44 40Z" fill="#EBC768"/><path d="M10 40 A14 14 0 0 1 38 40" stroke="#C9A245" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
  thai: wrap(
    `<circle cx="33" cy="32" r="12" fill="#9BCB5A"/><circle cx="33" cy="32" r="9.5" fill="#E7F2B8"/><path d="M33 22.5 V41.5 M23.5 32 H42.5 M26.3 25.3 L39.7 38.7 M39.7 25.3 L26.3 38.7" stroke="#9BCB5A" stroke-width="1.2"/><path d="M12 10 Q34 5 20 38" stroke="#D2453B" stroke-width="7" stroke-linecap="round"/><path d="M12 10 L6 6" stroke="#4E7A3E" stroke-width="3.5" stroke-linecap="round"/>`,
  ),
  vietnamese: wrap(
    `<path d="M5 24 H43 A19 17 0 0 1 5 24Z" fill="#7FB3D1"/><ellipse cx="24" cy="24" rx="19" ry="4.5" fill="#EAC98A"/><circle cx="16" cy="23.5" r="3" fill="#E2A3A3"/><circle cx="24" cy="25" r="3" fill="#E2A3A3"/><ellipse cx="31" cy="22" rx="4" ry="2.2" fill="#6F9A52" transform="rotate(-20 31 22)"/><ellipse cx="35" cy="24" rx="3" ry="1.8" fill="#4E7A3E"/><path d="M30 4 L38 22 M35 3 L42 20" stroke="#A5784B" stroke-width="2" stroke-linecap="round"/>`,
  ),
};

/** A cuisine's picture. Decoration only: the tile carries the name, so a screen reader skips it. */
export function CuisineIcon({ cuisine, size }: { cuisine: CuisineKey; size: number }) {
  return (
    <SvgXml
      xml={CUISINE_ART[cuisine]}
      width={size}
      height={size}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
