/**
 * Public contact form that posts to `/api/contacts` and surfaces API errors inline.
 */
import { useMutation } from '@tanstack/react-query';
// Import named exports from 'react'.
import { type FormEvent, useState } from 'react';
// Import named exports from '../../api/contacts'.
import { createContact } from '../../api/contacts';
// Import named exports from '../ui/Button'.
import { Button } from '../ui/Button';
// Import named exports from '../ui/Input'.
import { Input } from '../ui/Input';
// Import named exports from '../ui/Textarea'.
import { Textarea } from '../ui/Textarea';
// Import named exports from '../ui/toastStore'.
import { toast } from '../ui/toastStore';

/** Simple email shape check used before the API call. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Declare the ContactFormFields TypeScript type alias.
type ContactFormFields = {
  // Provide the name field value.
  name: string;
  // Provide the email field value.
  email: string;
  // Provide the phone field value.
  phone: string;
  // Provide the subject field value.
  subject: string;
  // Provide the message field value.
  message: string;
};

// Declare the ContactFormErrors TypeScript type alias.
type ContactFormErrors = Partial<Record<keyof ContactFormFields, string>>;

/** Empty form used for initial state and post-success reset. */
const emptyContactForm: ContactFormFields = {
  // Provide the name field value.
  name: '',
  // Provide the email field value.
  email: '',
  // Provide the phone field value.
  phone: '',
  // Provide the subject field value.
  subject: '',
  // Provide the message field value.
  message: '',
};

/**
 * Client-side validation mirroring common server constraints.
 *
 * @param values - Current form field values.
 * @returns Sparse error map keyed by field; empty when valid.
 */
function validateContactForm(values: ContactFormFields): ContactFormErrors {
  // Continue the surrounding logic with this statement.
  const errors: ContactFormErrors = {};
  // Create the name constant.
  const name = values.name.trim();
  // Create the email constant.
  const email = values.email.trim();
  // Create the phone constant.
  const phone = values.phone.trim();
  // Create the subject constant.
  const subject = values.subject.trim();
  // Create the message constant.
  const message = values.message.trim();

  // Evaluate the condition and enter the branch when it is true.
  if (!name) errors.name = 'Please enter your name';
  // Handle this alternate condition when prior checks failed.
  else if (name.length > 255) errors.name = 'Name must be at most 255 characters';

  // Evaluate the condition and enter the branch when it is true.
  if (!email) errors.email = 'Please enter your email';
  // Handle this alternate condition when prior checks failed.
  else if (!EMAIL_RE.test(email) || email.length > 255) {
    // Update errors.email with the right-hand side value.
    errors.email = 'Please enter a valid email address';
  }

  // Evaluate the condition and enter the branch when it is true.
  if (phone.length > 50) errors.phone = 'Phone must be at most 50 characters';

  // Evaluate the condition and enter the branch when it is true.
  if (!subject) errors.subject = 'Please enter a subject';
  // Handle this alternate condition when prior checks failed.
  else if (subject.length > 255) errors.subject = 'Subject must be at most 255 characters';

  // Evaluate the condition and enter the branch when it is true.
  if (!message) errors.message = 'Please enter a message';
  // Handle this alternate condition when prior checks failed.
  else if (message.length < 10 || message.length > 5000) {
    // Update errors.message with the right-hand side value.
    errors.message = 'Message must be between 10 and 5000 characters';
  }

  // Return the resulting value to the caller.
  return errors;
}

/**
 * Public contact form that posts to `/api/contacts`.
 *
 * @returns Controlled form with field errors and toast feedback.
 * @remarks Side effects: creates a contact via the API; shows success/error toasts.
 */
export function ContactForm() {
  // Destructure array values into local variables.
  const [form, setForm] = useState<ContactFormFields>(emptyContactForm);
  // Destructure array values into local variables.
  const [errors, setErrors] = useState<ContactFormErrors>({});

  // Create the mutation constant.
  const mutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: (payload: Parameters<typeof createContact>[0]) => createContact(payload),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Message sent. We will get back to you soon.', 'success');
      // Call setForm to perform this step.
      setForm(emptyContactForm);
      // Call setErrors to perform this step.
      setErrors({});
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message || 'Failed to send message.', 'error'),
  });

  /**
   * Update one field and clear its error once the user edits it.
   *
   * @param key - Field name.
   * @param value - Next field value.
   */
  function updateField<K extends keyof ContactFormFields>(key: K, value: ContactFormFields[K]) {
    // Call setForm to perform this step.
    setForm((prev) => ({ ...prev, [key]: value }));
    // Evaluate the condition and enter the branch when it is true.
    if (errors[key]) {
      // Call setErrors to perform this step.
      setErrors((prev) => {
        // Create the next constant.
        const next = { ...prev };
        // Delete the specified property from the object.
        delete next[key];
        // Return the resulting value to the caller.
        return next;
      });
    }
  }

  /**
   * Validate, then submit a trimmed payload (omitting empty phone).
   *
   * @param event - Form submit event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Call event.preventDefault to perform this step.
    event.preventDefault();
    // Create the next errors constant.
    const nextErrors = validateContactForm(form);
    // Call setErrors to perform this step.
    setErrors(nextErrors);
    // Evaluate the condition and enter the branch when it is true.
    if (Object.keys(nextErrors).length > 0) return;

    // Create the payload constant.
    const payload = {
      // Provide the name field value.
      name: form.name.trim(),
      // Provide the email field value.
      email: form.email.trim(),
      // Provide the subject field value.
      subject: form.subject.trim(),
      // Provide the message field value.
      message: form.message.trim(),
      // Phone is optional — omit rather than send an empty string.
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    };
    // Call mutation.mutate to perform this step.
    mutation.mutate(payload);
  }

  // Return control to the caller with the following value.
  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input
        label="Name"
        name="name"
        autoComplete="name"
        value={form.name}
        onChange={(e) => updateField('name', e.target.value)}
        error={errors.name}
        disabled={mutation.isPending}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => updateField('email', e.target.value)}
        error={errors.email}
        disabled={mutation.isPending}
      />
      <Input
        label="Phone (optional)"
        id="phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={form.phone}
        onChange={(e) => updateField('phone', e.target.value)}
        error={errors.phone}
        disabled={mutation.isPending}
      />
      <Input
        label="Subject"
        name="subject"
        value={form.subject}
        onChange={(e) => updateField('subject', e.target.value)}
        error={errors.subject}
        disabled={mutation.isPending}
      />
      <Textarea
        label="Message"
        name="message"
        rows={5}
        value={form.message}
        onChange={(e) => updateField('message', e.target.value)}
        error={errors.message}
        disabled={mutation.isPending}
      />
      <Button type="submit" loading={mutation.isPending}>
        Send message
      </Button>
    </form>
  );
}
