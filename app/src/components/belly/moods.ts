// From the Figma "Belly" component set (42:377), one SVG per mood: the peach-drop Bellie (the "Little" growth stage)
// with a leaf sprout and two small feet (2026-11-12). The art is drawn in a 120 unit box with a 2 unit margin all
// round (viewBox -2 -2 124 124) so the leaf tip and feet are not clipped; `BELLY_BODY` is where the body sits in the
// rendered 120 box.

/** Where the body sits in the 120 x 120 mood boxes, for anything worn on top of it (the hat). */
export const BELLY_BODY = { x: 15.8, y: 24.5, width: 88.5, height: 84.3 } as const;

export const BELLY_SVG = {
  happy: `<svg width="120" height="120" viewBox="-2 -2 124 124" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.98 99.55C25.77 106.15 26.97 117.56 37.18 118.76C46.19 120.56 50.99 111.56 49.79 104.35L35.98 99.55Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M70.2 104.35C69.0 111.56 73.8 120.56 82.81 118.76C93.02 117.56 94.22 106.15 84.01 99.55L70.2 104.35Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 27.50C43.18 26.3 34.78 14.29 37.18 1.08C53.99 -0.11 64.8 11.89 59.39 27.50Z" fill="#92B971" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 26.90C54.99 18.49 49.39 11.69 42.58 6.48" stroke="#896347" stroke-width="1.8" stroke-linecap="round"/>
<path d="M60.0 23.29C81.01 23.29 101.43 44.31 105.03 69.53C109.83 95.95 90.02 110.36 60.0 110.36C29.97 110.36 10.16 95.95 14.96 69.53C18.57 44.31 38.98 23.29 60.0 23.29Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M24.57 58.12C29.97 41.91 41.98 32.3 52.79 31.10C39.58 39.51 35.38 50.31 32.98 60.52C31.17 67.13 22.17 64.72 24.57 58.12Z" fill="#FFEED6"/>
<path d="M31.77 83.94C36.75 83.94 40.78 81.52 40.78 78.53C40.78 75.55 36.75 73.13 31.77 73.13C26.8 73.13 22.77 75.55 22.77 78.53C22.77 81.52 26.8 83.94 31.77 83.94Z" fill="#EFA5A0"/>
<path d="M88.22 83.94C93.19 83.94 97.22 81.52 97.22 78.53C97.22 75.55 93.19 73.13 88.22 73.13C83.24 73.13 79.21 75.55 79.21 78.53C79.21 81.52 83.24 83.94 88.22 83.94Z" fill="#EFA5A0"/>
<path d="M35.98 68.93C40.38 63.72 44.78 63.72 49.19 68.93M70.8 68.93C75.21 63.72 79.61 63.72 84.01 68.93" stroke="#896347" stroke-width="2.7" stroke-linecap="round"/>
<path d="M53.99 80.33C57.99 85.14 62.0 85.14 66.0 80.33" stroke="#896347" stroke-width="2.4" stroke-linecap="round"/>
</svg>`,
  okay: `<svg width="120" height="120" viewBox="-2 -2 124 124" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.98 99.55C25.77 106.15 26.97 117.56 37.18 118.76C46.19 120.56 50.99 111.56 49.79 104.35L35.98 99.55Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M70.2 104.35C69.0 111.56 73.8 120.56 82.81 118.76C93.02 117.56 94.22 106.15 84.01 99.55L70.2 104.35Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 27.50C43.18 26.3 34.78 14.29 37.18 1.08C53.99 -0.11 64.8 11.89 59.39 27.50Z" fill="#92B971" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 26.90C54.99 18.49 49.39 11.69 42.58 6.48" stroke="#896347" stroke-width="1.8" stroke-linecap="round"/>
<path d="M60.0 23.29C81.01 23.29 101.43 44.31 105.03 69.53C109.83 95.95 90.02 110.36 60.0 110.36C29.97 110.36 10.16 95.95 14.96 69.53C18.57 44.31 38.98 23.29 60.0 23.29Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M24.57 58.12C29.97 41.91 41.98 32.3 52.79 31.10C39.58 39.51 35.38 50.31 32.98 60.52C31.17 67.13 22.17 64.72 24.57 58.12Z" fill="#FFEED6"/>
<path d="M31.77 83.94C36.75 83.94 40.78 81.52 40.78 78.53C40.78 75.55 36.75 73.13 31.77 73.13C26.8 73.13 22.77 75.55 22.77 78.53C22.77 81.52 26.8 83.94 31.77 83.94Z" fill="#EFA5A0"/>
<path d="M88.22 83.94C93.19 83.94 97.22 81.52 97.22 78.53C97.22 75.55 93.19 73.13 88.22 73.13C83.24 73.13 79.21 75.55 79.21 78.53C79.21 81.52 83.24 83.94 88.22 83.94Z" fill="#EFA5A0"/>
<ellipse cx="44.27" cy="67.04" rx="3.9" ry="4.5" fill="#49382E"/>
<ellipse cx="75.49" cy="67.04" rx="3.9" ry="4.5" fill="#49382E"/>
<path d="M53.27 80.25C57.48 82.65 62.28 82.65 66.48 80.25" stroke="#49382E" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  caution: `<svg width="120" height="120" viewBox="-2 -2 124 124" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.98 99.55C25.77 106.15 26.97 117.56 37.18 118.76C46.19 120.56 50.99 111.56 49.79 104.35L35.98 99.55Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M70.2 104.35C69.0 111.56 73.8 120.56 82.81 118.76C93.02 117.56 94.22 106.15 84.01 99.55L70.2 104.35Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 27.50C43.18 26.3 34.78 14.29 37.18 1.08C53.99 -0.11 64.8 11.89 59.39 27.50Z" fill="#92B971" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 26.90C54.99 18.49 49.39 11.69 42.58 6.48" stroke="#896347" stroke-width="1.8" stroke-linecap="round"/>
<path d="M60.0 23.29C81.01 23.29 101.43 44.31 105.03 69.53C109.83 95.95 90.02 110.36 60.0 110.36C29.97 110.36 10.16 95.95 14.96 69.53C18.57 44.31 38.98 23.29 60.0 23.29Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M24.57 58.12C29.97 41.91 41.98 32.3 52.79 31.10C39.58 39.51 35.38 50.31 32.98 60.52C31.17 67.13 22.17 64.72 24.57 58.12Z" fill="#FFEED6"/>
<path d="M31.77 83.94C36.75 83.94 40.78 81.52 40.78 78.53C40.78 75.55 36.75 73.13 31.77 73.13C26.8 73.13 22.77 75.55 22.77 78.53C22.77 81.52 26.8 83.94 31.77 83.94Z" fill="#EFA5A0"/>
<path d="M88.22 83.94C93.19 83.94 97.22 81.52 97.22 78.53C97.22 75.55 93.19 73.13 88.22 73.13C83.24 73.13 79.21 75.55 79.21 78.53C79.21 81.52 83.24 83.94 88.22 83.94Z" fill="#EFA5A0"/>
<ellipse cx="44.27" cy="67.04" rx="3.9" ry="4.5" fill="#49382E"/>
<ellipse cx="75.49" cy="67.04" rx="3.9" ry="4.5" fill="#49382E"/>
<path d="M49.07 82.65C52.07 77.85 55.68 77.85 58.68 82.65C61.68 87.46 65.28 87.46 68.28 82.65" stroke="#49382E" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M96.35 43.03C101.76 50.83 101.76 57.44 96.35 61.04C90.95 57.44 90.95 50.83 96.35 43.03Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  avoid: `<svg width="120" height="120" viewBox="-2 -2 124 124" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.98 99.55C25.77 106.15 26.97 117.56 37.18 118.76C46.19 120.56 50.99 111.56 49.79 104.35L35.98 99.55Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M70.2 104.35C69.0 111.56 73.8 120.56 82.81 118.76C93.02 117.56 94.22 106.15 84.01 99.55L70.2 104.35Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 27.50C43.18 26.3 34.78 14.29 37.18 1.08C53.99 -0.11 64.8 11.89 59.39 27.50Z" fill="#92B971" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M59.39 26.90C54.99 18.49 49.39 11.69 42.58 6.48" stroke="#896347" stroke-width="1.8" stroke-linecap="round"/>
<path d="M60.0 23.29C81.01 23.29 101.43 44.31 105.03 69.53C109.83 95.95 90.02 110.36 60.0 110.36C29.97 110.36 10.16 95.95 14.96 69.53C18.57 44.31 38.98 23.29 60.0 23.29Z" fill="#FCE3BD" stroke="#896347" stroke-width="3.0" stroke-linejoin="round"/>
<path d="M24.57 58.12C29.97 41.91 41.98 32.3 52.79 31.10C39.58 39.51 35.38 50.31 32.98 60.52C31.17 67.13 22.17 64.72 24.57 58.12Z" fill="#FFEED6"/>
<path d="M31.77 83.94C36.75 83.94 40.78 81.52 40.78 78.53C40.78 75.55 36.75 73.13 31.77 73.13C26.8 73.13 22.77 75.55 22.77 78.53C22.77 81.52 26.8 83.94 31.77 83.94Z" fill="#EFA5A0"/>
<path d="M88.22 83.94C93.19 83.94 97.22 81.52 97.22 78.53C97.22 75.55 93.19 73.13 88.22 73.13C83.24 73.13 79.21 75.55 79.21 78.53C79.21 81.52 83.24 83.94 88.22 83.94Z" fill="#EFA5A0"/>
<ellipse cx="44.27" cy="67.04" rx="3.9" ry="4.5" fill="#49382E"/>
<ellipse cx="75.49" cy="67.04" rx="3.9" ry="4.5" fill="#49382E"/>
<path d="M35.86 56.23L52.67 50.23" stroke="#49382E" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M83.9 56.23L67.08 50.23" stroke="#49382E" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M49.07 86.86C53.87 79.65 63.48 79.65 68.28 86.86" stroke="#49382E" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M96.35 43.03C101.76 50.83 101.76 57.44 96.35 61.04C90.95 57.44 90.95 50.83 96.35 43.03Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
} as const;
