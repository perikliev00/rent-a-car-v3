import { withDb } from './db';

export type PricingConfigSnapshot = {
  globalFees: Array<Record<string, unknown>>;
  extras: Array<Record<string, unknown>>;
  deliveryFees: Array<Record<string, unknown>>;
  seasons: Array<Record<string, unknown>>;
  weekendRules: Array<Record<string, unknown>>;
  discountRules: Array<Record<string, unknown>>;
  depositRules: Array<Record<string, unknown>>;
};

export async function snapshotPricingConfig(): Promise<PricingConfigSnapshot> {
  return withDb(async (client) => {
    const globalFees = await client.query(
      'SELECT fee_key, label, amount, mode, active FROM pricing_global_fees ORDER BY fee_key'
    );
    const extras = await client.query(
      'SELECT id, code, label, mode, amount, active, sort_order FROM pricing_extras ORDER BY id'
    );
    const deliveryFees = await client.query(
      'SELECT location_id, fee FROM pricing_delivery_fees ORDER BY location_id'
    );
    const seasons = await client.query(
      `SELECT id, name, start_month, start_day, end_month, end_day, adj_type, adj_value, active
       FROM pricing_seasons ORDER BY id`
    );
    const weekendRules = await client.query(
      `SELECT id, name, weekdays, adj_type, adj_value, active
       FROM pricing_weekend_rules ORDER BY id`
    );
    const discountRules = await client.query(
      `SELECT id, kind, name, threshold, adj_type, adj_value, active
       FROM pricing_discount_rules ORDER BY id`
    );
    const depositRules = await client.query(
      `SELECT id, name, default_amount, active
       FROM pricing_deposit_rules ORDER BY id`
    );

    return {
      globalFees: globalFees.rows,
      extras: extras.rows,
      deliveryFees: deliveryFees.rows,
      seasons: seasons.rows,
      weekendRules: weekendRules.rows,
      discountRules: discountRules.rows,
      depositRules: depositRules.rows,
    };
  });
}

