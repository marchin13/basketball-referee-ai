export interface TestQuestion {
  question_number: number;
  question_text: string;
  correct_answer: string;  // "○" or "×"
  category: string;
  difficulty: string;
  explanation: string;
}

export interface TestResult {
  question_number: number;
  question_text: string;
  correct_answer: string;
  ai_answer: string;
  is_correct: boolean;
  confidence_grade: string;
  search_results: any[];
  top_article: string;
  response_time_ms: number;
  error?: string;
}

export interface TestRunSummary {
  timestamp: string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  accuracy_rate: number;
  avg_response_time_ms: number;
  results: TestResult[];
  error_patterns: ErrorPattern[];
}

export interface ErrorPattern {
  pattern_type: string;
  count: number;
  questions: number[];
  suggested_fix: string;
}
