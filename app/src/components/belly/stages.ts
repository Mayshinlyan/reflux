import type { BellieStage } from '@/lib/bellieStage';
import type { BellyMood } from '@/lib/belly';

import { BELLY_BODY, BELLY_SVG } from './moods';

// The growth stages of the Bellie (Figma "Belly growth", 2026-11-12). "Little" is the four mood SVGs in moods.ts; the
// other four are exported from Figma as a body plus one face fragment per mood, so a stage and a mood can be combined
// without twenty whole drawings. Coordinates are the SVG's own units (the art is drawn at about 1.3 times the "Little").

type Box = { x: number; y: number; width: number; height: number };

export type StageArt = {
  /** The SVG's width and height in its own units. */
  width: number;
  height: number;
  /** The body (the head and belly), without the sprout, limbs or the face. */
  body: Box;
  /** The eyes: the centre of each and their height. */
  eyes: { left: number; right: number; y: number };
};

type Drawing = StageArt & { open: string; faces: Record<BellyMood, string> };

const DRAWINGS: Record<Exclude<BellieStage, 'little'>, Drawing> = {
  baby: {
    width: 144,
    height: 156,
    body: { x: 9, y: 36.5, width: 126, height: 105 },
    eyes: { left: 51.9, right: 92.1, y: 91.5 },
    open: `<svg width="144" height="156" viewBox="0 0 144 156" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M71.99 41.5C46.99 39.5 37.99 20.5 43.99 2.5C66.99 2.5 83.99 18.5 71.99 41.5Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M72 41.5C64.66 30.16 57.66 20.83 51 13.5" stroke="#896347" stroke-width="3" stroke-linecap="round"/>
<path d="M72.0 36.5C104.0 36.5 132.0 60.5 135.0 95.5C138.0 124.5 113.0 141.5 72.0 141.5C31.0 141.5 6.0 124.5 9.0 95.5C12.0 60.5 40.0 36.5 72.0 36.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M27.0 73.49C35.0 53.49 54.0 44.49 69.0 46.49C51.0 53.49 41.0 67.49 37.0 84.49C33.0 92.49 20.0 87.49 27.0 73.49Z" fill="#FFEED6"/>
<path d="M34 113.5C40.62 113.5 46 110.36 46 106.5C46 102.63 40.62 99.5 34 99.5C27.37 99.5 22 102.63 22 106.5C22 110.36 27.37 113.5 34 113.5Z" fill="#EFA5A0"/>
<path d="M110 113.5C116.62 113.5 122 110.36 122 106.5C122 102.63 116.62 99.5 110 99.5C103.37 99.5 98 102.63 98 106.5C98 110.36 103.37 113.5 110 113.5Z" fill="#EFA5A0"/>
`,
    faces: {
      happy: `<path d="M41 93.5C47 86.16 53 86.16 59 93.5M85 93.5C91 86.16 97 86.16 103 93.5" stroke="#896347" stroke-width="4" stroke-linecap="round"/>
<path d="M65 107.5C69.66 112.83 74.33 112.83 79 107.5" stroke="#896347" stroke-width="3.5" stroke-linecap="round"/>
`,
      okay: `<ellipse cx="51.9" cy="91.5" rx="5.39" ry="6.22" fill="#49382E"/>
<ellipse cx="92.1" cy="91.5" rx="5.39" ry="6.22" fill="#49382E"/>
<path d="M62.86 107.84C68.67 111.16 75.31 111.16 81.12 107.84" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
`,
      caution: `<ellipse cx="51.9" cy="91.5" rx="5.39" ry="6.22" fill="#49382E"/>
<ellipse cx="92.1" cy="91.5" rx="5.39" ry="6.22" fill="#49382E"/>
<path d="M58.72 107.83C62.87 101.19 67.85 101.19 72.0 107.83C76.15 114.47 81.13 114.47 85.28 107.83" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M120.94 58.30C128.41 69.09 128.41 78.22 120.94 83.20C113.47 78.22 113.47 69.09 120.94 58.30Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="2.49" stroke-linecap="round" stroke-linejoin="round"/>
`,
      avoid: `<ellipse cx="51.9" cy="91.5" rx="5.39" ry="6.22" fill="#49382E"/>
<ellipse cx="92.1" cy="91.5" rx="5.39" ry="6.22" fill="#49382E"/>
<path d="M40.27 76.55L63.51 68.25" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M103.72 76.55L80.48 68.25" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M58.72 110.32C65.36 100.36 78.64 100.36 85.28 110.32" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M120.94 58.30C128.41 69.09 128.41 78.22 120.94 83.20C113.47 78.22 113.47 69.09 120.94 58.30Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="2.49" stroke-linecap="round" stroke-linejoin="round"/>
`,
    },
  },
  kid: {
    width: 230,
    height: 281,
    body: { x: 22.5, y: 56.5, width: 185, height: 192 },
    eyes: { left: 83.29, right: 145.69, y: 146.5 },
    open: `<svg width="230" height="281" viewBox="0 0 230 281" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M65.85 220.5C57.85 233.5 48.85 256.5 61.85 265.5C77.85 275.5 91.85 257.5 93.85 234.5L65.85 220.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M135.85 234.5C137.85 257.5 151.85 275.5 167.85 265.5C180.85 256.5 171.85 233.5 163.85 220.5L135.85 234.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M37.85 143.5C13.85 147.5 -4.14 171.5 4.85 182.5C14.85 194.5 34.85 179.5 47.85 167.5L37.85 143.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M191.85 143.5C215.85 147.5 233.85 171.5 224.85 182.5C214.85 194.5 194.85 179.5 181.85 167.5L191.85 143.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M113.85 65.50C86.85 65.5 63.85 49.5 64.85 27.50C89.85 22.5 109.85 37.5 113.85 65.50Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M113.85 57.5C96.85 38.5 100.85 15.5 116.85 2.5C133.85 18.5 135.85 41.5 113.85 57.5Z" fill="#B8D68E" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M114.85 65.5C115.85 37.5 139.85 24.5 164.85 31.5C160.85 57.5 139.85 68.5 114.85 65.5Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M116.85 18.5L113.85 65.5L77.85 37.5M114.85 65.5L149.85 41.5" stroke="#896347" stroke-width="3" stroke-linecap="round"/>
<path d="M114.85 56.5C149.85 56.5 177.85 89.5 195.85 134.5C209.85 168.5 212.85 203.5 192.85 224.5C174.85 243.5 143.85 248.5 114.85 248.5C85.85 248.5 54.85 243.5 36.85 224.5C16.85 203.5 19.85 168.5 33.85 134.5C51.85 89.5 79.85 56.5 114.85 56.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M43.85 134.5C55.85 98.5 75.85 76.5 100.85 70.5C75.85 88.5 66.85 112.5 59.85 137.5C55.85 150.5 38.85 147.5 43.85 134.5Z" fill="#FFEED6"/>
<path d="M59.85 178.5C69.24 178.5 76.85 174.02 76.85 168.5C76.85 162.97 69.24 158.5 59.85 158.5C50.46 158.5 42.85 162.97 42.85 168.5C42.85 174.02 50.46 178.5 59.85 178.5Z" fill="#EFA5A0"/>
<path d="M169.85 178.5C179.24 178.5 186.85 174.02 186.85 168.5C186.85 162.97 179.24 158.5 169.85 158.5C160.46 158.5 152.85 162.97 152.85 168.5C152.85 174.02 160.46 178.5 169.85 178.5Z" fill="#EFA5A0"/>
`,
    faces: {
      happy: `<path d="M66.85 149.5C74.85 139.5 82.85 139.5 90.85 149.5M138.85 149.5C146.85 139.5 154.85 139.5 162.85 149.5" stroke="#896347" stroke-width="5" stroke-linecap="round"/>
<path d="M101.85 170.5C110.52 174.5 119.18 174.5 127.85 170.5C125.85 193.5 103.85 193.5 101.85 170.5Z" fill="#EFA5A0" stroke="#896347" stroke-width="4" stroke-linejoin="round"/>
`,
      okay: `<ellipse cx="83.29" cy="146.5" rx="7.93" ry="9.15" fill="#49382E"/>
<ellipse cx="145.69" cy="146.5" rx="7.93" ry="9.15" fill="#49382E"/>
<path d="M101.07 176.56C109.61 181.44 119.37 181.44 127.91 176.56" stroke="#49382E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
`,
      caution: `<ellipse cx="83.29" cy="146.5" rx="7.93" ry="9.15" fill="#49382E"/>
<ellipse cx="145.69" cy="146.5" rx="7.93" ry="9.15" fill="#49382E"/>
<path d="M94.97 176.56C101.07 166.8 108.39 166.8 114.49 176.56C120.59 186.32 127.91 186.32 134.01 176.56" stroke="#49382E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M188.09 97.69C199.07 113.55 199.07 126.97 188.09 134.29C177.11 126.97 177.11 113.55 188.09 97.69Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="3.66" stroke-linecap="round" stroke-linejoin="round"/>
`,
      avoid: `<ellipse cx="83.29" cy="146.5" rx="7.93" ry="9.15" fill="#49382E"/>
<ellipse cx="145.69" cy="146.5" rx="7.93" ry="9.15" fill="#49382E"/>
<path d="M66.21 124.54L100.37 112.34" stroke="#49382E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M162.77 124.54L128.61 112.34" stroke="#49382E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M94.97 180.22C104.73 165.58 124.25 165.58 134.01 180.22" stroke="#49382E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M188.09 97.69C199.07 113.55 199.07 126.97 188.09 134.29C177.11 126.97 177.11 113.55 188.09 97.69Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="3.66" stroke-linecap="round" stroke-linejoin="round"/>
`,
    },
  },
  teenager: {
    width: 211,
    height: 384,
    body: { x: 18.56, y: 105.5, width: 169, height: 207 },
    eyes: { left: 70.56, right: 136.56, y: 209.5 },
    open: `<svg width="211" height="384" viewBox="0 0 211 384" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M64.56 287.5C65.56 313.5 62.56 333.5 56.56 348.5C44.56 350.5 39.56 356.5 43.56 363.5C47.56 372.5 70.56 372.5 77.56 362.5C85.56 344.5 88.56 317.5 87.56 293.5L64.56 287.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M120.56 294.5C119.56 319.5 124.56 345.5 132.56 362.5C139.56 372.5 162.56 372.5 166.56 363.5C170.56 356.5 165.56 350.5 153.56 348.5C147.56 332.5 144.56 311.5 146.56 286.5L120.56 294.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M27.56 190.5C11.56 213.5 1.56 244.5 2.56 270.5C2.56 285.5 12.56 294.5 20.56 286.5C24.56 282.5 23.56 273.5 24.56 267.5C26.56 245.5 38.56 223.5 48.56 208.5L27.56 190.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M178.56 189.5C194.56 206.5 207.56 232.5 207.56 253.5C207.56 269.5 191.56 280.5 184.56 270.5C179.56 264.5 187.56 258.5 185.56 250.5C182.56 235.5 172.56 220.5 161.56 211.5L178.56 189.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M103.56 115.5C102.56 88.5 111.56 61.5 103.56 36.5" stroke="#896347" stroke-width="6" stroke-linecap="round"/>
<path d="M105.56 94.49C81.56 99.49 60.56 81.49 59.56 60.49C83.56 55.49 103.56 70.49 105.56 94.49Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M107.56 73.50C111.56 48.5 132.56 38.5 154.56 44.50C151.56 67.5 130.56 78.5 107.56 73.50Z" fill="#B8D68E" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M104.56 44.5C84.56 37.5 76.56 19.5 84.56 2.5C106.56 6.5 118.56 26.5 104.56 44.5Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M105.56 94.5L72.56 70.5M107.56 73.5L140.56 53.5" stroke="#896347" stroke-width="3" stroke-linecap="round"/>
<path d="M103.56 105.5C122.56 119.5 137.56 126.5 153.56 150.5C178.56 186.5 193.56 232.5 186.56 266.5C180.56 297.5 149.56 312.5 103.56 312.5C57.56 312.5 26.56 297.5 20.56 266.5C13.56 232.5 28.56 186.5 53.56 150.5C69.56 126.5 84.56 119.5 103.56 105.5Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M39.56 212.5C47.56 176.5 68.56 144.5 89.56 132.5C69.56 157.5 60.56 183.5 55.56 214.5C53.56 226.5 36.56 225.5 39.56 212.5Z" fill="#FFEED6"/>
<path d="M51.56 241.5C59.85 241.5 66.56 237.47 66.56 232.5C66.56 227.52 59.85 223.5 51.56 223.5C43.28 223.5 36.56 227.52 36.56 232.5C36.56 237.47 43.28 241.5 51.56 241.5Z" fill="#EFA5A0"/>
<path d="M155.56 241.5C163.85 241.5 170.56 237.47 170.56 232.5C170.56 227.52 163.85 223.5 155.56 223.5C147.28 223.5 140.56 227.52 140.56 232.5C140.56 237.47 147.28 241.5 155.56 241.5Z" fill="#EFA5A0"/>
`,
    faces: {
      happy: `<path d="M56.56 188.49C64.56 183.83 72.23 182.83 79.56 185.49M127.56 185.49C134.9 182.83 142.56 183.83 150.56 188.49" stroke="#896347" stroke-width="4" stroke-linecap="round"/>
<path d="M70.56 219.5C74.43 219.5 77.56 215.02 77.56 209.5C77.56 203.97 74.43 199.5 70.56 199.5C66.7 199.5 63.56 203.97 63.56 209.5C63.56 215.02 66.7 219.5 70.56 219.5Z" fill="#49382E"/>
<path d="M136.56 219.5C140.43 219.5 143.56 215.02 143.56 209.5C143.56 203.97 140.43 199.5 136.56 199.5C132.7 199.5 129.56 203.97 129.56 209.5C129.56 215.02 132.7 219.5 136.56 219.5Z" fill="#49382E"/>
<path d="M91.56 235.5C99.56 244.16 107.56 244.16 115.56 235.5" stroke="#896347" stroke-width="4" stroke-linecap="round"/>
`,
      okay: `<ellipse cx="70.56" cy="209.5" rx="7.21" ry="8.32" fill="#49382E"/>
<ellipse cx="136.56" cy="209.5" rx="7.21" ry="8.32" fill="#49382E"/>
<path d="M91.35 236.77C99.12 241.21 108.0 241.21 115.77 236.77" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
`,
      caution: `<ellipse cx="70.56" cy="209.5" rx="7.21" ry="8.32" fill="#49382E"/>
<ellipse cx="136.56" cy="209.5" rx="7.21" ry="8.32" fill="#49382E"/>
<path d="M85.8 236.77C91.35 227.89 98.01 227.89 103.56 236.77C109.11 245.65 115.77 245.65 121.32 236.77" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M175.14 165.1C185.13 179.53 185.13 191.74 175.14 198.4C165.15 191.74 165.15 179.53 175.14 165.1Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="3.33" stroke-linecap="round" stroke-linejoin="round"/>
`,
      avoid: `<ellipse cx="70.56" cy="209.5" rx="7.21" ry="8.32" fill="#49382E"/>
<ellipse cx="136.56" cy="209.5" rx="7.21" ry="8.32" fill="#49382E"/>
<path d="M55.02 189.52L86.1 178.42" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M152.1 189.52L121.02 178.42" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M85.8 240.10C94.68 226.78 112.44 226.78 121.32 240.1" stroke="#49382E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M175.14 165.1C185.13 179.53 185.13 191.74 175.14 198.4C165.15 191.74 165.15 179.53 175.14 165.1Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="3.33" stroke-linecap="round" stroke-linejoin="round"/>
`,
    },
  },
  adult: {
    width: 264,
    height: 441,
    body: { x: 37.55, y: 106.25, width: 188, height: 249 },
    eyes: { left: 98.99, right: 163.99, y: 243.24 },
    open: `<svg width="264" height="441" viewBox="0 0 264 441" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M94.55 332.25C95.55 361.25 92.55 389.25 86.55 409.25C74.55 410.25 68.55 416.25 73.55 422.25C79.55 429.25 99.55 428.25 106.55 420.25C113.55 399.25 116.55 366.25 116.55 336.25L94.55 332.25Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M146.55 336.25C146.55 366.25 149.55 399.25 156.55 420.25C163.55 428.25 183.55 429.25 189.55 422.25C194.55 416.25 188.55 410.25 176.55 409.25C170.55 389.25 167.55 361.25 168.55 332.25L146.55 336.25Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M56.55 215.25C38.55 241.25 29.55 273.25 17.55 293.25C12.55 298.25 3.55 297.25 2.55 305.25C1.55 315.25 14.55 318.25 24.55 311.25C44.55 294.25 58.55 260.25 74.55 235.25L56.55 215.25Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M206.55 215.25C224.55 241.25 233.55 273.25 245.55 293.25C250.55 298.25 259.55 297.25 260.55 305.25C261.55 315.25 248.55 318.25 238.55 311.25C218.55 294.25 204.55 260.25 188.55 235.25L206.55 215.25Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M131.55 114.25C120.55 85.25 143.55 59.25 134.55 27.25" stroke="#896347" stroke-width="6" stroke-linecap="round"/>
<path d="M130.55 97.24C105.55 102.25 82.55 87.24 78.55 65.24C103.55 58.24 127.55 71.24 130.55 97.24Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M132.55 82.25C140.55 57.25 163.55 48.25 188.55 56.25C181.55 80.25 159.55 91.25 132.55 82.25Z" fill="#92B971" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M136.55 58.24C110.55 59.24 95.55 43.24 96.55 23.24C119.55 20.24 139.55 33.24 136.55 58.24Z" fill="#B8D68E" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M130.55 97.25L92.55 74.25M132.55 82.25L173.55 64.25M136.55 58.25L108.55 32.25" stroke="#896347" stroke-width="3" stroke-linecap="round"/>
<path d="M134.55 31.25C120.55 27.25 120.55 12.25 133.55 2.25C148.55 5.25 154.55 20.25 143.55 29.25C140.88 31.91 137.88 32.58 134.55 31.25Z" fill="#EFA5A0" stroke="#896347" stroke-width="4.5" stroke-linejoin="round"/>
<path d="M134.55 33.25L128.55 23.25L137.55 27.25L147.55 23.25L142.55 34.25L134.55 33.25Z" fill="#92B971" stroke="#896347" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M131.55 106.25C143.55 129.25 167.55 143.25 185.55 170.25C211.55 208.25 230.55 255.25 224.55 296.25C219.55 335.25 181.55 355.25 131.55 355.25C81.55 355.25 43.55 335.25 38.55 296.25C32.55 255.25 51.55 208.25 77.55 170.25C95.55 143.25 119.55 129.25 131.55 106.25Z" fill="#FCE3BD" stroke="#896347" stroke-width="5" stroke-linejoin="round"/>
<path d="M58.55 252.25C69.55 202.25 94.55 163.25 117.55 141.25C96.55 176.25 82.55 213.25 75.55 256.25C73.55 268.25 55.55 266.25 58.55 252.25Z" fill="#FFEED6"/>
<path d="M74.55 274.25C83.39 274.25 90.55 270.22 90.55 265.25C90.55 260.27 83.39 256.25 74.55 256.25C65.71 256.25 58.55 260.27 58.55 265.25C58.55 270.22 65.71 274.25 74.55 274.25Z" fill="#EFA5A0"/>
<path d="M188.55 274.25C197.39 274.25 204.55 270.22 204.55 265.25C204.55 260.27 197.39 256.25 188.55 256.25C179.71 256.25 172.55 260.27 172.55 265.25C172.55 270.22 179.71 274.25 188.55 274.25Z" fill="#EFA5A0"/>
`,
    faces: {
      happy: `<path d="M82.55 222.24C90.55 217.58 98.55 216.91 106.55 220.24M156.55 220.24C164.55 216.91 172.55 217.58 180.55 222.24" stroke="#896347" stroke-width="3.5" stroke-linecap="round"/>
<path d="M81.55 240.25C89.55 248.25 97.88 248.25 106.55 240.25M156.55 240.25C165.22 248.25 173.55 248.25 181.55 240.25" stroke="#896347" stroke-width="4.5" stroke-linecap="round"/>
<path d="M118.55 270.25C127.22 278.91 135.88 278.91 144.55 270.25" stroke="#896347" stroke-width="4" stroke-linecap="round"/>
`,
      okay: `<ellipse cx="98.99" cy="243.24" rx="8.06" ry="9.3" fill="#49382E"/>
<ellipse cx="163.99" cy="243.24" rx="8.06" ry="9.3" fill="#49382E"/>
<path d="M117.85 271.27C126.53 276.23 136.45 276.23 145.13 271.27" stroke="#49382E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
`,
      caution: `<ellipse cx="98.99" cy="243.24" rx="8.06" ry="9.3" fill="#49382E"/>
<ellipse cx="163.99" cy="243.24" rx="8.06" ry="9.3" fill="#49382E"/>
<path d="M111.66 271.27C117.86 261.35 125.3 261.35 131.5 271.27C137.7 281.19 145.14 281.19 151.34 271.27" stroke="#49382E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M207.09 193.65C218.25 209.77 218.25 223.41 207.09 230.85C195.93 223.41 195.93 209.77 207.09 193.65Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="3.72" stroke-linecap="round" stroke-linejoin="round"/>
`,
      avoid: `<ellipse cx="98.99" cy="243.24" rx="8.06" ry="9.3" fill="#49382E"/>
<ellipse cx="163.99" cy="243.24" rx="8.06" ry="9.3" fill="#49382E"/>
<path d="M81.64 220.92L116.36 208.52" stroke="#49382E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M181.36 220.92L146.64 208.52" stroke="#49382E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M111.66 274.99C121.58 260.11 141.42 260.11 151.34 274.99" stroke="#49382E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M207.09 193.65C218.25 209.77 218.25 223.41 207.09 230.85C195.93 223.41 195.93 209.77 207.09 193.65Z" fill="#A9D3EA" stroke="#7FB0CF" stroke-width="3.72" stroke-linecap="round" stroke-linejoin="round"/>
`,
    },
  },
};

