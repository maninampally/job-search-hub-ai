# Form Validation System

This document explains how to use the centralized form validation system built with **Zod** and **react-hook-form**.

## Overview

We use two key libraries:
- **Zod**: Schema validation and parsing
- **react-hook-form**: Lightweight form state management with minimal re-renders
- **@hookform/resolvers**: Integration between Zod and react-hook-form

## Basic Usage

### 1. Define Your Schema

All validation schemas are in `src/utils/validationSchemas.js`. Each schema defines:
- Required/optional fields
- Type validation
- Format validation (email, URL, etc.)
- Custom error messages
- Cross-field validation (e.g., password confirmation)

Example:
```javascript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});
```

### 2. Create a Form Component

Use `react-hook-form` with the Zod schema:

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormInput from '../components/shared/FormInput';
import { loginSchema } from '../utils/validationSchemas';

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on field blur
  });

  const onSubmit = async (data) => {
    // Your submit logic here
    console.log(data); // Validated data
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormInput
        label="Email"
        type="email"
        placeholder="you@example.com"
        {...register('email')}
        error={errors.email}
        required
      />

      <FormInput
        label="Password"
        type="password"
        placeholder="Your password"
        {...register('password')}
        error={errors.password}
        required
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

### 3. Use the FormInput Component

`FormInput` is a reusable component that handles:
- Label rendering
- Error display
- Accessibility attributes (aria-invalid, aria-describedby)
- Focus styles
- Disabled states

```jsx
<FormInput
  label="Email"
  type="email"
  placeholder="you@example.com"
  {...register('email')}
  error={errors.email}
  autoComplete="email"
  required
/>
```

Props:
- `label`: Display label for the input
- `name`: Field name (typically from register)
- `type`: Input type (default: 'text')
- `placeholder`: Placeholder text
- `error`: Error object from react-hook-form
- `disabled`: Disable the input
- `autoComplete`: HTML autocomplete attribute
- `required`: Show required indicator

## Available Schemas

### Authentication
- `loginSchema` - Email and password login
- `registerSchema` - New account creation
- `forgotPasswordSchema` - Password recovery request
- `resetPasswordSchema` - Password reset
- `totpVerificationSchema` - 2FA code entry

### Jobs
- `createJobSchema` - Create/edit job application
- `updateJobSchema` - Update existing job (partial)

### Contacts
- `createContactSchema` - Create/edit contact
- `updateContactSchema` - Update existing contact (partial)

### Reminders
- `createReminderSchema` - Create/edit reminder
- `updateReminderSchema` - Update existing reminder (partial)

### Outreach
- `logOutreachSchema` - Log contact outreach attempt

## Validation Modes

`react-hook-form` supports different validation modes:

```javascript
const form = useForm({
  resolver: zodResolver(schema),
  mode: 'onBlur',      // Validate when field loses focus (default)
  // mode: 'onChange',  // Validate on every keystroke (slower)
  // mode: 'onSubmit',  // Validate only on form submission
});
```

**Recommended**: Use `'onBlur'` for better UX - validates on blur but not during typing.

## Error Handling

Errors from Zod contain:
- `message`: The validation error message
- `type`: The error type (e.g., 'required', 'invalid_email')

Access them via the `errors` object:

```javascript
const { errors } = formState;

// Check if field has error
if (errors.email) {
  console.log(errors.email.message); // "Please enter a valid email address"
}

// Display error in component
{errors.email && <span>{errors.email.message}</span>}
```

## Server-Side Validation

Even though validation happens on the client, always validate on the server:

```javascript
// Backend (Node.js/Express)
import { z } from 'zod';

router.post('/auth/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    // Process validated data
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors,
      });
    }
    throw err;
  }
});
```

## Password Validation Rules

Passwords must meet these requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

Example: `SecurePass123` ✓, `password123` ✗ (no uppercase), `PASSWORD123` ✗ (no lowercase)

## Custom Validation

Add custom validation with `.refine()`:

```javascript
const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

## Type Safety

Get TypeScript types from schemas:

```javascript
import { z } from 'zod';
import { loginSchema } from '../utils/validationSchemas';

// Auto-generate type from schema
type LoginFormData = z.infer<typeof loginSchema>;

// Use in component
const onSubmit = (data: LoginFormData) => {
  // data is fully typed
  console.log(data.email); // string (guaranteed)
};
```

## Testing Schemas

Test validation with Vitest:

```javascript
import { describe, it, expect } from 'vitest';
import { loginSchema } from './validationSchemas';

describe('loginSchema', () => {
  it('should validate correct data', () => {
    const data = { email: 'user@example.com', password: 'SecurePassword123' };
    expect(() => loginSchema.parse(data)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const data = { email: 'invalid', password: 'SecurePassword123' };
    expect(() => loginSchema.parse(data)).toThrow();
  });
});
```

## Best Practices

1. **Always use schemas** - Never validate manually in component logic
2. **Server-side validation too** - Never trust client-only validation
3. **Use `onBlur` mode** - Better UX than real-time validation
4. **Reuse schemas** - Both client and server can use the same Zod schema
5. **Clear error messages** - Messages should tell users exactly what's wrong
6. **Disable submit while submitting** - Prevent double submissions
7. **Show feedback** - Use loading states and success messages
8. **Test schemas** - Include validation tests in your test suite

## Examples

### Form with Different Field Types

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormInput from '../components/shared/FormInput';
import { createJobSchema } from '../utils/validationSchemas';

function JobForm({ onSubmit: onSubmitProp }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createJobSchema),
    mode: 'onBlur',
  });

  return (
    <form onSubmit={handleSubmit(onSubmitProp)}>
      <FormInput
        label="Company Name"
        {...register('company')}
        error={errors.company}
        required
      />

      <FormInput
        label="Position"
        {...register('position')}
        error={errors.position}
        required
      />

      <FormInput
        label="Job URL"
        type="url"
        placeholder="https://..."
        {...register('jobUrl')}
        error={errors.jobUrl}
      />

      <FormInput
        label="Location"
        {...register('location')}
        error={errors.location}
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Job'}
      </button>
    </form>
  );
}
```

### Custom Error Display

```jsx
function FormField({ label, error, ...props }) {
  return (
    <div>
      <label>{label}</label>
      <input {...props} />
      {error && (
        <div style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {error.message}
        </div>
      )}
    </div>
  );
}
```

## Migration Guide

If you have existing forms using `useState`, migrate to react-hook-form:

### Before (useState):
```jsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [errors, setErrors] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  // Manual validation
  if (!email.includes('@')) {
    setErrors({ email: 'Invalid email' });
    return;
  }
  // Submit
};

return (
  <input value={email} onChange={(e) => setEmail(e.target.value)} />
);
```

### After (react-hook-form):
```jsx
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginSchema),
});

const onSubmit = async (data) => {
  // Only reaches here if validation passes
};

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <FormInput {...register('email')} error={errors.email} />
    <button type="submit">Sign In</button>
  </form>
);
```

Benefits:
- Automatic validation with Zod
- Fewer re-renders (better performance)
- Built-in error handling
- Type safety with TypeScript
- Less boilerplate code
