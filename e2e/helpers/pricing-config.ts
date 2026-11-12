// Import named exports from './db'.
import { withDb } from './db';

// Export the pricing config snapshot type.
export type PricingConfigSnapshot = {
  // Provide the global fees field value.
  globalFees: Array<Record<string, unknown>>;
  // Provide the extras field value.
  extras: Array<Record<string, unknown>>;
  // Provide the delivery fees field value.
  deliveryFees: Array<Record<string, unknown>>;
  // Provide the seasons field value.
  seasons: Array<Record<string, unknown>>;
  // Provide the weekend rules field value.
  weekendRules: Array<Record<string, unknown>>;
  // Provide the discount rules field value.
  discountRules: Array<Record<string, unknown>>;
  // Provide the deposit rules field value.
  depositRules: Array<Record<string, unknown>>;
};

// Export the async snapshotPricingConfig function.
export async function snapshotPricingConfig(): Promise<PricingConfigSnapshot> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the global fees constant.
    const globalFees = await client.query(
      // Supply the literal value used by the enclosing expression.
      'SELECT fee_key, label, amount, mode, active FROM pricing_global_fees ORDER BY fee_key'
    );
    // Create the extras constant.
    const extras = await client.query(
      // Supply the literal value used by the enclosing expression.
      'SELECT id, code, label, mode, amount, active, sort_order FROM pricing_extras ORDER BY id'
    );
    // Create the delivery fees constant.
    const deliveryFees = await client.query(
      // Supply the literal value used by the enclosing expression.
      'SELECT location_id, fee FROM pricing_delivery_fees ORDER BY location_id'
    );
    // Create the seasons constant.
    const seasons = await client.query(
      `SELECT id, name, start_month, start_day, end_month, end_day, adj_type, adj_value, active
       FROM pricing_seasons ORDER BY id`
    );
    // Create the weekend rules constant.
    const weekendRules = await client.query(
      `SELECT id, name, weekdays, adj_type, adj_value, active
       FROM pricing_weekend_rules ORDER BY id`
    );
    // Create the discount rules constant.
    const discountRules = await client.query(
      `SELECT id, kind, name, threshold, adj_type, adj_value, active
       FROM pricing_discount_rules ORDER BY id`
    );
    // Create the deposit rules constant.
    const depositRules = await client.query(
      `SELECT id, name, default_amount, active
       FROM pricing_deposit_rules ORDER BY id`
    );

    // Return the resulting value to the caller.
    return {
      // Provide the global fees field value.
      globalFees: globalFees.rows,
      // Provide the extras field value.
      extras: extras.rows,
      // Provide the delivery fees field value.
      deliveryFees: deliveryFees.rows,
      // Provide the seasons field value.
      seasons: seasons.rows,
      // Provide the weekend rules field value.
      weekendRules: weekendRules.rows,
      // Provide the discount rules field value.
      discountRules: discountRules.rows,
      // Provide the deposit rules field value.
      depositRules: depositRules.rows,
    };
  });
}

