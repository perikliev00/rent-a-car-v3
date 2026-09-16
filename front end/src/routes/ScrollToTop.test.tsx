import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTop } from './ScrollToTop';

function TallHome() {
  return (
    <div>
      <h1>Home</h1>
      <div style={{ height: 2000 }} />
      <Link to="/about">About Us</Link>
      <Link to="/terms#payment">Terms payment</Link>
    </div>
  );
}

function AboutPage() {
  return (
    <div>
      <h1>About</h1>
      <div style={{ height: 2000 }} />
    </div>
  );
}

function TermsPage() {
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

function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

function renderApp(initialEntry = '/') {
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

describe('ScrollToTop', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('scrolls to top on pathname change via Link (PUSH)', async () => {
    renderApp('/');
    scrollToSpy.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'About Us' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    });
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not force scroll to top on browser back (POP)', async () => {
    renderApp('/');

    fireEvent.click(screen.getByRole('link', { name: 'About Us' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    });

    scrollToSpy.mockClear();
    scrollIntoViewMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('scrolls hash target into view when navigating to a path with hash', async () => {
    renderApp('/');
    scrollToSpy.mockClear();
    scrollIntoViewMock.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Terms payment' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Terms' })).toBeInTheDocument();
    });
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(scrollToSpy).not.toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('does not reset to top for in-page hash TOC clicks', async () => {
    renderApp('/terms');
    scrollToSpy.mockClear();
    scrollIntoViewMock.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Payment section' }));

    await waitFor(() => {
      expect(document.getElementById('payment')).toBeTruthy();
    });

    // Native hash links may update location; we must never force window top.
    const topResets = scrollToSpy.mock.calls.filter(
      (args) =>
        (typeof args[0] === 'object' && args[0] !== null && (args[0] as ScrollToOptions).top === 0) ||
        args[0] === 0,
    );
    expect(topResets).toHaveLength(0);
  });
});
