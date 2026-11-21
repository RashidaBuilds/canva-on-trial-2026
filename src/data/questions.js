/**
 * Canva on Trial 2026 - Question Bank
 * Contains 10 regular questions (Rounds 1-10) plus one Final Exhibit (Round 11).
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
    prompt: "What country was Canva founded in?",
    clue: "Think kangaroos!",
    options: ["Australia", "New Zealand", "Canada", "United States"],
    correctIndex: 0,
    explanation: "Canva was founded in Australia."
  },
  {
    id: 2,
    roundNumber: 2,
    isFinalExhibit: false,
    category: "A",
    evidenceTitle: "The Mastermind",
    evidenceLabel: "EVIDENCE A / THE MASTERMIND",
    prompt: "Who is Canva's CEO and co-founder?",
    clue: "Remember the university tutor from Evidence A.",
    options: ["Melanie Perkins", "Cliff Obrecht", "Cameron Adams", "Captain Canva"],
    correctIndex: 0,
    explanation: "Melanie Perkins is Canva's CEO and co-founder."
  },
  {
    id: 3,
    roundNumber: 3,
    isFinalExhibit: false,
    category: "A",
    evidenceTitle: "The Motive",
    evidenceLabel: "EVIDENCE A / THE MOTIVE",
    prompt: "Melanie Perkins noticed the problem that led to Canva while teaching university students what?",
    clue: "Her students struggled to find their way around complicated programs, not to come up with ideas.",
    options: ["How to use design software", "How to code websites", "How to cook", "How to play guitar"],
    correctIndex: 0,
    explanation: "Melanie noticed students struggling with complex design programs while teaching graphic design."
  },
  {
    id: 4,
    roundNumber: 4,
    isFinalExhibit: false,
    category: "B",
    evidenceTitle: "The Rehearsal",
    evidenceLabel: "EVIDENCE B / THE REHEARSAL",
    prompt: "Melanie and Cliff's first business, Fusion Books, helped schools create what?",
    clue: "Something students flip through years later to remember their friends.",
    options: ["Yearbooks", "School uniforms", "Timetables", "Textbooks"],
    correctIndex: 0,
    explanation: "Fusion Books allowed schools to easily design their own yearbooks."
  },
  {
    id: 5,
    roundNumber: 5,
    isFinalExhibit: false,
    category: "B",
    evidenceTitle: "The Hundred Nos",
    evidenceLabel: "EVIDENCE B / THE HUNDRED NOS",
    prompt: "By her own count, how many investors said no to Melanie Perkins before Canva got its backing?",
    clue: "Not a handful, and not thousands.",
    options: ["About 10", "About 30", "More than 100", "More than 1,000"],
    correctIndex: 2,
    explanation: "More than 100 investors rejected Canva before its first funding round."
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
    options: ["Google", "Apple", "Netflix", "Amazon"],
    correctIndex: 0,
    explanation: "Cameron Adams worked at Google before co-founding Canva."
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
    options: ["2009", "2011", "2013", "2016"],
    correctIndex: 2,
    explanation: "Canva officially launched in 2013."
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
    options: ["A CV", "A birthday invitation", "A presentation", "A real, physical bicycle"],
    correctIndex: 3,
    explanation: "Canva can design virtually anything visual, but cannot manufacture a real physical bicycle!"
  },
  {
    id: 9,
    roundNumber: 9,
    isFinalExhibit: false,
    category: "C",
    evidenceTitle: "The Conspiracy",
    evidenceLabel: "EVIDENCE C / THE CONSPIRACY",
    prompt: "Your friend lives in another city. Can the two of you edit the same Canva design together?",
    clue: "Think teamwork. Yearbook teams needed this too.",
    options: [
      "Yes, you can collaborate on one design",
      "No, only one person can edit",
      "Only if you're in the same room",
      "Only if you print it first"
    ],
    correctIndex: 0,
    explanation: "Real-time collaboration allows people across the world to co-create seamlessly."
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
    options: ["Design", "Invest", "Advertise", "Code"],
    correctIndex: 0,
    explanation: "Canva's mission is: Empower the world to design."
  },
  {
    id: 11,
    roundNumber: 11,
    isFinalExhibit: true,
    category: "BONUS",
    evidenceTitle: "The Timeline",
    evidenceLabel: "FINAL EXHIBIT / THE TIMELINE",
    prompt: "Which of these happened FIRST in Canva's story?",
    clue: "The story starts in a living room.",
    options: [
      "Fusion Books launches",
      "Canva launches",
      "Canva's AI writing tool, Magic Write, launches",
      "Canva acquires Affinity"
    ],
    correctIndex: 0,
    explanation: "Fusion Books started in 2007, paving the way for Canva."
  }
];

export const TOTAL_ROUNDS = QUESTIONS.length; // 11