export async function restorePricingConfig(snapshot: PricingConfigSnapshot): Promise<void> {
  await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of snapshot.globalFees) {
        await client.query(
          `
          UPDATE pricing_global_fees
          SET label = $2, amount = $3, mode = $4, active = $5, updated_at = NOW()
          WHERE fee_key = $1
          `,
          [row.fee_key, row.label, row.amount, row.mode, row.active]
        );
      }

      for (const row of snapshot.extras) {
        await client.query(
          `
          UPDATE pricing_extras
          SET label = $2, mode = $3, amount = $4, active = $5, sort_order = $6, updated_at = NOW()
          WHERE id = $1
          `,
          [row.id, row.label, row.mode, row.amount, row.active, row.sort_order]
        );
      }

      for (const row of snapshot.deliveryFees) {
        await client.query(
          `
          UPDATE pricing_delivery_fees
          SET fee = $2, updated_at = NOW()
          WHERE location_id = $1
          `,
          [row.location_id, row.fee]
        );
      }

      for (const row of snapshot.seasons ?? []) {
        await client.query(
          `
          UPDATE pricing_seasons
          SET name = $2, start_month = $3, start_day = $4, end_month = $5, end_day = $6,
              adj_type = $7, adj_value = $8, active = $9, updated_at = NOW()
          WHERE id = $1
          `,
          [
            row.id,
            row.name,
            row.start_month,
            row.start_day,
            row.end_month,
            row.end_day,
            row.adj_type,
            row.adj_value,
            row.active,
          ]
        );
      }

      for (const row of snapshot.weekendRules ?? []) {
        await client.query(
          `
          UPDATE pricing_weekend_rules
          SET name = $2, weekdays = $3, adj_type = $4, adj_value = $5, active = $6, updated_at = NOW()
          WHERE id = $1
          `,
          [row.id, row.name, row.weekdays, row.adj_type, row.adj_value, row.active]
        );
      }

      for (const row of snapshot.discountRules ?? []) {
        await client.query(
          `
          UPDATE pricing_discount_rules
          SET kind = $2, name = $3, threshold = $4, adj_type = $5, adj_value = $6, active = $7,
              updated_at = NOW()
          WHERE id = $1
          `,
          [
            row.id,
            row.kind,
            row.name,
            row.threshold,
            row.adj_type,
            row.adj_value,
            row.active,
          ]
        );
      }

      for (const row of snapshot.depositRules ?? []) {
        await client.query(
          `
          UPDATE pricing_deposit_rules
          SET name = $2, default_amount = $3, active = $4, updated_at = NOW()
          WHERE id = $1
          `,
          [row.id, row.name, row.default_amount, row.active]
        );
      }

      const seasonIds = (snapshot.seasons ?? []).map((r) => Number(r.id)).filter(Boolean);
      if (seasonIds.length) {
        await client.query(`DELETE FROM pricing_seasons WHERE NOT (id = ANY($1::bigint[]))`, [
          seasonIds,
        ]);
      } else {
        await client.query(`DELETE FROM pricing_seasons`);
      }

      const extraIds = (snapshot.extras ?? []).map((r) => Number(r.id)).filter(Boolean);
      if (extraIds.length) {
        await client.query(`DELETE FROM pricing_extras WHERE NOT (id = ANY($1::bigint[]))`, [
          extraIds,
        ]);
      } else {
        await client.query(`DELETE FROM pricing_extras`);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function withPricingConfig<T>(
  fn: (snapshot: PricingConfigSnapshot) => Promise<T>
): Promise<T> {
  const snapshot = await snapshotPricingConfig();
  try {
    return await fn(snapshot);
  } finally {
    await restorePricingConfig(snapshot);
  }
}

/** Bump hotel_delivery global fee amount (for MONEY-012). Returns previous amount. */
export async function bumpHotelDeliveryFee(delta = 100): Promise<{ before: number; after: number }> {
  return withDb(async (client) => {
    const current = await client.query(
      `SELECT amount FROM pricing_global_fees WHERE fee_key = 'hotel_delivery'`
    );
    const before = Number(current.rows[0]?.amount ?? 0);
    const after = before + delta;
    await client.query(
      `
      UPDATE pricing_global_fees
      SET amount = $1, updated_at = NOW()
      WHERE fee_key = 'hotel_delivery'
      `,
      [after]
    );
    return { before, after };
  });
}

/**
 * Bump the first active season adj_value (percent or absolute).
 * Creates a year-round percent season if none exist.
 */
export async function bumpSeasonSurcharge(
  delta = 50
): Promise<{ before: number; after: number; seasonId: number }> {
  return withDb(async (client) => {
    const existing = await client.query(
      `SELECT id, adj_value, adj_type FROM pricing_seasons WHERE active = TRUE ORDER BY id LIMIT 1`
    );
    if (existing.rows[0]) {
      const before = Number(existing.rows[0].adj_value ?? 0);
      const after = before + delta;
      await client.query(
        `UPDATE pricing_seasons SET adj_value = $2, updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id, after]
      );
      return { before, after, seasonId: Number(existing.rows[0].id) };
    }
    const inserted = await client.query(
      `
      INSERT INTO pricing_seasons (
        name, start_month, start_day, end_month, end_day, adj_type, adj_value, active
      ) VALUES ('E2E Season', 1, 1, 12, 31, 'percent', $1, TRUE)
      RETURNING id, adj_value
      `,
      [delta]
    );
    return {
      before: 0,
      after: Number(inserted.rows[0].adj_value),
      seasonId: Number(inserted.rows[0].id),
    };
  });
}

/** Bump the first weekend rule adj_value (creates one if missing). */
export async function bumpWeekendSurcharge(
  delta = 40
): Promise<{ before: number; after: number; ruleId: number }> {
  return withDb(async (client) => {
    const existing = await client.query(
      `SELECT id, adj_value FROM pricing_weekend_rules WHERE active = TRUE ORDER BY id LIMIT 1`
    );
    if (existing.rows[0]) {
      const before = Number(existing.rows[0].adj_value ?? 0);
      const after = before + delta;
      await client.query(
        `UPDATE pricing_weekend_rules SET adj_value = $2, updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id, after]
      );
      return { before, after, ruleId: Number(existing.rows[0].id) };
    }
    const inserted = await client.query(
      `
      INSERT INTO pricing_weekend_rules (name, weekdays, adj_type, adj_value, active)
      VALUES ('E2E Weekend', ARRAY[5,6,7], 'percent', $1, TRUE)
      RETURNING id, adj_value
      `,
      [delta]
    );
    return {
      before: 0,
      after: Number(inserted.rows[0].adj_value),
      ruleId: Number(inserted.rows[0].id),
    };
  });
}
