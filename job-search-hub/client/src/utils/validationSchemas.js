import { z } from 'zod';

/**
 * Validation schemas using Zod
 * Centralized validation logic for all forms
 */

// Auth schemas
export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be under 100 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be under 100 characters'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
  terms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase(),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const totpVerificationSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, 'Please enter a valid 6-digit code'),
});

// Job schemas
export const createJobSchema = z.object({
  company: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name must be under 255 characters'),
  position: z
    .string()
    .min(1, 'Job position is required')
    .max(255, 'Position must be under 255 characters'),
  jobUrl: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(255, 'Location must be under 255 characters')
    .optional()
    .or(z.literal('')),
  salary: z
    .string()
    .max(100, 'Salary must be under 100 characters')
    .optional()
    .or(z.literal('')),
  status: z
    .enum(['applied', 'interviewing', 'offer', 'rejected', 'archived'])
    .default('applied'),
  notes: z
    .string()
    .max(5000, 'Notes must be under 5000 characters')
    .optional()
    .or(z.literal('')),
});

export const updateJobSchema = createJobSchema.partial();

// Contact schemas
export const createContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be under 255 characters'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(20, 'Phone must be under 20 characters')
    .optional()
    .or(z.literal('')),
  company: z
    .string()
    .max(255, 'Company must be under 255 characters')
    .optional()
    .or(z.literal('')),
  role: z
    .string()
    .max(255, 'Role must be under 255 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(5000, 'Notes must be under 5000 characters')
    .optional()
    .or(z.literal('')),
});

export const updateContactSchema = createContactSchema.partial();

// Reminder schemas
export const createReminderSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be under 255 characters'),
  description: z
    .string()
    .max(5000, 'Description must be under 5000 characters')
    .optional()
    .or(z.literal('')),
  dueDate: z
    .string()
    .optional()
    .refine(
      val => !val || !isNaN(Date.parse(val)),
      'Please enter a valid date',
    ),
  category: z
    .enum(['follow-up', 'preparation', 'other'])
    .optional()
    .default('other'),
  jobId: z
    .string()
    .uuid('Invalid job ID')
    .optional(),
});

export const updateReminderSchema = createReminderSchema.partial();

// Outreach schemas
export const logOutreachSchema = z.object({
  contactId: z
    .string()
    .uuid('Invalid contact ID'),
  method: z
    .enum(['email', 'phone', 'linkedin', 'other']),
  notes: z
    .string()
    .max(5000, 'Notes must be under 5000 characters')
    .optional()
    .or(z.literal('')),
});

// Type exports for TypeScript integration (optional)
// Uncomment when using TypeScript:
// export type LoginFormData = z.infer<typeof loginSchema>;
// export type RegisterFormData = z.infer<typeof registerSchema>;
// export type CreateJobFormData = z.infer<typeof createJobSchema>;
// export type CreateContactFormData = z.infer<typeof createContactSchema>;
