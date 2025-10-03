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
  // Chess-themed humorous adjectives
  "Checky",
  "Pawny",
  "Rooky",
  "Bishoppy",
  "Queenly",
  "Kingly",
  "Matey",
  "Boardy",
  "Movey",
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
  // Chess-themed nouns
  "Pawn",
  "Rook",
  "Bishop",
  "Queen",
  "King",
  "Chess",
  "Board",
  "Move",
  "Check",
  "Mate",
];

// Fun punny combinations with higher probability
const punnyNames = [
  "ChessEater",
  "MoveGobbler", 
  "BoardDestroyer",
  "CheckMating",
  "PawnStar",
  "RookieMe",
  "QueenSlayer",
  "KingBreaker",
  "BishopKiller",
  "RockSolidRook",
  "TheGambit",
  "ChessMaster",
  "Knightmare",
  "PawnShop",
  "CheckThis",
  "MateInOne",
  "NoobSlayer",
  "BoardViking",
  "ChessMonster",
  "TheRulingKing",
];

export const generateRandomName = (): string => {
  // 30% chance of getting a punny name, 70% chance of regular combination
  if (Math.random() < 0.3) {
    return punnyNames[Math.floor(Math.random() * punnyNames.length)];
  }
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  // const number = Math.floor(Math.random() * 999) + 1;

  return `${adjective}${noun}`;
};

// Default export for Expo Router compatibility
export default generateRandomName;
