// Contribute this line to the enclosing declaration or statement.
declare module 'pg' {
  // Export the client class.
  export class Client {
    // Call constructor to perform this step.
    constructor(config?: { connectionString?: string });
    // Call connect to perform this step.
    connect(): Promise<void>;
    // Call end to perform this step.
    end(): Promise<void>;
    // Continue the surrounding logic with this statement.
    query<T = any>(
      // Provide the text field value.
      text: string,
      // Contribute this line to the enclosing declaration or statement.
      params?: unknown[]
    // Continue the surrounding logic with this statement.
    ): Promise<{ rows: T[]; rowCount: number | null }>;
  }
}

// Contribute this line to the enclosing declaration or statement.
declare module 'bcrypt' {
  // Export the hash function.
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  // Export the compare function.
  export function compare(data: string, encrypted: string): Promise<boolean>;
}
