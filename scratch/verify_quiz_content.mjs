import { QUESTIONS, TOTAL_ROUNDS } from '../src/data/questions.js';

const EXPECTED_QUESTIONS = [
  {
    roundNumber: 1,
    isFinalExhibit: false,
    evidenceTitle: 'The Location',
    prompt: 'In which Australian city did Melanie Perkins first have the idea for Canva?',
    options: ['Sydney', 'Melbourne', 'Perth', 'Brisbane'],
    clue: "It's on Australia's west coast.",
    correctOption: 'C. Perth',
    expectedIndex: 2
  },
  {
    roundNumber: 2,
    isFinalExhibit: false,
    evidenceTitle: 'The Mastermind',
    prompt: "Who is Canva's CEO  and founder?",
    options: ['Cliff Obrecht', 'Melanie Perkins', 'Cameron Adams', 'Captain Canva'],
    clue: 'Remember the university tutor from Evidence A.',
    correctOption: 'B. Melanie Perkins',
    expectedIndex: 1
  },
  {
    roundNumber: 3,
    isFinalExhibit: false,
    evidenceTitle: 'The Motive',
    prompt: 'What did Melanie Perkins notice about her students that sparked the idea for Canva?',
    options: [
      'Design software was complicated and slow to learn',
      'They had no creative ideas',
      'They couldn\'t afford computers',
      'They preferred drawing by hand'
    ],
    clue: "Their problem wasn't imagination. Think about the tools.",
    correctOption: 'A. Design software was complicated and slow to learn',
    expectedIndex: 0
  },
  {
    roundNumber: 4,
    isFinalExhibit: false,
    evidenceTitle: 'The Rehearsal',
    prompt: "Fusion Books, Melanie and Cliff's first business, helped schools create what?",
    options: ['Timetables', 'School uniforms', 'Textbooks', 'Yearbooks'],
    clue: 'Something students flip through years later to remember their friends.',
    correctOption: 'D. Yearbooks',
    expectedIndex: 3
  },
  {
    roundNumber: 5,
    isFinalExhibit: false,
    evidenceTitle: 'The Hundred Nos',
    prompt: 'By her own count, how many investors said no to Melanie Perkins before Canva got its backing?',
    options: ['About 25', 'About 1000', 'More than 100', 'More than 500'],
    clue: 'A three-digit number, and she still kept pitching.',
    correctOption: 'C. More than 100',
    expectedIndex: 2
  },
  {
    roundNumber: 6,
    isFinalExhibit: false,
    evidenceTitle: 'The Accomplice',
    prompt: "Cameron Adams joined Melanie and Cliff as Canva's third co-founder. Which company had he worked for before?",
    options: ['Apple', 'Google', 'Microsoft', 'Amazon'],
    clue: 'You probably used it today to look something up.',
    correctOption: 'B. Google',
    expectedIndex: 1
  },
  {
    roundNumber: 7,
    isFinalExhibit: false,
    evidenceTitle: 'The Launch Date',
    prompt: 'In what year did Canva launch?',
    options: ['2013', '2011', '2015', '2017'],
    clue: 'Think early 2010s: after Instagram started, long before TikTok.',
    correctOption: 'A. 2013',
    expectedIndex: 0
  },
  {
    roundNumber: 8,
    isFinalExhibit: false,
    evidenceTitle: 'The Toolkit',
    prompt: 'Which of these can you NOT make in Canva?',
    options: ['A presentation', 'A CV', 'A video', 'A real, physical bicycle'],
    clue: 'Three of these live on a screen or a page. One lives in the garage.',
    correctOption: 'D. A real, physical bicycle',
    expectedIndex: 3
  },
  {
    roundNumber: 9,
    isFinalExhibit: false,
    evidenceTitle: 'The Conspiracy',
    prompt: 'Your friend lives in another city. What can the two of you do on the same Canva design?',
    options: [
      'Only one person can edit while the other watches',
      'Edit it together, even at the same time',
      'Only work on it if you\'re on the same Wi-Fi',
      'Only work on it if you print it first'
    ],
    clue: 'Think teamwork. Yearbook teams needed this too.',
    correctOption: 'B. Edit it together, even at the same time',
    expectedIndex: 1
  },
  {
    roundNumber: 10,
    isFinalExhibit: false,
    evidenceTitle: 'The Confession',
    prompt: 'Complete Canva\'s mission: "Empower the world to ___."',
    options: ['Create', 'Imagine', 'Design', 'Invent'],
    clue: 'Remember the charge against Canva: making EVERYONE a ___.',
    correctOption: 'C. Design',
    expectedIndex: 2
  },
  {
    roundNumber: 11,
    isFinalExhibit: true,
    evidenceTitle: 'The Timeline',
    prompt: 'Which of these happened MOST RECENTLY?',
    options: [
      'Fusion Books launches',
      'Canva launches',
      "Canva's AI writing tool, Magic Write, launches",
      'Canva acquires Affinity'
    ],
    clue: 'Think professional design software.',
    correctOption: 'D. Canva acquires Affinity',
    expectedIndex: 3
  }
];

