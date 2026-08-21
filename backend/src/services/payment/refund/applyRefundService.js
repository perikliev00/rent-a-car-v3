const reservationRepository = require('../../../repositories/reservationRepository');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { runWithTransaction } = require('../../../db/transaction');
const { refundError } = require('./resolvePaymentIntent');

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

    const updatedOp = await refundOpSql.updateRefundOperation(
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

    const reservation = await reservationRepository.findById(reservationId, tx);
    if (!reservation) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    let resultReservation = reservation;
    if (reservation.status !== 'refunded') {
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
      resultReservation = changed.reservation;
    }

    return {
      status: 'succeeded',
      refundOperation: updatedOp,
      reservation: resultReservation,
      applied: true,
    };
  };

  if (client) {
    return run(client);
  }
  return runWithTransaction(run);
}

module.exports = {
  applySucceededRefund,
};
