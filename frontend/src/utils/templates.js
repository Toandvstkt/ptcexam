export const TEMPLATES = {
  reading: {
    name: "Reading and Use of English (52 câu)",
    parts: [
      {
        partNum: 1,
        title: "Part 1 (Q1-Q8) - Multiple Choice Cloze",
        description: "Chọn đáp án đúng A, B, C hoặc D.",
        questionRange: [1, 8],
        type: "mcq",
        options: ["A", "B", "C", "D"]
      },
      {
        partNum: 2,
        title: "Part 2 (Q9-Q16) - Open Cloze",
        description: "Điền một từ thích hợp.",
        questionRange: [9, 16],
        type: "text",
        placeholder: "Gõ từ..."
      },
      {
        partNum: 3,
        title: "Part 3 (Q17-Q24) - Word Formation",
        description: "Biến đổi từ cho sẵn.",
        questionRange: [17, 24],
        type: "text",
        placeholder: "Gõ từ biến đổi..."
      },
      {
        partNum: 4,
        title: "Part 4 (Q25-Q30) - Key Word Transformation",
        description: "Viết lại câu từ 2 đến 5 từ.",
        questionRange: [25, 30],
        type: "text",
        placeholder: "Gõ cụm từ..."
      },
      {
        partNum: 5,
        title: "Part 5 (Q31-Q36) - Multiple Choice",
        description: "Đọc hiểu trắc nghiệm chọn A, B, C hoặc D.",
        questionRange: [31, 36],
        type: "mcq",
        options: ["A", "B", "C", "D"]
      },
      {
        partNum: 6,
        title: "Part 6 (Q37-Q42) - Gapped Text",
        description: "Chọn câu thích hợp điền vào văn bản (A đến G).",
        questionRange: [37, 42],
        type: "mcq",
        options: ["A", "B", "C", "D", "E", "F", "G"]
      },
      {
        partNum: 7,
        title: "Part 7 (Q43-Q52) - Multiple Matching",
        description: "Ghép thông tin với đoạn văn tương ứng (A, B, C hoặc D).",
        questionRange: [43, 52],
        type: "mcq",
        options: ["A", "B", "C", "D"]
      }
    ]
  },
  listening: {
    name: "Listening (30 câu)",
    parts: [
      {
        partNum: 1,
        title: "Part 1 (Q1-Q8) - Multiple Choice",
        description: "Chọn đáp án đúng A, B hoặc C.",
        questionRange: [1, 8],
        type: "mcq",
        options: ["A", "B", "C"]
      },
      {
        partNum: 2,
        title: "Part 2 (Q9-Q18) - Sentence Completion",
        description: "Điền từ hoặc cụm từ ngắn.",
        questionRange: [9, 18],
        type: "text",
        placeholder: "Gõ từ/cụm từ ngắn..."
      },
      {
        partNum: 3,
        title: "Part 3 (Q19-Q23) - Multiple Matching",
        description: "Ghép ý kiến người nói từ A đến H.",
        questionRange: [19, 23],
        type: "mcq",
        options: ["A", "B", "C", "D", "E", "F", "G", "H"]
      },
      {
        partNum: 4,
        title: "Part 4 (Q24-Q30) - Multiple Choice",
        description: "Chọn đáp án đúng A, B hoặc C.",
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
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
}