function verifyAll() {
  console.log('Verifying quiz content...');

  if (QUESTIONS.length !== 11) {
    throw new Error(`Expected 11 questions, found ${QUESTIONS.length}`);
  }
  if (TOTAL_ROUNDS !== 11) {
    throw new Error(`Expected TOTAL_ROUNDS === 11, found ${TOTAL_ROUNDS}`);
  }

  const regularQuestions = QUESTIONS.filter(q => !q.isFinalExhibit);
  const finalExhibits = QUESTIONS.filter(q => q.isFinalExhibit);

  if (regularQuestions.length !== 10) {
    throw new Error(`Expected exactly 10 regular questions, found ${regularQuestions.length}`);
  }
  if (finalExhibits.length !== 1) {
    throw new Error(`Expected exactly 1 Final Exhibit, found ${finalExhibits.length}`);
  }

  console.log('[PASS] Count verified: Exactly 10 regular questions and 1 Final Exhibit.');

  EXPECTED_QUESTIONS.forEach((expected, i) => {
    const actual = QUESTIONS[i];
    console.log(`Checking Q${i + 1} (${actual.evidenceTitle})...`);

    if (actual.roundNumber !== expected.roundNumber) {
      throw new Error(`Q${i + 1} roundNumber mismatch: expected ${expected.roundNumber}, got ${actual.roundNumber}`);
    }
    if (actual.isFinalExhibit !== expected.isFinalExhibit) {
      throw new Error(`Q${i + 1} isFinalExhibit mismatch: expected ${expected.isFinalExhibit}, got ${actual.isFinalExhibit}`);
    }
    if (actual.prompt !== expected.prompt) {
      throw new Error(`Q${i + 1} prompt mismatch:\nExpected: "${expected.prompt}"\nGot:      "${actual.prompt}"`);
    }
    if (actual.clue !== expected.clue) {
      throw new Error(`Q${i + 1} clue mismatch:\nExpected: "${expected.clue}"\nGot:      "${actual.clue}"`);
    }
    if (actual.options.length !== 4) {
      throw new Error(`Q${i + 1} options count mismatch: expected 4, got ${actual.options.length}`);
    }
    expected.options.forEach((opt, optIdx) => {
      if (actual.options[optIdx] !== opt) {
        throw new Error(`Q${i + 1} option ${optIdx} mismatch:\nExpected: "${opt}"\nGot:      "${actual.options[optIdx]}"`);
      }
    });

    if (actual.correctIndex !== expected.expectedIndex) {
      throw new Error(`Q${i + 1} correctIndex mismatch: expected ${expected.expectedIndex}, got ${actual.correctIndex}`);
    }

    const selectedOption = actual.options[actual.correctIndex];
    console.log(`  -> Option[${actual.correctIndex}]: "${selectedOption}" (matches ${expected.correctOption})`);
  });

  console.log('\n[PASS] All 11 questions, options, clues, and correct answers match perfectly!');
}

verifyAll();
