const { z } = require("zod");
const { logger } = require("../utils/logger");

function validate(schema, source = "body") {
  return (req, res, next) => {
    const data = source === "query" ? req.query : source === "params" ? req.params : req.body;
    const result = schema.safeParse(data);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      logger.warn("Validation failed", { path: req.path, errors });
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    req.validated = result.data;
    next();
  };
}

const authSchemas = {
  register: z.object({
    email: z.string().email("Valid email is required").transform((v) => v.trim().toLowerCase()),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1).max(100).optional().default("User"),
  }),
  login: z.object({
    email: z.string().email("Valid email is required").transform((v) => v.trim().toLowerCase()),
    password: z.string().min(1, "Password is required"),
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
  mfaCode: z.object({
    code: z.string().regex(/^\d{6}$/, "Must be a 6-digit code"),
  }),
  mfaChallenge: z.object({
    code: z.string().min(6).max(20),
    preAuthToken: z.string().min(1, "Pre-auth token is required"),
  }),
  updateProfile: z.object({
    name: z.string().max(100).optional(),
    headline: z.string().max(200).optional(),
    location: z.string().max(200).optional(),
    bio: z.string().max(2000).optional(),
  }),
};

const jobSchemas = {
  create: z.object({
    company: z.string().min(1, "Company is required").max(200),
    role: z.string().min(1, "Role is required").max(200),
    status: z.string().max(50).optional(),
    location: z.string().max(200).optional(),
    recruiterName: z.string().max(200).optional(),
    recruiterEmail: z.string().email().optional().or(z.literal("")),
    appliedDate: z.string().optional(),
    notes: z.string().max(5000).optional(),
    nextStep: z.string().max(500).optional(),
    source: z.string().max(50).optional(),
  }),
  update: z.object({
    company: z.string().max(200).optional(),
    role: z.string().max(200).optional(),
    status: z.string().max(50).optional(),
    location: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    nextStep: z.string().max(500).optional(),
  }),
};

const billingSchemas = {
  checkout: z.object({
    tier: z.enum(["pro", "elite"], { message: "Tier must be 'pro' or 'elite'" }),
  }),
};

const adminSchemas = {
  updateRole: z.object({
    role: z.enum(["free", "pro", "elite", "admin"], { message: "Invalid role" }),
  }),
};

const contactSchemas = {
  create: z.object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(30).optional(),
    company: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    linkedin: z.string().max(500).optional(),
  }),
};

const aiSchemas = {
  coverLetter: z.object({
    jobTitle: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    jobDescription: z.string().min(1).max(10000),
  }),
  interviewCoach: z.object({
    question: z.string().min(1).max(2000),
    jobTitle: z.string().min(1).max(200),
    jobDescription: z.string().max(10000).optional(),
  }),
};

module.exports = {
  validate,
  authSchemas,
  jobSchemas,
  billingSchemas,
  adminSchemas,
  contactSchemas,
  aiSchemas,
};
