import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { runVoiceCarSearch } from './voiceSearch';

type VoiceStatus = 'idle' | 'connecting' | 'live';
type Language = 'bg' | 'en';
type FunctionCall = { type: 'function_call'; name: string; call_id: string; arguments?: string };
type RealtimeEvent = {
  type?: string;
  response?: { output?: FunctionCall[] };
  error?: { message?: string };
};

const MAX_CALL_MS = 5 * 60 * 1000;
const copy = {
  bg: {
    title: 'LuxRide гласов асистент',
    start: 'Започни разговор',
    end: 'Затвори разговора',
    connecting: 'Свързване...',
    live: 'Разговорът е активен',
    idle: 'Попитай за свободни автомобили',
    note: 'Разговаряш с AI, не със служител. Не споделяй лични документи или банкови данни.',
    link: 'Виж автомобилите и продължи с резервацията',
    error: 'Неуспешно свързване. Опитай отново.',
  },
  en: {
    title: 'LuxRide voice assistant',
    start: 'Start conversation',
    end: 'End conversation',
    connecting: 'Connecting...',
    live: 'Call is active',
    idle: 'Ask about available cars',
    note: 'You are speaking with AI, not a staff member. Do not share identity or payment details.',
    link: 'See cars and continue to booking',
    error: 'Connection failed. Please try again.',
  },
};

export function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('bg');
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState('');
  const [searchLink, setSearchLink] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const liveRef = useRef(false);

  const stop = useCallback(() => {
    generationRef.current += 1;
    busyRef.current = false;
    liveRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    setStatus('idle');
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    if (busyRef.current || liveRef.current) return;
    busyRef.current = true;
    const generation = ++generationRef.current;
    setError('');
    setSearchLink(null);
    setStatus('connecting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => { audio.srcObject = event.streams[0]; };
      peer.onconnectionstatechange = () => {
        if (generation === generationRef.current && ['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
          stop();
        }
      };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel('oai-events');
      const send = (event: unknown) => {
        if (channel.readyState === 'open') channel.send(JSON.stringify(event));
      };
      channel.onopen = () => {
        if (generation !== generationRef.current) return;
        busyRef.current = false;
        liveRef.current = true;
        setStatus('live');
        // Explicitly request a short greeting after the transport is ready.
        send({ type: 'response.create' });
      };
      channel.onmessage = (message) => {
        if (generation !== generationRef.current || typeof message.data !== 'string') return;
        let event: RealtimeEvent;
        try { event = JSON.parse(message.data) as RealtimeEvent; } catch { return; }
        if (event.type === 'error') {
          setError(event.error?.message ?? copy[language].error);
          return;
        }
        if (event.type !== 'response.done') return;
        const calls = (event.response?.output ?? []).filter(
          (item) => item.type === 'function_call' && typeof item.call_id === 'string',
        );
        if (!calls.length) return;
        void (async () => {
          for (const call of calls) {
            let output = JSON.stringify({ error: 'Unsupported function.' });
            try {
              if (call.name === 'search_available_cars') {
                if (!call.arguments || call.arguments.length > 4000) throw new Error('Invalid tool arguments.');
                const result = await runVoiceCarSearch(JSON.parse(call.arguments) as unknown);
                output = result.output;
                if (generation === generationRef.current) setSearchLink(result.link);
              }
            } catch (err) {
              output = JSON.stringify({ error: err instanceof Error ? err.message : 'Search failed.' });
            }
            if (generation !== generationRef.current) return;
            send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output } });
          }
          send({ type: 'response.create' });
        })();
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) throw new Error('WebRTC offer unavailable.');
      const data = await api<{ sdp: string }>('/api/voice/session', {
        method: 'POST',
        body: JSON.stringify({ sdp: offer.sdp, language }),
      });
      if (generation !== generationRef.current) return;
      await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      if (generation !== generationRef.current) return;
      timeoutRef.current = setTimeout(stop, MAX_CALL_MS);
    } catch {
      if (generation !== generationRef.current) return;
      stop();
      setError(copy[language].error);
    } finally {
      if (generation === generationRef.current) busyRef.current = false;
    }
  }, [language, stop]);

  const t = copy[language];
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-6">
      {open && (
        <section aria-label={t.title} className="mb-3 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold">{t.title}</h2>
            <button type="button" aria-label="Close" className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={() => { stop(); setOpen(false); }}>✕</button>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" aria-pressed={language === 'bg'} disabled={status !== 'idle'} onClick={() => setLanguage('bg')} className={language === 'bg' ? 'rounded-lg bg-slate-900 px-3 py-2 text-white' : 'rounded-lg bg-slate-100 px-3 py-2'}>БГ</button>
            <button type="button" aria-pressed={language === 'en'} disabled={status !== 'idle'} onClick={() => setLanguage('en')} className={language === 'en' ? 'rounded-lg bg-slate-900 px-3 py-2 text-white' : 'rounded-lg bg-slate-100 px-3 py-2'}>EN</button>
          </div>
          <p role="status" className="mt-4 text-sm font-semibold">{status === 'live' ? t.live : status === 'connecting' ? t.connecting : t.idle}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{t.note}</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {searchLink && <Link to={searchLink} onClick={() => { stop(); setOpen(false); }} className="mt-4 block rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900 underline">{t.link}</Link>}
          <button type="button" disabled={status === 'connecting'} onClick={() => { if (status === 'live') stop(); else void start(); }} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {status === 'live' ? t.end : t.start}
          </button>
        </section>
      )}
      <button type="button" aria-expanded={open} aria-label={t.title} onClick={() => { if (open) stop(); setOpen(!open); }} className="ml-auto flex min-h-14 items-center gap-2 rounded-full bg-[var(--color-navy)] px-5 py-3 font-semibold text-white shadow-xl ring-2 ring-white hover:opacity-90">
        <span aria-hidden="true">🎙</span> {open ? '✕' : 'AI Voice'}
      </button>
    </div>
  );
}
