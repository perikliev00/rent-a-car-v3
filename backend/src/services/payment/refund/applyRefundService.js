/**
 * Apply a succeeded Stripe refund to the local ledger and reservation domain.
 * Idempotent: re-entry when the op or reservation is already refunded is a no-op.
 * If status cannot transition to refunded, marks the op and may route to manual_review.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
// Require the '../../sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../reservation/reservationStatusService');
// Destructure object properties into local variables.
const { runWithTransaction } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { canTransition } = require('../../../domain/reservationStatus');
// Destructure object properties into local variables.
const { logSystemAction } = require('../../admin/adminAuditService');
// Require the '../../../utils/logger' module as logger.
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
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
    // Contribute this line to the enclosing declaration or statement.
    refundOperation,
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Update reason with the right-hand side value.
    reason = null,
    // Update actor with the right-hand side value.
    actor = { type: 'system' },
    // Update stripeRefund with the right-hand side value.
    stripeRefund = null,
  },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  /**
   * Transaction body: mark op succeeded, then transition reservation → refunded.
   * @param {object} tx
   * @returns {Promise<object>}
   */
  const run = async (tx) => {
    // Prefer the latest active op row over the caller snapshot (concurrent webhooks).
    const current = await refundOpSql.findActiveByReservationId(reservationId, tx);
    // Create the op constant.
    const op = current || refundOperation;
    // Evaluate the condition and enter the branch when it is true.
    if (!op) {
      // Throw an error to stop the current control flow.
      throw refundError('REFUND_NOT_FOUND', 'Refund operation not found.', 404);
    }
    // Idempotent: op already succeeded — return without mutating domain again.
    if (op.status === 'succeeded') {
      // Create the reservation constant.
      const reservation = await reservationRepository.findById(reservationId, tx);
      // Return the resulting value to the caller.
      return {
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: op,
        // Contribute this line to the enclosing declaration or statement.
        reservation,
        // Provide the applied field value.
        applied: false,
      };
    }

    // Initialize the mutable updated op variable.
    let updatedOp = await refundOpSql.updateRefundOperation(
      // Contribute this line to the enclosing declaration or statement.
      op.id,
      {
        // Provide the status field value.
        status: 'succeeded',
        // Provide the stripe refund id field value.
        stripeRefundId: stripeRefund?.id || op.stripeRefundId,
        // Provide the stripe raw status field value.
        stripeRawStatus: stripeRefund?.status || 'succeeded',
        // Provide the failure code field value.
        failureCode: null,
        // Provide the failure message field value.
        failureMessage: null,
      },
      // Reference the identifier used by the enclosing expression.
      tx
    );

    // Update lost the race (succeeded guard) — re-read and treat as idempotent success.
    if (!updatedOp) {
      // Store the awaited result in updatedOp.
      updatedOp = await refundOpSql.findById(op.id, tx);
      // Evaluate the condition and enter the branch when it is true.
      if (updatedOp?.status === 'succeeded') {
        // Create the reservation constant.
        const reservation = await reservationRepository.findById(reservationId, tx);
        // Return the resulting value to the caller.
        return {
          // Provide the status field value.
          status: 'succeeded',
          // Provide the refund operation field value.
          refundOperation: updatedOp,
          // Contribute this line to the enclosing declaration or statement.
          reservation,
          // Provide the applied field value.
          applied: false,
        };
      }
      // Throw an error to stop the current control flow.
      throw refundError('REFUND_NOT_FOUND', 'Refund operation not found.', 404);
    }

    // Create the reservation constant.
    const reservation = await reservationRepository.findById(reservationId, tx);
    // Evaluate the condition and enter the branch when it is true.
    if (!reservation) {
      // Throw an error to stop the current control flow.
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    // Domain already refunded — ledger update was the remaining work.
    if (reservation.status === 'refunded') {
      // Return the resulting value to the caller.
      return {
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: updatedOp,
        // Contribute this line to the enclosing declaration or statement.
        reservation,
        // Provide the applied field value.
        applied: true,
        // Provide the domain applied field value.
        domainApplied: true,
      };
    }

    // Transition reservation → refunded; invalid transitions escalate to manual_review.
    try {
      // Create the changed constant.
      const changed = await changeStatus({
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Provide the new status field value.
        newStatus: 'refunded',
        // Provide the reason field value.
        reason: reason || 'stripe_refund_succeeded',
        // Contribute this line to the enclosing declaration or statement.
        actor,
        // Provide the metadata field value.
        metadata: {
          // Provide the source field value.
          source: 'refund_service',
          // Provide the refund operation id field value.
          refundOperationId: updatedOp.id,
          // Provide the stripe refund id field value.
          stripeRefundId: updatedOp.stripeRefundId,
        },
        // Provide the client field value.
        client: tx,
      });
      // Return the resulting value to the caller.
      return {
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: updatedOp,
        // Provide the reservation field value.
        reservation: changed.reservation,
        // Provide the applied field value.
        applied: true,
        // Provide the domain applied field value.
        domainApplied: true,
      };
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err.code !== 'INVALID_STATUS_TRANSITION') {
        // Throw an error to stop the current control flow.
        throw err;
      }

      // Money refunded at Stripe but domain cannot accept refunded — flag for operators.
      const fromStatus = err.fromStatus || reservation.status;
      // Store the awaited result in updatedOp.
      updatedOp = await refundOpSql.updateRefundOperation(
        // Contribute this line to the enclosing declaration or statement.
        updatedOp.id,
        {
          // Provide the failure code field value.
          failureCode: 'DOMAIN_TRANSITION_FAILED',
          // Provide the failure message field value.
          failureMessage: `${fromStatus} → refunded`,
        },
        // Reference the identifier used by the enclosing expression.
        tx
      );

      // Initialize the mutable result reservation variable.
      let resultReservation = reservation;
      // Evaluate the condition and enter the branch when it is true.
      if (canTransition(fromStatus, 'manual_review')) {
        // Start a try block for operations that may fail.
        try {
          // Create the reviewed constant.
          const reviewed = await changeStatus({
            // Contribute this line to the enclosing declaration or statement.
            reservationId,
            // Provide the new status field value.
            newStatus: 'manual_review',
            // Provide the reason field value.
            reason: 'refund_domain_transition_failed',
            // Contribute this line to the enclosing declaration or statement.
            actor,
            // Provide the metadata field value.
            metadata: {
              // Provide the source field value.
              source: 'refund_service',
              // Provide the refund operation id field value.
              refundOperationId: updatedOp.id,
              // Provide the stripe refund id field value.
              stripeRefundId: updatedOp.stripeRefundId,
              // Provide the domain transition failed field value.
              domainTransitionFailed: true,
            },
            // Provide the client field value.
            client: tx,
          });
          // Update resultReservation with the right-hand side value.
          resultReservation = reviewed.reservation;
        // Continue the surrounding logic with this statement.
        } catch (reviewErr) {
          // Call logger.warn to perform this step.
          logger.warn(
            // Contribute this line to the enclosing declaration or statement.
            { err: reviewErr, reservationId, fromStatus },
            // Supply the literal value used by the enclosing expression.
            'Could not move reservation to manual_review after refund domain transition failed'
          );
        }
      }

      // Return the resulting value to the caller.
      return {
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: updatedOp,
        // Provide the reservation field value.
        reservation: resultReservation,
        // Provide the applied field value.
        applied: true,
        // Provide the domain applied field value.
        domainApplied: false,
        // Provide the needs review field value.
        needsReview: true,
        // Contribute this line to the enclosing declaration or statement.
        fromStatus,
      };
    }
  };

  // Create the result constant.
  const result = client ? await run(client) : await runWithTransaction(run);

  // Evaluate the condition and enter the branch when it is true.
  if (result.needsReview) {
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await logSystemAction({
        // Provide the action field value.
        action: 'system.refund_domain_transition_failed',
        // Provide the entity type field value.
        entityType: 'reservation',
        // Provide the entity id field value.
        entityId: reservationId,
        // Provide the metadata field value.
        metadata: {
          // Provide the refund operation id field value.
          refundOperationId: result.refundOperation?.id,
          // Provide the from status field value.
          fromStatus: result.fromStatus,
          // Provide the stripe refund id field value.
          stripeRefundId: stripeRefund?.id || result.refundOperation?.stripeRefundId,
        },
      });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.error to perform this step.
      logger.error(
        // Contribute this line to the enclosing declaration or statement.
        { err, reservationId, context: 'applySucceededRefund.domainTransitionFailed' },
        // Supply the literal value used by the enclosing expression.
        'Failed to audit refund domain transition failure'
      );
    }
  }

  // Return the resulting value to the caller.
  return result;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  applySucceededRefund,
};