// Export the async restorePricingConfig function.
export async function restorePricingConfig(snapshot: PricingConfigSnapshot): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Start a try block for operations that may fail.
    try {
      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.globalFees) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_global_fees
          SET label = $2, amount = $3, mode = $4, active = $5, updated_at = NOW()
          WHERE fee_key = $1
          `,
          // Contribute this line to the enclosing declaration or statement.
          [row.fee_key, row.label, row.amount, row.mode, row.active]
        );
      }

      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.extras) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_extras
          SET label = $2, mode = $3, amount = $4, active = $5, sort_order = $6, updated_at = NOW()
          WHERE id = $1
          `,
          // Contribute this line to the enclosing declaration or statement.
          [row.id, row.label, row.mode, row.amount, row.active, row.sort_order]
        );
      }

      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.deliveryFees) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_delivery_fees
          SET fee = $2, updated_at = NOW()
          WHERE location_id = $1
          `,
          // Contribute this line to the enclosing declaration or statement.
          [row.location_id, row.fee]
        );
      }

      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.seasons ?? []) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_seasons
          SET name = $2, start_month = $3, start_day = $4, end_month = $5, end_day = $6,
              adj_type = $7, adj_value = $8, active = $9, updated_at = NOW()
          WHERE id = $1
          `,
          [
            // Contribute this line to the enclosing declaration or statement.
            row.id,
            // Contribute this line to the enclosing declaration or statement.
            row.name,
            // Contribute this line to the enclosing declaration or statement.
            row.start_month,
            // Contribute this line to the enclosing declaration or statement.
            row.start_day,
            // Contribute this line to the enclosing declaration or statement.
            row.end_month,
            // Contribute this line to the enclosing declaration or statement.
            row.end_day,
            // Contribute this line to the enclosing declaration or statement.
            row.adj_type,
            // Contribute this line to the enclosing declaration or statement.
            row.adj_value,
            // Contribute this line to the enclosing declaration or statement.
            row.active,
          ]
        );
      }

      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.weekendRules ?? []) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_weekend_rules
          SET name = $2, weekdays = $3, adj_type = $4, adj_value = $5, active = $6, updated_at = NOW()
          WHERE id = $1
          `,
          // Contribute this line to the enclosing declaration or statement.
          [row.id, row.name, row.weekdays, row.adj_type, row.adj_value, row.active]
        );
      }

      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.discountRules ?? []) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_discount_rules
          SET kind = $2, name = $3, threshold = $4, adj_type = $5, adj_value = $6, active = $7,
              updated_at = NOW()
          WHERE id = $1
          `,
          [
            // Contribute this line to the enclosing declaration or statement.
            row.id,
            // Contribute this line to the enclosing declaration or statement.
            row.kind,
            // Contribute this line to the enclosing declaration or statement.
            row.name,
            // Contribute this line to the enclosing declaration or statement.
            row.threshold,
            // Contribute this line to the enclosing declaration or statement.
            row.adj_type,
            // Contribute this line to the enclosing declaration or statement.
            row.adj_value,
            // Contribute this line to the enclosing declaration or statement.
            row.active,
          ]
        );
      }

      // Iterate using the loop initializer, condition, and step.
      for (const row of snapshot.depositRules ?? []) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          UPDATE pricing_deposit_rules
          SET name = $2, default_amount = $3, active = $4, updated_at = NOW()
          WHERE id = $1
          `,
          // Contribute this line to the enclosing declaration or statement.
          [row.id, row.name, row.default_amount, row.active]
        );
      }

      // Create the season ids constant.
      const seasonIds = (snapshot.seasons ?? []).map((r) => Number(r.id)).filter(Boolean);
      // Evaluate the condition and enter the branch when it is true.
      if (seasonIds.length) {
        // Wait until the asynchronous operation resolves.
        await client.query(`DELETE FROM pricing_seasons WHERE NOT (id = ANY($1::bigint[]))`, [
          // Contribute this line to the enclosing declaration or statement.
          seasonIds,
        ]);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Wait until the asynchronous operation resolves.
        await client.query(`DELETE FROM pricing_seasons`);
      }

      // Create the extra ids constant.
      const extraIds = (snapshot.extras ?? []).map((r) => Number(r.id)).filter(Boolean);
      // Evaluate the condition and enter the branch when it is true.
      if (extraIds.length) {
        // Wait until the asynchronous operation resolves.
        await client.query(`DELETE FROM pricing_extras WHERE NOT (id = ANY($1::bigint[]))`, [
          // Contribute this line to the enclosing declaration or statement.
          extraIds,
        ]);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Wait until the asynchronous operation resolves.
        await client.query(`DELETE FROM pricing_extras`);
      }

      // Wait until the asynchronous operation resolves.
      await client.query('COMMIT');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK');
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Export the async withPricingConfig function.
export async function withPricingConfig<T>(
  // Provide the fn field value.
  fn: (snapshot: PricingConfigSnapshot) => Promise<T>
// Continue the surrounding logic with this statement.
): Promise<T> {
  // Create the snapshot constant.
  const snapshot = await snapshotPricingConfig();
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await fn(snapshot);
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await restorePricingConfig(snapshot);
  }
}

/** Bump hotel_delivery global fee amount (for MONEY-012). Returns previous amount. */
export async function bumpHotelDeliveryFee(delta = 100): Promise<{ before: number; after: number }> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the current constant.
    const current = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT amount FROM pricing_global_fees WHERE fee_key = 'hotel_delivery'`
    );
    // Create the before constant.
    const before = Number(current.rows[0]?.amount ?? 0);
    // Create the after constant.
    const after = before + delta;
    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `
      UPDATE pricing_global_fees
      SET amount = $1, updated_at = NOW()
      WHERE fee_key = 'hotel_delivery'
      `,
      // Contribute this line to the enclosing declaration or statement.
      [after]
    );
    // Return the resulting value to the caller.
    return { before, after };
  });
}

