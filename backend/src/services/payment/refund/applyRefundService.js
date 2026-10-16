/**
 * Apply a succeeded Stripe refund to the local ledger and reservation domain.
 * Idempotent: re-entry when the op or reservation is already refunded is a no-op.
 * If status cannot transition to refunded, marks the op and may route to manual_review.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { runWithTransaction } = require('../../../db/transaction');
const { canTransition } = require('../../../domain/reservationStatus');
const { logSystemAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const { refundError } = require('./refundErrors');

/**
 * Mark refund operation succeeded and transition reservation to refunded when possible.
 *
 * @param {object} params
 * @param {object} params.refundOperation
 * @param {string|number} params.reservationId
 * @param {string|null} [params.reason]
 * @param {object} [params.actor]
 * @param {object|null} [params.stripeRefund]
 * @param {object|null} [client] - Optional open DB client/transaction
 * @returns {Promise<object>}
 */
async function applySucceededRefund(
  {
    refundOperation,
    reservationId,
    reason = null,
    actor = { type: 'system' },
    stripeRefund = null,
  },
  client = null
) {
  /**
   * Transaction body: mark op succeeded, then transition reservation → refunded.
   * @param {object} tx
   * @returns {Promise<object>}
   */
  const run = async (tx) => {
    // Prefer the latest active op row over the caller snapshot (concurrent webhooks).
    const current = await refundOpSql.findActiveByReservationId(reservationId, tx);
    const op = current || refundOperation;
    if (!op) {
      throw refundError('REFUND_NOT_FOUND', 'Refund operation not found.', 404);
    }
    // Idempotent: op already succeeded — return without mutating domain again.
    if (op.status === 'succeeded') {
      const reservation = await reservationRepository.findById(reservationId, tx);
      return {
        status: 'succeeded',
        refundOperation: op,
        reservation,
        applied: false,
      };
    }

    let updatedOp = await refundOpSql.updateRefundOperation(
      op.id,
      {
        status: 'succeeded',
        stripeRefundId: stripeRefund?.id || op.stripeRefundId,
        stripeRawStatus: stripeRefund?.status || 'succeeded',
        failureCode: null,
        failureMessage: null,
      },
      tx
    );

    // Update lost the race (succeeded guard) — re-read and treat as idempotent success.
    if (!updatedOp) {
      updatedOp = await refundOpSql.findById(op.id, tx);
      if (updatedOp?.status === 'succeeded') {
        const reservation = await reservationRepository.findById(reservationId, tx);
        return {
          status: 'succeeded',
          refundOperation: updatedOp,
          reservation,
          applied: false,
        };
      }
      throw refundError('REFUND_NOT_FOUND', 'Refund operation not found.', 404);
    }

    const reservation = await reservationRepository.findById(reservationId, tx);
    if (!reservation) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    // Domain already refunded — ledger update was the remaining work.
    if (reservation.status === 'refunded') {
      return {
        status: 'succeeded',
        refundOperation: updatedOp,
        reservation,
        applied: true,
        domainApplied: true,
      };
    }

    // Transition reservation → refunded; invalid transitions escalate to manual_review.
    try {
      const changed = await changeStatus({
        reservationId,
        newStatus: 'refunded',
        reason: reason || 'stripe_refund_succeeded',
        actor,
        metadata: {
          source: 'refund_service',
          refundOperationId: updatedOp.id,
          stripeRefundId: updatedOp.stripeRefundId,
        },
        client: tx,
      });
      return {
        status: 'succeeded',
        refundOperation: updatedOp,
        reservation: changed.reservation,
        applied: true,
        domainApplied: true,
      };
    } catch (err) {
      if (err.code !== 'INVALID_STATUS_TRANSITION') {
        throw err;
      }

      // Money refunded at Stripe but domain cannot accept refunded — flag for operators.
      const fromStatus = err.fromStatus || reservation.status;
      updatedOp = await refundOpSql.updateRefundOperation(
        updatedOp.id,
        {
          failureCode: 'DOMAIN_TRANSITION_FAILED',
          failureMessage: `${fromStatus} → refunded`,
        },
        tx
      );

      let resultReservation = reservation;
      if (canTransition(fromStatus, 'manual_review')) {
        try {
          const reviewed = await changeStatus({
            reservationId,
            newStatus: 'manual_review',
            reason: 'refund_domain_transition_failed',
            actor,
            metadata: {
              source: 'refund_service',
              refundOperationId: updatedOp.id,
              stripeRefundId: updatedOp.stripeRefundId,
              domainTransitionFailed: true,
            },
            client: tx,
          });
          resultReservation = reviewed.reservation;
        } catch (reviewErr) {
          logger.warn(
            { err: reviewErr, reservationId, fromStatus },
            'Could not move reservation to manual_review after refund domain transition failed'
          );
        }
      }

      return {
        status: 'succeeded',
        refundOperation: updatedOp,
        reservation: resultReservation,
        applied: true,
        domainApplied: false,
        needsReview: true,
        fromStatus,
      };
    }
  };

  const result = client ? await run(client) : await runWithTransaction(run);

  if (result.needsReview) {
    // Protected block: isolate failure modes.
    try {
      await logSystemAction({
        action: 'system.refund_domain_transition_failed',
        entityType: 'reservation',
        entityId: reservationId,
        metadata: {
          refundOperationId: result.refundOperation?.id,
          fromStatus: result.fromStatus,
          stripeRefundId: stripeRefund?.id || result.refundOperation?.stripeRefundId,
        },
      });
    } catch (err) {
      logger.error(
        { err, reservationId, context: 'applySucceededRefund.domainTransitionFailed' },
        'Failed to audit refund domain transition failure'
      );
    }
  }

  return result;
}

module.exports = {
  applySucceededRefund,
};
