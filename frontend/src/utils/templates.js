export const TEMPLATES = {
  reading: {
    name: "Reading and Use of English (52 questions)",
    parts: [
      {
        partNum: 1,
        title: "Part 1 (Q1\u20138) \u2013 Multiple Choice Cloze",
        description: "Choose the correct answer: A, B, C or D.",
        questionRange: [1, 8],
        type: "mcq",
        options: ["A", "B", "C", "D"]
      },
      {
        partNum: 2,
        title: "Part 2 (Q9\u201316) \u2013 Open Cloze",
        description: "Write ONE suitable word. Use CAPITALS.",
        questionRange: [9, 16],
        type: "text",
        uppercase: true,
        placeholder: "Type word..."
      },
      {
        partNum: 3,
        title: "Part 3 (Q17\u201324) \u2013 Word Formation",
        description: "Write the correct form of the word in brackets. Use CAPITALS.",
        questionRange: [17, 24],
        type: "text",
        uppercase: true,
        placeholder: "Type formed word..."
      },
      {
        partNum: 4,
        title: "Part 4 (Q25\u201330) \u2013 Key Word Transformation",
        description: "Complete the second sentence using 2\u20135 words. Use CAPITALS.",
        questionRange: [25, 30],
        type: "text",
        uppercase: true,
        placeholder: "Type 2\u20135 words..."
      },
      {
        partNum: 5,
        title: "Part 5 (Q31\u201336) \u2013 Multiple Choice",
        description: "Read the text and choose the correct answer: A, B, C or D.",
        questionRange: [31, 36],
        type: "mcq",
        options: ["A", "B", "C", "D"]
      },
      {
        partNum: 6,
        title: "Part 6 (Q37\u201342) \u2013 Gapped Text",
        description: "Choose the sentence that best fits each gap (A\u2013G).",
        questionRange: [37, 42],
        type: "mcq",
        options: ["A", "B", "C", "D", "E", "F", "G"]
      },
      {
        partNum: 7,
        title: "Part 7 (Q43\u201352) \u2013 Multiple Matching",
        description: "Match questions to the correct section (A, B, C or D).",
        questionRange: [43, 52],
        type: "mcq",
        options: ["A", "B", "C", "D"]
      }
    ]
  },
  listening: {
    name: "Listening (30 questions)",
    parts: [
      {
        partNum: 1,
        title: "Part 1 (Q1\u20138) \u2013 Multiple Choice",
        description: "Choose the correct answer: A, B or C.",
        questionRange: [1, 8],
        type: "mcq",
        options: ["A", "B", "C"]
      },
      {
        partNum: 2,
        title: "Part 2 (Q9\u201318) \u2013 Sentence Completion",
        description: "Write the word or short phrase you hear. Use CAPITALS.",
        questionRange: [9, 18],
        type: "text",
        uppercase: true,
        placeholder: "Type word/phrase..."
      },
      {
        partNum: 3,
        title: "Part 3 (Q19\u201323) \u2013 Multiple Matching",
        description: "Match each speaker to an opinion (A\u2013H).",
        questionRange: [19, 23],
        type: "mcq",
        options: ["A", "B", "C", "D", "E", "F", "G", "H"]
      },
      {
        partNum: 4,
        title: "Part 4 (Q24\u201330) \u2013 Multiple Choice",
        description: "Choose the correct answer: A, B or C.",
        questionRange: [24, 30],
        type: "mcq",
        options: ["A", "B", "C"]
      }
    ]
  }
};

export function getQuestionArray(range) {
  const [start, end] = range;
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

/** Returns list of active part numbers for a tab (default: all) */
export function getActiveParts(exam, tabKey) {
  if (!exam?.activeParts?.[tabKey]) {
    return TEMPLATES[tabKey].parts.map(p => p.partNum);
  }
  return exam.activeParts[tabKey];
}

/** Total active question count across both tabs */
export function countActiveQuestions(exam) {
  let total = 0;
  ['reading', 'listening'].forEach(tab => {
    const active = getActiveParts(exam, tab);
    TEMPLATES[tab].parts.forEach(p => {
      if (active.includes(p.partNum)) {
        total += p.questionRange[1] - p.questionRange[0] + 1;
      }
    });
  });
  return total;
}
