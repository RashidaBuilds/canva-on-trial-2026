/**
 * Canva on Trial 2026 - Question Bank
 * Contains exactly 10 regular questions (Rounds 1-10) plus one Final Exhibit (Round 11, 200-point bonus).
 * Preserves exact wording, evidence categories, clues, answer choices, and correct answers.
 */

export const QUESTIONS = [
  {
    id: 1,
    roundNumber: 1,
    isFinalExhibit: false,
    category: "A",
    evidenceTitle: "The Location",
    evidenceLabel: "EVIDENCE A / THE LOCATION",
    prompt: "In which Australian city did Melanie Perkins first have the idea for Canva?",
    clue: "It's on Australia's west coast.",
    options: [
      "Sydney",
      "Melbourne",
      "Perth",
      "Brisbane"
    ],
    correctIndex: 2,
    explanation: "Perth"
  },
  {
    id: 2,
    roundNumber: 2,
    isFinalExhibit: false,
    category: "A",
    evidenceTitle: "The Mastermind",
    evidenceLabel: "EVIDENCE A / THE MASTERMIND",
    prompt: "Who is Canva's CEO  and founder?",
    clue: "Remember the university tutor from Evidence A.",
    options: [
      "Cliff Obrecht",
      "Melanie Perkins",
      "Cameron Adams",
      "Captain Canva"
    ],
    correctIndex: 1,
    explanation: "Melanie Perkins"
  },
  {
    id: 3,
    roundNumber: 3,
    isFinalExhibit: false,
    category: "A",
    evidenceTitle: "The Motive",
    evidenceLabel: "EVIDENCE A / THE MOTIVE",
    prompt: "What did Melanie Perkins notice about her students that sparked the idea for Canva?",
    clue: "Their problem wasn't imagination. Think about the tools.",
    options: [
      "Design software was complicated and slow to learn",
      "They had no creative ideas",
      "They couldn't afford computers",
      "They preferred drawing by hand"
    ],
    correctIndex: 0,
    explanation: "Design software was complicated and slow to learn"
  },
  {
    id: 4,
    roundNumber: 4,
    isFinalExhibit: false,
    category: "B",
    evidenceTitle: "The Rehearsal",
    evidenceLabel: "EVIDENCE B / THE REHEARSAL",
    prompt: "Fusion Books, Melanie and Cliff's first business, helped schools create what?",
    clue: "Something students flip through years later to remember their friends.",
    options: [
      "Timetables",
      "School uniforms",
      "Textbooks",
      "Yearbooks"
    ],
    correctIndex: 3,
    explanation: "Yearbooks"
  },
  {
    id: 5,
    roundNumber: 5,
    isFinalExhibit: false,
    category: "B",
    evidenceTitle: "The Hundred Nos",
    evidenceLabel: "EVIDENCE B / THE HUNDRED NOS",
    prompt: "By her own count, how many investors said no to Melanie Perkins before Canva got its backing?",
    clue: "A three-digit number, and she still kept pitching.",
    options: [
      "About 25",
      "About 1000",
      "More than 100",
      "More than 500"
    ],
    correctIndex: 2,
    explanation: "More than 100"
  },
  {
    id: 6,
    roundNumber: 6,
    isFinalExhibit: false,
    category: "B",
    evidenceTitle: "The Accomplice",
    evidenceLabel: "EVIDENCE B / THE ACCOMPLICE",
    prompt: "Cameron Adams joined Melanie and Cliff as Canva's third co-founder. Which company had he worked for before?",
    clue: "You probably used it today to look something up.",
    options: [
      "Apple",
      "Google",
      "Microsoft",
      "Amazon"
    ],
    correctIndex: 1,
    explanation: "Google"
  },
  {
    id: 7,
    roundNumber: 7,
    isFinalExhibit: false,
    category: "C",
    evidenceTitle: "The Launch Date",
    evidenceLabel: "EVIDENCE C / THE LAUNCH DATE",
    prompt: "In what year did Canva launch?",
    clue: "Think early 2010s: after Instagram started, long before TikTok.",
    options: [
      "2013",
      "2011",
      "2015",
      "2017"
    ],
    correctIndex: 0,
    explanation: "2013"
  },
  {
    id: 8,
    roundNumber: 8,
    isFinalExhibit: false,
    category: "C",
    evidenceTitle: "The Toolkit",
    evidenceLabel: "EVIDENCE C / THE TOOLKIT",
    prompt: "Which of these can you NOT make in Canva?",
    clue: "Three of these live on a screen or a page. One lives in the garage.",
    options: [
      "A presentation",
      "A CV",
      "A video",
      "A real, physical bicycle"
    ],
    correctIndex: 3,
    explanation: "A real, physical bicycle"
  },
  {
    id: 9,
    roundNumber: 9,
    isFinalExhibit: false,
    category: "C",
    evidenceTitle: "The Conspiracy",
    evidenceLabel: "EVIDENCE C / THE CONSPIRACY",
    prompt: "Your friend lives in another city. What can the two of you do on the same Canva design?",
    clue: "Think teamwork. Yearbook teams needed this too.",
    options: [
      "Only one person can edit while the other watches",
      "Edit it together, even at the same time",
      "Only work on it if you're on the same Wi-Fi",
      "Only work on it if you print it first"
    ],
    correctIndex: 1,
    explanation: "Edit it together, even at the same time"
  },
  {
    id: 10,
    roundNumber: 10,
    isFinalExhibit: false,
    category: "C",
    evidenceTitle: "The Confession",
    evidenceLabel: "EVIDENCE C / THE CONFESSION",
    prompt: "Complete Canva's mission: \"Empower the world to ___.\"",
    clue: "Remember the charge against Canva: making EVERYONE a ___.",
    options: [
      "Create",
      "Imagine",
      "Design",
      "Invent"
    ],
    correctIndex: 2,
    explanation: "Design"
  },
  {
    id: 11,
    roundNumber: 11,
    isFinalExhibit: true,
    category: "BONUS",
    evidenceTitle: "The Timeline",
    evidenceLabel: "FINAL EXHIBIT / THE TIMELINE",
    prompt: "Which of these happened MOST RECENTLY?",
    clue: "Think professional design software.",
    options: [
      "Fusion Books launches",
      "Canva launches",
      "Canva's AI writing tool, Magic Write, launches",
      "Canva acquires Affinity"
    ],
    correctIndex: 3,
    explanation: "Canva acquires Affinity"
  }
];

export const TOTAL_ROUNDS = QUESTIONS.length; // 11
