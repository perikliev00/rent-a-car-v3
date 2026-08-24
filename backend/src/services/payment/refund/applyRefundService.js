const reservationRepository = require('../../../repositories/reservationRepository');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { runWithTransaction } = require('../../../db/transaction');
const { canTransition } = require('../../../domain/reservationStatus');
const { logSystemAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const { refundError } = require('./refundErrors');

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
  const run = async (tx) => {
    const current = await refundOpSql.findActiveByReservationId(reservationId, tx);
    const op = current || refundOperation;
    if (!op) {
      throw refundError('REFUND_NOT_FOUND', 'Refund operation not found.', 404);
    }
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

    if (reservation.status === 'refunded') {
      return {
        status: 'succeeded',
        refundOperation: updatedOp,
        reservation,
        applied: true,
        domainApplied: true,
      };
    }

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
