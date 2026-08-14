declare module 'pg' {
  export class Client {
    constructor(config?: { connectionString?: string });
    connect(): Promise<void>;
    end(): Promise<void>;
    query<T = any>(
      text: string,
      params?: unknown[]
    ): Promise<{ rows: T[]; rowCount: number | null }>;
  }
}

declare module 'bcrypt' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}
