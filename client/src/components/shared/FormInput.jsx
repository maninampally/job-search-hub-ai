import React from 'react';
import styles from './FormInput.module.css';

/**
 * FormInput - Reusable input component with validation support
 * Compatible with react-hook-form
 */
const FormInput = React.forwardRef(({
  label,
  name,
  type = 'text',
  placeholder,
  error,
  disabled = false,
  autoComplete,
  required = false,
  ...props
}, ref) => {
  const ariaLabel = props['aria-label'];
  const hasError = Boolean(error);
  
  return (
    <div className={styles.formGroup}>
      {label && (
        <label htmlFor={name} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-label={ariaLabel || label}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
        className={`${styles.input} ${hasError ? styles.inputError : ''}`}
        {...props}
      />
      {error && (
        <span id={`${name}-error`} className={styles.error} role="alert">
          {error.message || error}
        </span>
      )}
    </div>
  );
});

FormInput.displayName = 'FormInput';

export default FormInput;
