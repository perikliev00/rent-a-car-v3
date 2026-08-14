import { format, parseISO } from 'date-fns';

export function fmt(iso: string) {
  try {
    return format(parseISO(iso), 'd MMM yyyy HH:mm');
  } catch {
    return iso;
  }
}