/** The "Little" is the 120 box of moods.ts: its body is `BELLY_BODY`, its eyes where the mood faces put them. */
const LITTLE: StageArt = {
  width: 120,
  height: 120,
  body: { x: BELLY_BODY.x, y: BELLY_BODY.y, width: BELLY_BODY.width, height: BELLY_BODY.height },
  eyes: { left: 44.8, right: 75, y: 66.8 },
};

/** The drawing's size and where its body and eyes sit, in its own units. */
export function stageArt(stage: BellieStage): StageArt {
  return stage === 'little' ? LITTLE : DRAWINGS[stage];
}

const LEAF_GREENS = ['#92B971', '#B8D68E'];

/**
 * The drawing without its sprout: the leaves, their veins and the stem (and the bud an adult has) are the run of
 * lines from the first leaf up to the body, plus the stem line just before it. Used under a hat, which the leaf
 * would otherwise poke out over.
 */
export function withoutSprout(xml: string): string {
  const lines = xml.split('\n');
  const first = lines.findIndex((line) => LEAF_GREENS.some((green) => line.includes(`fill="${green}"`)));
  if (first < 0) return xml;
  const body = lines.findIndex((line, i) => i > first && line.includes('fill="#FCE3BD"'));
  if (body < 0) return xml;
  const from = first > 0 && !lines[first - 1].includes('fill=') ? first - 1 : first;
  return [...lines.slice(0, from), ...lines.slice(body)].join('\n');
}

