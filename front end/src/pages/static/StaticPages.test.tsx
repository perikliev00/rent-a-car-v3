// Import named exports from '@testing-library/react'.
import { fireEvent, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  AboutPage,
  // Contribute this line to the enclosing declaration or statement.
  ContactPage,
  // Contribute this line to the enclosing declaration or statement.
  FaqPage,
  // Contribute this line to the enclosing declaration or statement.
  HowToBookPage,
  // Contribute this line to the enclosing declaration or statement.
  PrivacyPage,
  // Contribute this line to the enclosing declaration or statement.
  SupportPage,
  // Contribute this line to the enclosing declaration or statement.
  TermsPage,
// Contribute this line to the enclosing declaration or statement.
} from './StaticPages';

// Declare a test suite grouping related cases.
describe('StaticPages', () => {
  // Call it.each to perform this step.
  it.each([
    // Contribute this line to the enclosing declaration or statement.
    [AboutPage, 'About LuxRide'],
    // Contribute this line to the enclosing declaration or statement.
    [FaqPage, 'Frequently Asked Questions'],
    // Contribute this line to the enclosing declaration or statement.
    [TermsPage, 'Terms of Service'],
    // Contribute this line to the enclosing declaration or statement.
    [PrivacyPage, 'Privacy Policy'],
    // Contribute this line to the enclosing declaration or statement.
    [HowToBookPage, 'How to Book'],
    // Contribute this line to the enclosing declaration or statement.
    [SupportPage, 'Support'],
    // Contribute this line to the enclosing declaration or statement.
    [ContactPage, 'Contact Us'],
  // Continue the surrounding logic with this statement.
  ])('renders static page heading', (Page, heading) => {
    renderWithRouter(<Page />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('toggles FAQ accordion expand and collapse', () => {
    renderWithRouter(<FaqPage />);

    // Create the first question constant.
    const firstQuestion = screen.getByRole('button', { name: 'What documents do I need?' });
    // Assert that the value matches the intended expectation.
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
    // Assert that the value matches the intended expectation.
    expect(
      // Call screen.getByText to perform this step.
      screen.getByText(/A valid driving licence held for at least one year/i),
    // Continue the surrounding logic with this statement.
    ).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(firstQuestion);
    // Assert that the value matches the intended expectation.
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
    // Assert that the value matches the intended expectation.
    expect(
      // Call screen.queryByText to perform this step.
      screen.queryByText(/A valid driving licence held for at least one year/i),
    // Continue the surrounding logic with this statement.
    ).not.toBeInTheDocument();

    // Create the age question constant.
    const ageQuestion = screen.getByRole('button', { name: 'What is the minimum driver age?' });
    // Call fireEvent.click to perform this step.
    fireEvent.click(ageQuestion);
    // Assert that the value matches the intended expectation.
    expect(ageQuestion).toHaveAttribute('aria-expanded', 'true');
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(/Drivers must be at least 21 years old/i)).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders How to Book CTA linking home', () => {
    renderWithRouter(<HowToBookPage />);
    // Create the cta constant.
    const cta = screen.getByRole('link', { name: 'Start booking' });
    // Assert that the value matches the intended expectation.
    expect(cta).toHaveAttribute('href', '/');
  });
});
