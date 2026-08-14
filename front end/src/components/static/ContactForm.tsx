import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { createContact } from '../../api/contacts';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { toast } from '../ui/toastStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactFormFields = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

type ContactFormErrors = Partial<Record<keyof ContactFormFields, string>>;

const emptyContactForm: ContactFormFields = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

function validateContactForm(values: ContactFormFields): ContactFormErrors {
  const errors: ContactFormErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();
  const subject = values.subject.trim();
  const message = values.message.trim();

  if (!name) errors.name = 'Please enter your name';
  else if (name.length > 255) errors.name = 'Name must be at most 255 characters';

  if (!email) errors.email = 'Please enter your email';
  else if (!EMAIL_RE.test(email) || email.length > 255) {
    errors.email = 'Please enter a valid email address';
  }

  if (phone.length > 50) errors.phone = 'Phone must be at most 50 characters';

  if (!subject) errors.subject = 'Please enter a subject';
  else if (subject.length > 255) errors.subject = 'Subject must be at most 255 characters';

  if (!message) errors.message = 'Please enter a message';
  else if (message.length < 10 || message.length > 5000) {
    errors.message = 'Message must be between 10 and 5000 characters';
  }

  return errors;
}

export function ContactForm() {
  const [form, setForm] = useState<ContactFormFields>(emptyContactForm);
  const [errors, setErrors] = useState<ContactFormErrors>({});

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createContact>[0]) => createContact(payload),
    onSuccess: () => {
      toast('Message sent. We will get back to you soon.', 'success');
      setForm(emptyContactForm);
      setErrors({});
    },
    onError: (err) => toast((err as Error).message || 'Failed to send message.', 'error'),
  });

  function updateField<K extends keyof ContactFormFields>(key: K, value: ContactFormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContactForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    };
    mutation.mutate(payload);
  }

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