/** The whole SVG for a stage with a mood's face; `sprout: false` leaves the sprout off (under a hat). */
export function bellySvg(stage: BellieStage, mood: BellyMood, sprout = true): string {
  const xml =
    stage === 'little' ? BELLY_SVG[mood] : `${DRAWINGS[stage].open}${DRAWINGS[stage].faces[mood]}</svg>`;
  return sprout ? xml : withoutSprout(xml);
}

/**
 * How tall each stage is drawn, as a share of the box a Belly is given (the Adult fills it). The real proportions
 * (a baby is a third of the adult) would leave a baby too small to see on Today, so the steps are closer together.
 */
export const STAGE_HEIGHT: Record<BellieStage, number> = {
  baby: 0.62,
  little: 0.8,
  kid: 0.88,
  teenager: 0.95,
  adult: 1,
};

export type BellyLayout = {
  /** How big the drawing is on screen, and where, inside the square box of `size` (centred, standing on its bottom edge). */
  width: number;
  height: number;
  left: number;
  top: number;
  /** One SVG unit in pixels. */
  scale: number;
  /** The body and the eyes in pixels inside that box, for anything worn on top. */
  body: Box;
  eyes: { left: number; right: number; y: number };
};

export function bellyLayout(stage: BellieStage, size: number): BellyLayout {
  const art = stageArt(stage);
  const height = size * STAGE_HEIGHT[stage];
  const scale = height / art.height;
  const width = art.width * scale;
  const left = (size - width) / 2;
  const top = size - height;
  return {
    width,
    height,
    left,
    top,
    scale,
    body: {
      x: left + art.body.x * scale,
      y: top + art.body.y * scale,
      width: art.body.width * scale,
      height: art.body.height * scale,
    },
    eyes: {
      left: left + art.eyes.left * scale,
      right: left + art.eyes.right * scale,
      y: top + art.eyes.y * scale,
    },
  };
}
