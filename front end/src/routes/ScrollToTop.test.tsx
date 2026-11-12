// Import named exports from '@testing-library/react'.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
// Import named exports from 'vitest'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from './ScrollToTop'.
import { ScrollToTop } from './ScrollToTop';

// Define the TallHome function.
function TallHome() {
  // Return control to the caller with the following value.
  return (
    <div>
      <h1>Home</h1>
      <div style={{ height: 2000 }} />
      <Link to="/about">About Us</Link>
      <Link to="/terms#payment">Terms payment</Link>
    </div>
  );
}

// Define the AboutPage function.
function AboutPage() {
  // Return control to the caller with the following value.
  return (
    <div>
      <h1>About</h1>
      <div style={{ height: 2000 }} />
    </div>
  );
}

// Define the TermsPage function.
function TermsPage() {
  // Return control to the caller with the following value.
  return (
    <div>
      <h1>Terms</h1>
      <Link to={{ hash: 'payment' }}>Payment section</Link>
      <div style={{ height: 1200 }} />
      <section id="payment">
        <h2>Payment</h2>
      </section>
    </div>
  );
}

// Define the BackButton function.
function BackButton() {
  // Create the navigate constant.
  const navigate = useNavigate();
  // Return control to the caller with the following value.
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

// Define the renderApp function.
function renderApp(initialEntry = '/') {
  // Return the resulting value to the caller.
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScrollToTop />
      <BackButton />
      <Routes>
        <Route path="/" element={<TallHome />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Declare a test suite grouping related cases.
describe('ScrollToTop', () => {
  // Continue the surrounding logic with this statement.
  let scrollToSpy: ReturnType<typeof vi.spyOn>;
  // Continue the surrounding logic with this statement.
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update scrollToSpy with the right-hand side value.
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    // Update scrollIntoViewMock with the right-hand side value.
    scrollIntoViewMock = vi.fn();
    // Call Object.defineProperty to perform this step.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      // Provide the configurable field value.
      configurable: true,
      // Provide the writable field value.
      writable: true,
      // Provide the value field value.
      value: scrollIntoViewMock,
    });
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call scrollToSpy.mockRestore to perform this step.
    scrollToSpy.mockRestore();
    // Call Reflect.deleteProperty to perform this step.
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  // Define a single test case and its expectations.
  it('scrolls to top on pathname change via Link (PUSH)', async () => {
    // Call renderApp to perform this step.
    renderApp('/');
    // Call scrollToSpy.mockClear to perform this step.
    scrollToSpy.mockClear();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('link', { name: 'About Us' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    // Assert that the value matches the intended expectation.
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('does not force scroll to top on browser back (POP)', async () => {
    // Call renderApp to perform this step.
    renderApp('/');

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('link', { name: 'About Us' }));
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    });

    // Call scrollToSpy.mockClear to perform this step.
    scrollToSpy.mockClear();
    // Call scrollIntoViewMock.mockClear to perform this step.
    scrollIntoViewMock.mockClear();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(scrollToSpy).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('scrolls hash target into view when navigating to a path with hash', async () => {
    // Call renderApp to perform this step.
    renderApp('/');
    // Call scrollToSpy.mockClear to perform this step.
    scrollToSpy.mockClear();
    // Call scrollIntoViewMock.mockClear to perform this step.
    scrollIntoViewMock.mockClear();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('link', { name: 'Terms payment' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Terms' })).toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(scrollIntoViewMock).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(scrollToSpy).not.toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  // Define a single test case and its expectations.
  it('does not reset to top for in-page hash TOC clicks', async () => {
    // Call renderApp to perform this step.
    renderApp('/terms');
    // Call scrollToSpy.mockClear to perform this step.
    scrollToSpy.mockClear();
    // Call scrollIntoViewMock.mockClear to perform this step.
    scrollIntoViewMock.mockClear();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('link', { name: 'Payment section' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(document.getElementById('payment')).toBeTruthy();
    });

    // Native hash links may update location; we must never force window top.
    const topResets = scrollToSpy.mock.calls.filter(
      // Continue the surrounding logic with this statement.
      (args) =>
        // Continue the surrounding logic with this statement.
        (typeof args[0] === 'object' && args[0] !== null && (args[0] as ScrollToOptions).top === 0) ||
        // Update args[0] with the right-hand side value.
        args[0] === 0,
    );
    // Assert that the value matches the intended expectation.
    expect(topResets).toHaveLength(0);
  });
});
