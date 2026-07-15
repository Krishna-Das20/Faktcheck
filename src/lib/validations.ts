import { z } from "zod/v4";

// ====================================
// AUTH SCHEMAS
// ====================================

export const loginSchema = z.object({
  email: z.email("Invalid email address").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50).trim(),
  email: z.email("Invalid email address").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const verifyOtpSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase().trim()),
  otp: z.string().min(4, "OTP is required").max(10),
});

export const forgotPasswordSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  college: z.string().max(100).trim().optional(),
  phone: z.string().max(20).trim().optional(),
});

// ====================================
// CONTEST SCHEMAS
// ====================================

const sectionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  duration: z.number().min(0).optional(),
  totalMarks: z.number().min(0).optional(),
  proctored: z.boolean().optional(),
  hasTimer: z.boolean().optional(),
}).optional();

export const createContestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100).trim(),
  description: z.string().max(1000).optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  duration: z.number().min(1).optional(),
  sections: z.object({
    mcq: sectionConfigSchema,
    coding: sectionConfigSchema,
    forms: sectionConfigSchema,
  }).optional(),
  rules: z.array(z.string()).optional(),
  prizes: z.array(z.string()).optional(),
  maxParticipants: z.number().min(1).nullable().optional(),
  banner: z.string().url().nullable().optional(),
  isPublished: z.boolean().optional(),
  roomId: z.string().nullable().optional(),
  mediaProctoring: z.object({
    enabled: z.boolean().optional(),
    requireCamera: z.boolean().optional(),
    requireScreen: z.boolean().optional(),
    requireIdentityPhoto: z.boolean().optional(),
    recordSnapshots: z.boolean().optional(),
    detectAudio: z.boolean().optional(),
  }).optional(),
});

export const updateContestSchema = createContestSchema.partial();

// ====================================
// MCQ SCHEMAS
// ====================================

export const mcqOptionSchema = z.object({
  text: z.string().min(1, "Option text is required").trim(),
  isCorrect: z.boolean(),
  imageUrl: z.string().optional(),
});

export const createMCQSchema = z.object({
  question: z.string().min(1, "Question is required").trim(),
  options: z.array(mcqOptionSchema).min(2, "At least 2 options required").max(6),
  correctAnswers: z.array(z.number()).optional(),
  marks: z.number().min(0).default(1),
  negativeMarks: z.number().min(0).default(0),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  category: z.enum(["GENERAL", "APTITUDE", "TECHNICAL", "REASONING", "ENTREPRENEURSHIP"]).default("GENERAL"),
  explanation: z.string().max(2000).optional(),
  imageUrl: z.string().optional(),
  imagePublicId: z.string().optional(),
  order: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  isLibrary: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  contestId: z.string().optional(),
});

export const submitMCQAnswersSchema = z.object({
  contestId: z.string().min(1, "Contest ID is required"),
  answers: z.array(z.object({
    mcqId: z.string().optional(),
    questionId: z.string().optional(),
    selectedOptions: z.array(z.number()),
    timeTaken: z.number().min(0).optional(),
  })),
});

// ====================================
// CODING PROBLEM SCHEMAS
// ====================================

export const createCodingProblemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).trim(),
  description: z.string().min(1, "Description is required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  score: z.number().min(0).default(100),
  timeLimit: z.number().min(100).default(2000),
  memoryLimit: z.number().min(1).default(256),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  constraints: z.string().optional(),
  examples: z.array(z.object({
    input: z.string(),
    output: z.string(),
    explanation: z.string().optional(),
  })).optional(),
  testcases: z.array(z.object({
    input: z.string(),
    output: z.string(),
    hidden: z.boolean().optional(),
    points: z.number().min(0).optional(),
  })).optional(),
  starterCode: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().min(0).optional(),
  contestId: z.string().optional(),
  isLibrary: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

// ====================================
// SUBMISSION SCHEMAS
// ====================================

export const submitCodeSchema = z.object({
  contestId: z.string().min(1, "Contest ID is required"),
  problemId: z.string().min(1, "Problem ID is required"),
  sourceCode: z.string().min(1, "Source code is required"),
  language: z.string().optional(),
  languageId: z.number().optional(),
});

export const testRunSchema = z.object({
  problemId: z.string().optional(),
  sourceCode: z.string().min(1, "Source code is required"),
  languageId: z.number({ error: "Language is required" }),
  input: z.string().optional(),
});

export const checkAllSchema = z.object({
  problemId: z.string().min(1, "Problem ID is required"),
  sourceCode: z.string().min(1, "Source code is required"),
  languageId: z.number({ error: "Language is required" }),
});

// ====================================
// ROOM SCHEMAS
// ====================================

export const createRoomSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().optional(),
  banner: z.string().url().nullable().optional(),
});

export const joinRoomSchema = z.object({
  shortCode: z.string().min(1, "Short code is required").trim(),
});

export const inviteSchema = z.object({
  email: z.email("Invalid email").transform((v) => v.toLowerCase().trim()),
});

// ====================================
// FORM SCHEMAS
// ====================================

export const formFieldSchema = z.object({
  fieldId: z.string().optional(), // generated server-side when missing
  type: z.enum(["TEXT", "TEXTAREA", "RADIO", "CHECKBOX", "NUMBER", "URL", "DATE", "FILE"]),
  label: z.string().min(1, "Field label is required"),
  required: z.boolean().optional(),
  placeholder: z.string().max(500).optional(),
  options: z.array(z.string()).optional(),
  correctAnswers: z.array(z.string()).optional(),
  isAutoScored: z.boolean().optional(),
  marks: z.number().min(0).optional(),
  order: z.number().min(0).optional(),
  descriptionImage: z.string().nullable().optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().min(0).optional(),
});

export const createFormSchema = z.object({
  contestId: z.string().min(1, "Contest ID is required"),
  title: z.string().min(1, "Title is required").max(200).trim(),
  description: z.string().max(1000).optional(),
  fields: z.array(formFieldSchema).min(1, "At least one field is required"),
  order: z.number().min(0).optional(),
});

export const updateFormSchema = createFormSchema.partial().omit({ contestId: true });

export const evaluateSubmissionSchema = z.object({
  evaluations: z.array(z.object({
    fieldId: z.string().min(1),
    manualScore: z.number().min(0),
    feedback: z.string().optional(),
  })),
});

// ====================================
// ANNOUNCEMENT SCHEMAS
// ====================================

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).trim(),
  content: z.string().min(1, "Content is required").max(5000).trim(),
  isPinned: z.boolean().optional(),
});

// ====================================
// ADMIN SCHEMAS
// ====================================

export const updateRoleSchema = z.object({
  role: z.enum(["USER", "ORGANISER", "ADMIN"]),
});

export const verifyContestSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

// ====================================
// CONTEST FLOW SCHEMAS
// ====================================

export const violationSchema = z.object({
  type: z.enum([
    "TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT",
    "COPY_ATTEMPT", "PASTE_ATTEMPT", "SCREENSHOT_ATTEMPT",
  ]),
  details: z.string().max(500).optional(),
});

export const saveProgressSchema = z.object({
  mcqAnswers: z.array(z.object({
    mcqId: z.string().min(1),
    selectedOptions: z.array(z.number()),
  })).optional(),
  currentSection: z.string().optional(),
  timeSpent: z.number().min(0).optional(),
});

export const finalSubmitSchema = z.object({
  mcqAnswers: z.array(z.object({
    mcqId: z.string().min(1),
    selectedOptions: z.array(z.number()),
  })).optional(),
});
