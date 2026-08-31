import type { Mascot } from "../types";

export const MASCOTS: Mascot[] = [
  {
    name: "Pal",
    role: "Organized, personable, keeps the team on schedule",
    color: "#a8bede",
    ground: "rgba(168,190,222,0.3)",
    fact: "Pal runs the business side — sponsor outreach, the budget, and the competition logistics. Writes a thank-you note for every donation, no matter how small.",
    svg: `<svg viewBox="0 0 120 140" width="160" height="187" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="132" rx="28" ry="7" fill="#7aa8d4" opacity="0.35"/>
      <path d="M78 100 Q100 95 105 80 Q110 65 95 60" fill="none" stroke="#8ab0d8" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="60" cy="95" rx="28" ry="30" fill="#b4c8e8"/>
      <ellipse cx="60" cy="95" rx="28" ry="30" fill="none" stroke="#2c3a58" stroke-width="1.5"/>
      <ellipse cx="60" cy="100" rx="16" ry="18" fill="#ddeaf8"/>
      <ellipse cx="60" cy="58" rx="26" ry="24" fill="#b4c8e8"/>
      <ellipse cx="60" cy="58" rx="26" ry="24" fill="none" stroke="#2c3a58" stroke-width="1.5"/>
      <polygon points="38,40 32,22 46,36" fill="#b4c8e8" stroke="#2c3a58" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="82,40 88,22 74,36" fill="#b4c8e8" stroke="#2c3a58" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="39,39 34,26 44,36" fill="#dbb8c8"/>
      <polygon points="81,39 86,26 76,36" fill="#dbb8c8"/>
      <ellipse cx="50" cy="56" rx="6" ry="6.5" fill="white" stroke="#2c3a58" stroke-width="1.2"/>
      <ellipse cx="70" cy="56" rx="6" ry="6.5" fill="white" stroke="#2c3a58" stroke-width="1.2"/>
      <circle cx="51" cy="57" r="3.5" fill="#2c3a58"/>
      <circle cx="71" cy="57" r="3.5" fill="#2c3a58"/>
      <circle cx="52" cy="55.5" r="1.2" fill="white"/>
      <circle cx="72" cy="55.5" r="1.2" fill="white"/>
      <ellipse cx="60" cy="64" rx="3" ry="2" fill="#e8a0b8"/>
      <path d="M57 67 Q60 70 63 67" stroke="#2c3a58" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <line x1="34" y1="63" x2="50" y2="65" stroke="#2c3a58" stroke-width="1" opacity="0.5"/>
      <line x1="34" y1="67" x2="50" y2="67" stroke="#2c3a58" stroke-width="1" opacity="0.5"/>
      <line x1="86" y1="63" x2="70" y2="65" stroke="#2c3a58" stroke-width="1" opacity="0.5"/>
      <line x1="86" y1="67" x2="70" y2="67" stroke="#2c3a58" stroke-width="1" opacity="0.5"/>
      <ellipse cx="42" cy="122" rx="10" ry="8" fill="#b4c8e8" stroke="#2c3a58" stroke-width="1.2"/>
      <ellipse cx="78" cy="122" rx="10" ry="8" fill="#b4c8e8" stroke="#2c3a58" stroke-width="1.2"/>
      <rect x="44" y="106" width="32" height="18" rx="3" fill="#ddeaf8" stroke="#2c3a58" stroke-width="1.2"/>
      <rect x="46" y="108" width="28" height="12" rx="2" fill="#a8bede" opacity="0.7"/>
      <line x1="48" y1="110" x2="68" y2="110" stroke="#ddeaf8" stroke-width="1" opacity="0.8"/>
      <line x1="48" y1="113" x2="62" y2="113" stroke="#ddeaf8" stroke-width="1" opacity="0.8"/>
      <line x1="48" y1="116" x2="66" y2="116" stroke="#ddeaf8" stroke-width="1" opacity="0.8"/>
    </svg>`,
  },
  {
    name: "Xaivian",
    role: "Precise, curious, a quiet perfectionist",
    color: "#bfa8d8",
    ground: "rgba(191,168,216,0.3)",
    fact: "Xaivian writes the cleanest code on the team — main author of the swerve drive base — and names every variable something cute. Debugs autonomous routines until they are perfect.",
    svg: `<svg viewBox="0 0 120 150" width="160" height="200" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="143" rx="28" ry="7" fill="#9a7ec0" opacity="0.35"/>
      <ellipse cx="42" cy="28" rx="9" ry="22" fill="#c8b0e0" stroke="#2c3a58" stroke-width="1.5"/>
      <ellipse cx="78" cy="28" rx="9" ry="22" fill="#c8b0e0" stroke="#2c3a58" stroke-width="1.5"/>
      <ellipse cx="42" cy="28" rx="5" ry="16" fill="#e8c0d8"/>
      <ellipse cx="78" cy="28" rx="5" ry="16" fill="#e8c0d8"/>
      <ellipse cx="60" cy="102" rx="30" ry="33" fill="#c8b0e0"/>
      <ellipse cx="60" cy="102" rx="30" ry="33" fill="none" stroke="#2c3a58" stroke-width="1.5"/>
      <ellipse cx="60" cy="108" rx="17" ry="20" fill="#e8daf5"/>
      <ellipse cx="60" cy="64" rx="27" ry="25" fill="#c8b0e0"/>
      <ellipse cx="60" cy="64" rx="27" ry="25" fill="none" stroke="#2c3a58" stroke-width="1.5"/>
      <path d="M47 62 Q50 58 53 62" stroke="#2c3a58" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M67 62 Q70 58 73 62" stroke="#2c3a58" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="68" rx="7" ry="5" fill="#f0a0c0" opacity="0.45"/>
      <ellipse cx="76" cy="68" rx="7" ry="5" fill="#f0a0c0" opacity="0.45"/>
      <ellipse cx="60" cy="70" rx="4" ry="3" fill="#f0a0c0"/>
      <path d="M56 73 Q60 77 64 73" stroke="#2c3a58" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="30" cy="100" rx="9" ry="14" fill="#c8b0e0" stroke="#2c3a58" stroke-width="1.2"/>
      <ellipse cx="90" cy="100" rx="9" ry="14" fill="#c8b0e0" stroke="#2c3a58" stroke-width="1.2"/>
      <g transform="translate(84,113) rotate(-30)">
        <rect x="-3" y="-12" width="6" height="22" rx="2" fill="#8a8a9a" stroke="#2c3a58" stroke-width="1"/>
        <rect x="-6" y="-14" width="12" height="6" rx="2" fill="#8a8a9a" stroke="#2c3a58" stroke-width="1"/>
        <rect x="-6" y="-16" width="5" height="4" rx="1" fill="#2c3a58" opacity="0.3"/>
        <rect x="1" y="-16" width="5" height="4" rx="1" fill="#2c3a58" opacity="0.3"/>
      </g>
      <ellipse cx="46" cy="133" rx="13" ry="8" fill="#c8b0e0" stroke="#2c3a58" stroke-width="1.2"/>
      <ellipse cx="74" cy="133" rx="13" ry="8" fill="#c8b0e0" stroke="#2c3a58" stroke-width="1.2"/>
    </svg>`,
  },
  {
    name: "Stuffing",
    role: "Hands-on, practical, thinks with a wrench",
    color: "#a4c9b0",
    ground: "rgba(164,201,176,0.3)",
    fact: "Stuffing builds the mechanisms — drivetrain, intake, and everything that moves. Once fixed a broken intake arm with a zip tie and a prayer during a match, and it held.",
    svg: `<svg viewBox="0 0 120 140" width="160" height="187" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="133" rx="30" ry="7" fill="#6aaa80" opacity="0.35"/>
      <ellipse cx="60" cy="96" rx="32" ry="34" fill="#b0d0b8"/>
      <ellipse cx="60" cy="96" rx="32" ry="34" fill="none" stroke="#2c3a58" stroke-width="1.5"/>
      <ellipse cx="60" cy="102" rx="19" ry="22" fill="#d8eedd"/>
      <ellipse cx="60" cy="58" rx="28" ry="26" fill="#b0d0b8"/>
      <ellipse cx="60" cy="58" rx="28" ry="26" fill="none" stroke="#2c3a58" stroke-width="1.5"/>
      <circle cx="36" cy="36" r="11" fill="#b0d0b8" stroke="#2c3a58" stroke-width="1.5"/>
      <circle cx="84" cy="36" r="11" fill="#b0d0b8" stroke="#2c3a58" stroke-width="1.5"/>
      <circle cx="36" cy="36" r="6" fill="#d8eedd"/>
      <circle cx="84" cy="36" r="6" fill="#d8eedd"/>
      <ellipse cx="60" cy="66" rx="12" ry="10" fill="#d8eedd" stroke="#2c3a58" stroke-width="1.2"/>
      <circle cx="49" cy="54" r="5.5" fill="white" stroke="#2c3a58" stroke-width="1.2"/>
      <circle cx="71" cy="54" r="5.5" fill="white" stroke="#2c3a58" stroke-width="1.2"/>
      <circle cx="50" cy="55" r="3" fill="#2c3a58"/>
      <circle cx="72" cy="55" r="3" fill="#2c3a58"/>
      <circle cx="51" cy="53.5" r="1" fill="white"/>
      <circle cx="73" cy="53.5" r="1" fill="white"/>
      <ellipse cx="60" cy="63" rx="3.5" ry="2.5" fill="#2c3a58"/>
      <path d="M56 67 Q60 71 64 67" stroke="#2c3a58" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="62" rx="7" ry="5" fill="#f0b0b0" opacity="0.4"/>
      <ellipse cx="76" cy="62" rx="7" ry="5" fill="#f0b0b0" opacity="0.4"/>
      <ellipse cx="28" cy="96" rx="10" ry="16" fill="#b0d0b8" stroke="#2c3a58" stroke-width="1.2"/>
      <ellipse cx="92" cy="96" rx="10" ry="16" fill="#b0d0b8" stroke="#2c3a58" stroke-width="1.2"/>
      <g transform="translate(25,110)">
        <rect x="-7" y="-4" width="14" height="9" rx="3" fill="#5a6a80" stroke="#2c3a58" stroke-width="1"/>
        <circle cx="0" cy="-4" r="3" fill="#8a9ab0" stroke="#2c3a58" stroke-width="1"/>
        <circle cx="-3" cy="1" r="1.5" fill="#a4c9b0"/>
        <circle cx="3" cy="1" r="1.5" fill="#e87878"/>
      </g>
      <ellipse cx="45" cy="127" rx="13" ry="8" fill="#b0d0b8" stroke="#2c3a58" stroke-width="1.2"/>
      <ellipse cx="75" cy="127" rx="13" ry="8" fill="#b0d0b8" stroke="#2c3a58" stroke-width="1.2"/>
      <rect x="44" y="30" width="32" height="4" rx="2" fill="#a4c9b0" stroke="#2c3a58" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
];
