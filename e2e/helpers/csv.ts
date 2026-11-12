/**
 * Minimal RFC4180-ish CSV parser for analytics export asserts.
 */
export function parseCsv(text: string): {
  // Provide the headers field value.
  headers: string[];
  // Provide the rows field value.
  rows: Record<string, string>[];
// Contribute this line to the enclosing declaration or statement.
} {
  // Create the lines constant.
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  // Evaluate the condition and enter the branch when it is true.
  if (!lines.length) return { headers: [], rows: [] };

  // Create the parse line constant.
  const parseLine = (line: string): string[] => {
    // Continue the surrounding logic with this statement.
    const cells: string[] = [];
    // Initialize the mutable cur variable.
    let cur = '';
    // Initialize the mutable in quotes variable.
    let inQuotes = false;
    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < line.length; i += 1) {
      // Create the ch constant.
      const ch = line[i];
      // Evaluate the condition and enter the branch when it is true.
      if (inQuotes) {
        // Evaluate the condition and enter the branch when it is true.
        if (ch === '"') {
          // Evaluate the condition and enter the branch when it is true.
          if (line[i + 1] === '"') {
            // Update cur with the right-hand side value.
            cur += '"';
            // Update i with the right-hand side value.
            i += 1;
          // Contribute this line to the enclosing declaration or statement.
          } else {
            // Update inQuotes with the right-hand side value.
            inQuotes = false;
          }
        // Contribute this line to the enclosing declaration or statement.
        } else {
          // Update cur with the right-hand side value.
          cur += ch;
        }
      // Continue the surrounding logic with this statement.
      } else if (ch === '"') {
        // Update inQuotes with the right-hand side value.
        inQuotes = true;
      // Continue the surrounding logic with this statement.
      } else if (ch === ',') {
        // Call cells.push to perform this step.
        cells.push(cur);
        // Update cur with the right-hand side value.
        cur = '';
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Update cur with the right-hand side value.
        cur += ch;
      }
    }
    // Call cells.push to perform this step.
    cells.push(cur);
    // Return the resulting value to the caller.
    return cells;
  };

  // Create the headers constant.
  const headers = parseLine(lines[0]);
  // Create the rows constant.
  const rows = lines.slice(1).map((line) => {
    // Create the cells constant.
    const cells = parseLine(line);
    // Continue the surrounding logic with this statement.
    const row: Record<string, string> = {};
    // Call headers.forEach to perform this step.
    headers.forEach((h, idx) => {
      // Update row[h] with the right-hand side value.
      row[h] = cells[idx] ?? '';
    });
    // Return the resulting value to the caller.
    return row;
  });

  // Return the resulting value to the caller.
  return { headers, rows };
}
