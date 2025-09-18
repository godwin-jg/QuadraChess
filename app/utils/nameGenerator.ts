const adjectives = [
  "Swift",
  "Bold",
  "Clever",
  "Brave",
  "Wise",
  "Fierce",
  "Noble",
  "Bright",
  "Sharp",
  "Quick",
  "Strong",
  "Calm",
  "Wild",
  "Silent",
  "Golden",
  "Silver",
  "Iron",
  "Steel",
  "Fire",
  "Ice",
  "Storm",
  "Thunder",
  "Lightning",
  "Shadow",
  "Mystic",
  "Ancient",
  "Royal",
  "Divine",
  "Epic",
  "Legendary",
  "Mighty",
];

const nouns = [
  "Knight",
  "Warrior",
  "Mage",
  "Rogue",
  "Paladin",
  "Archer",
  "Assassin",
  "Wizard",
  "Priest",
  "Monk",
  "Berserker",
  "Guardian",
  "Champion",
  "Hero",
  "Dragon",
  "Phoenix",
  "Tiger",
  "Wolf",
  "Eagle",
  "Lion",
  "Bear",
  "Fox",
  "Hawk",
  "Falcon",
  "Raven",
  "Owl",
  "Shark",
  "Whale",
  "Dolphin",
  "Turtle",
];

export const generateRandomName = (): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;

  return `${adjective}${noun}${number}`;
};

// Default export for Expo Router compatibility
export default generateRandomName;
