export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  created_at: string;
  completion_percent?: number;
  average_score?: number;
  completed_lessons?: number;
}

export interface CodeExample {
  title: string;
  code: string;
  language: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  code_examples: CodeExample[];
  order_index: number;
  is_free: boolean;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  lesson_id: string;
  type: "multiple_choice" | "drag_drop";
  question: string;
  template_code?: string; // Optional code template with slot placeholder e.g. "System.out.___(\"Hello World\");"
  options: string[]; // For MCQ, list of choices. For Drag & Drop, list of draggable blocks
  correct_answer?: string | string[]; // For MCQ: string index/text. For Drag & Drop: array of correct sequence
  order_index: number;
}

export interface UserProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  quiz_score: number;
  updated_at: string;
}

export interface LessonStats {
  id: string;
  title: string;
  order_index: number;
  completions: number;
  completion_rate: number;
  average_score: number;
  views: number;
}

export interface UserGrowthData {
  date: string;
  new_users: number;
}

export interface AnalyticsData {
  summary: {
    total_users: number;
    new_users_week: number;
    total_lessons: number;
    total_attempts: number;
  };
  lessons: LessonStats[];
  user_growth: UserGrowthData[];
}
