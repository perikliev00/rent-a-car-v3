import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import {
  AboutPage,
  ContactPage,
  FaqPage,
  HowToBookPage,
  PrivacyPage,
  SupportPage,
  TermsPage,
} from './StaticPages';

describe('StaticPages', () => {
  it.each([
    [AboutPage, 'About LuxRide'],
    [FaqPage, 'Frequently Asked Questions'],
    [TermsPage, 'Terms of Service'],
    [PrivacyPage, 'Privacy Policy'],
    [HowToBookPage, 'How to Book'],
    [SupportPage, 'Support'],
    [ContactPage, 'Contact Us'],
  ])('renders static page heading', (Page, heading) => {
    renderWithRouter(<Page />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('toggles FAQ accordion expand and collapse', () => {
    renderWithRouter(<FaqPage />);

    const firstQuestion = screen.getByRole('button', { name: 'What documents do I need?' });
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/A valid driving licence held for at least one year/i),
    ).toBeInTheDocument();

    fireEvent.click(firstQuestion);
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText(/A valid driving licence held for at least one year/i),
    ).not.toBeInTheDocument();

    const ageQuestion = screen.getByRole('button', { name: 'What is the minimum driver age?' });
    fireEvent.click(ageQuestion);
    expect(ageQuestion).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Drivers must be at least 21 years old/i)).toBeInTheDocument();
  });

  it('renders How to Book CTA linking home', () => {
    renderWithRouter(<HowToBookPage />);
    const cta = screen.getByRole('link', { name: 'Start booking' });
    expect(cta).toHaveAttribute('href', '/');
  });
});