/**
 * Bump the first active season adj_value (percent or absolute).
 * Creates a year-round percent season if none exist.
 */
export async function bumpSeasonSurcharge(
  // Update delta with the right-hand side value.
  delta = 50
// Continue the surrounding logic with this statement.
): Promise<{ before: number; after: number; seasonId: number }> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the existing constant.
    const existing = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT id, adj_value, adj_type FROM pricing_seasons WHERE active = TRUE ORDER BY id LIMIT 1`
    );
    // Evaluate the condition and enter the branch when it is true.
    if (existing.rows[0]) {
      // Create the before constant.
      const before = Number(existing.rows[0].adj_value ?? 0);
      // Create the after constant.
      const after = before + delta;
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `UPDATE pricing_seasons SET adj_value = $2, updated_at = NOW() WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [existing.rows[0].id, after]
      );
      // Return the resulting value to the caller.
      return { before, after, seasonId: Number(existing.rows[0].id) };
    }
    // Create the inserted constant.
    const inserted = await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO pricing_seasons (
        name, start_month, start_day, end_month, end_day, adj_type, adj_value, active
      ) VALUES ('E2E Season', 1, 1, 12, 31, 'percent', $1, TRUE)
      RETURNING id, adj_value
      `,
      // Contribute this line to the enclosing declaration or statement.
      [delta]
    );
    // Return the resulting value to the caller.
    return {
      // Provide the before field value.
      before: 0,
      // Provide the after field value.
      after: Number(inserted.rows[0].adj_value),
      // Provide the season id field value.
      seasonId: Number(inserted.rows[0].id),
    };
  });
}

/** Bump the first weekend rule adj_value (creates one if missing). */
export async function bumpWeekendSurcharge(
  // Update delta with the right-hand side value.
  delta = 40
// Continue the surrounding logic with this statement.
): Promise<{ before: number; after: number; ruleId: number }> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the existing constant.
    const existing = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT id, adj_value FROM pricing_weekend_rules WHERE active = TRUE ORDER BY id LIMIT 1`
    );
    // Evaluate the condition and enter the branch when it is true.
    if (existing.rows[0]) {
      // Create the before constant.
      const before = Number(existing.rows[0].adj_value ?? 0);
      // Create the after constant.
      const after = before + delta;
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `UPDATE pricing_weekend_rules SET adj_value = $2, updated_at = NOW() WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [existing.rows[0].id, after]
      );
      // Return the resulting value to the caller.
      return { before, after, ruleId: Number(existing.rows[0].id) };
    }
    // Create the inserted constant.
    const inserted = await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO pricing_weekend_rules (name, weekdays, adj_type, adj_value, active)
      VALUES ('E2E Weekend', ARRAY[5,6,7], 'percent', $1, TRUE)
      RETURNING id, adj_value
      `,
      // Contribute this line to the enclosing declaration or statement.
      [delta]
    );
    // Return the resulting value to the caller.
    return {
      // Provide the before field value.
      before: 0,
      // Provide the after field value.
      after: Number(inserted.rows[0].adj_value),
      // Provide the rule id field value.
      ruleId: Number(inserted.rows[0].id),
    };
  });
}
