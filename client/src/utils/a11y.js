/**
 * Accessibility utilities and helpers
 * Based on WCAG 2.1 AA standards
 */

/**
 * Generate unique IDs for form elements and their error messages
 * Ensures aria-describedby relationships are unique
 */
export function generateFieldId(fieldName) {
  return `field-${fieldName.replace(/\[|\]/g, '-')}`;
}

export function generateErrorId(fieldName) {
  return `${generateFieldId(fieldName)}-error`;
}

/**
 * Check if an element requires ARIA label
 * Returns true if element is interactive and needs accessible name
 */
export function requiresAriaLabel(type) {
  const labelRequiredTypes = [
    'button',
    'input',
    'select',
    'textarea',
    'link',
    'heading',
  ];
  return labelRequiredTypes.includes(type);
}

/**
 * Create accessible button with proper states
 */
export function createAccessibleButton(label, disabled = false, loading = false) {
  return {
    'aria-label': label,
    'aria-disabled': disabled || loading,
    disabled: disabled || loading,
  };
}

/**
 * Create accessible modal dialog attributes
 */
export function createAccessibleDialog(title, isDismissible = true) {
  return {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': `dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`,
    'aria-describedby': `dialog-desc-${title.replace(/\s+/g, '-').toLowerCase()}`,
  };
}

/**
 * Create accessible icon button (for icon-only buttons)
 * Must provide aria-label since icon text is not readable
 */
export function createAccessibleIconButton(label, disabled = false) {
  return {
    'aria-label': label,
    'aria-disabled': disabled,
    disabled,
    type: 'button',
  };
}

/**
 * Announce dynamic content updates to screen readers
 * Use with aria-live regions
 */
export const ANNOUNCEMENT_LEVELS = {
  POLITE: 'polite', // Waits for a pause in speech
  ASSERTIVE: 'assertive', // Interrupts current speech
  ALERT: 'alert', // Abbreviated form of aria-live="assertive" aria-atomic="true"
};

/**
 * Create accessible list with aria attributes
 */
export function createAccessibleList(items, isOrdered = false) {
  return {
    role: isOrdered ? 'list' : 'list',
    'aria-label': isOrdered ? 'Numbered list' : 'List',
    items: items.map((item, index) => ({
      role: 'listitem',
      'data-index': index,
      ...item,
    })),
  };
}

/**
 * ARIA live region for status messages
 * Use to announce async loading/success/error states
 */
export function createAccessibleMessage(message, type = 'status') {
  const ariaLiveLevel = type === 'error' ? ANNOUNCEMENT_LEVELS.ASSERTIVE : ANNOUNCEMENT_LEVELS.POLITE;
  return {
    role: 'status',
    'aria-live': ariaLiveLevel,
    'aria-atomic': 'true',
    children: message,
  };
}

/**
 * Accessible skip link for keyboard navigation
 * Place at top of page, hidden but focusable
 */
export const skipLinkCSS = `
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
  }

  .skip-link:focus {
    top: 0;
  }
`;

/**
 * Accessible focus management
 * Move focus to an element (useful after dialogs close, forms submit, etc)
 */
export function moveFocusToElement(ref) {
  if (ref?.current) {
    ref.current.focus();
    // Ensure element is visible to screen readers
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Create accessible loading state
 */
export function createAccessibleLoadingState(isLoading, message = 'Loading') {
  return {
    'aria-busy': isLoading,
    'aria-label': isLoading ? message : undefined,
  };
}

/**
 * Common ARIA labels for buttons
 */
export const ARIA_LABELS = {
  CLOSE: 'Close',
  SUBMIT: 'Submit form',
  CANCEL: 'Cancel',
  SAVE: 'Save changes',
  DELETE: 'Delete',
  EDIT: 'Edit',
  SEARCH: 'Search',
  MENU: 'Menu',
  PREVIOUS: 'Previous',
  NEXT: 'Next',
  EXPAND: 'Expand',
  COLLAPSE: 'Collapse',
  LOADING: 'Loading...',
};

/**
 * Test if element is keyboard accessible
 * Returns array of issues found
 */
export function checkKeyboardAccessibility(element) {
  const issues = [];

  if (!element) return issues;

  const interactiveElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]'
  );

  interactiveElements.forEach((el) => {
    // Check if element is keyboard accessible
    if (el.tabIndex < -1) {
      issues.push(`Element ${el.tagName} has negative tabIndex`);
    }

    // Check if interactive element has label
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      const hasLabel = el.getAttribute('aria-label') ||
                      el.getAttribute('aria-labelledby') ||
                      el.previousElementSibling?.tagName === 'LABEL';
      if (!hasLabel) {
        issues.push(`${el.tagName} missing accessible label`);
      }
    }

    // Check button accessibility
    if (el.tagName === 'BUTTON') {
      const hasContent = el.textContent?.trim() || el.getAttribute('aria-label');
      if (!hasContent) {
        issues.push('Button missing text or aria-label');
      }
    }
  });

  return issues;
}

/**
 * Create accessible data table
 */
export function createAccessibleTable(title, headers) {
  return {
    role: 'table',
    'aria-label': title,
    children: {
      thead: {
        role: 'rowgroup',
        children: headers.map((header, idx) => ({
          role: 'columnheader',
          'aria-colindex': idx + 1,
          children: header,
        })),
      },
    },
  };
}

export default {
  generateFieldId,
  generateErrorId,
  requiresAriaLabel,
  createAccessibleButton,
  createAccessibleDialog,
  createAccessibleIconButton,
  createAccessibleList,
  createAccessibleMessage,
  createAccessibleLoadingState,
  ARIA_LABELS,
  checkKeyboardAccessibility,
  ANNOUNCEMENT_LEVELS,
};
