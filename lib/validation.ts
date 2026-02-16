/**
 * Validation and Sanitization Utilities
 * Prevents XSS, SQL injection, and other input attacks
 */

export const validation = {
  /**
   * Sanitize text input - remove HTML and dangerous characters
   */
  sanitizeText(input: string): string {
    if (!input) return '';
    return input
      .replace(/[<>\"']/g, (char) => {
        const escapeMap: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
        };
        return escapeMap[char] || char;
      })
      .trim();
  },

  /**
   * Sanitize email input
   */
  sanitizeEmail(input: string): string {
    return input.trim().toLowerCase().replace(/[^a-z0-9@._\-]/g, '');
  },

  /**
   * Sanitize phone number - keep only digits and + prefix
   */
  sanitizePhone(input: string): string {
    return input.replace(/[^\d+]/g, '');
  },

  /**
   * Sanitize numeric input
   */
  sanitizeNumber(input: string | number): number {
    const num = typeof input === 'string' ? parseFloat(input) : input;
    return isNaN(num) ? 0 : num;
  },

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  /**
   * Validate phone number format (supports various formats)
   */
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d+\s\-()]{7,20}$/;
    return phoneRegex.test(phone);
  },

  /**
   * Validate password strength
   */
  isStrongPassword(password: string): boolean {
    if (password.length < 8) return false;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return hasUppercase && hasLowercase && hasNumber && hasSpecial;
  },

  /**
   * Get password strength feedback
   */
  getPasswordStrengthFeedback(password: string): {
    score: 'weak' | 'fair' | 'good' | 'strong';
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (!password) {
      return { score: 'weak', feedback: ['Password is required'] };
    }

    if (password.length >= 8) score++;
    else feedback.push('Use at least 8 characters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Add uppercase letters');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('Add lowercase letters');

    if (/[0-9]/.test(password)) score++;
    else feedback.push('Add numbers');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
    else feedback.push('Add special characters');

    const scoreMap = { 1: 'weak', 2: 'weak', 3: 'fair', 4: 'good', 5: 'strong' } as const;
    return {
      score: scoreMap[score as keyof typeof scoreMap] || 'weak',
      feedback,
    };
  },

  /**
   * Validate date format (YYYY-MM-DD)
   */
  isValidDate(dateStr: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  },

  /**
   * Validate time format (HH:MM)
   */
  isValidTime(timeStr: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
  },

  /**
   * Validate age range
   */
  isValidAge(age: number | string): boolean {
    const num = typeof age === 'string' ? parseInt(age) : age;
    return !isNaN(num) && num >= 0 && num <= 150;
  },

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check for SQL injection patterns
   */
  hasSqlInjectionPattern(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
      /('|\")?\s*OR\s*(''|"")?/gi,
      /;/g,
    ];
    return sqlPatterns.some((pattern) => pattern.test(input));
  },

  /**
   * Check for XSS patterns
   */
  hasXssPattern(input: string): boolean {
    const xssPatterns = [/[<>\"'`]/g, /javascript:/gi, /on\w+\s*=/gi];
    return xssPatterns.some((pattern) => pattern.test(input));
  },

  /**
   * Truncate string safely
   */
  truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  },

  /**
   * Validate file upload
   */
  isValidFileUpload(
    file: File,
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: number = 10
  ): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    return { valid: true };
  },
};

/**
 * Form validation helper
 */
export function validateFormData(data: Record<string, any>, schema: Record<string, any>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && !value) {
      errors[field] = `${rules.label || field} is required`;
      continue;
    }

    if (rules.email && !validation.isValidEmail(value)) {
      errors[field] = 'Invalid email format';
    }

    if (rules.minLength && value?.length < rules.minLength) {
      errors[field] = `Must be at least ${rules.minLength} characters`;
    }

    if (rules.maxLength && value?.length > rules.maxLength) {
      errors[field] = `Must be at most ${rules.maxLength} characters`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      errors[field] = rules.message || 'Invalid format';
    }

    if (rules.custom && !rules.custom(value)) {
      errors[field] = rules.customMessage || 'Invalid value';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
