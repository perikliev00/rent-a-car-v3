/**
 * Calendar repository facade over car, reservation, block, and task SQL modules.
 */

const { mapTask } = require('./repository/calendarTaskMapper');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listCarsForCalendar,
  // Contribute this line to the enclosing declaration or statement.
  listInsuranceWarnings,
// Continue the surrounding logic with this statement.
} = require('./repository/calendarCarQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listReservationsInRange,
  // Contribute this line to the enclosing declaration or statement.
  findReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getDayReservationSections,
// Continue the surrounding logic with this statement.
} = require('./repository/calendarReservationQuery');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listManualBlocksInRange,
  // Contribute this line to the enclosing declaration or statement.
  findBlockById,
  // Contribute this line to the enclosing declaration or statement.
  createManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  updateManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualBlock,
// Continue the surrounding logic with this statement.
} = require('./repository/calendarBlockRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listTasksInRange,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  findTaskById,
  // Contribute this line to the enclosing declaration or statement.
  hasAssignedTask,
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskSchedule,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  listAssignedCarIdsForUser,
// Continue the surrounding logic with this statement.
} = require('./repository/calendarTaskRepository');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapTask,
  // Contribute this line to the enclosing declaration or statement.
  listCarsForCalendar,
  // Contribute this line to the enclosing declaration or statement.
  listReservationsInRange,
  // Contribute this line to the enclosing declaration or statement.
  listManualBlocksInRange,
  // Contribute this line to the enclosing declaration or statement.
  listTasksInRange,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  findTaskById,
  // Contribute this line to the enclosing declaration or statement.
  hasAssignedTask,
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskSchedule,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  findBlockById,
  // Contribute this line to the enclosing declaration or statement.
  createManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  updateManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  findReservationById,
  // Contribute this line to the enclosing declaration or statement.
  listAssignedCarIdsForUser,
  // Contribute this line to the enclosing declaration or statement.
  getDayReservationSections,
  // Contribute this line to the enclosing declaration or statement.
  listInsuranceWarnings,
};
