/**
 * Calendar application service facade.
 *
 * Delegates to query, manual-block, task, move, and event-details services
 * so controllers depend on one module.
 */

const {
  // Contribute this line to the enclosing declaration or statement.
  getEvents,
  // Contribute this line to the enclosing declaration or statement.
  getDay,
  // Contribute this line to the enclosing declaration or statement.
  getCarTimeline,
  // Contribute this line to the enclosing declaration or statement.
  getAvailability,
  // Contribute this line to the enclosing declaration or statement.
  getConflicts,
// Continue the surrounding logic with this statement.
} = require('./calendarQueryService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualEvent,
// Continue the surrounding logic with this statement.
} = require('./manualBlockService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaff,
// Continue the surrounding logic with this statement.
} = require('./calendarTaskService');
// Destructure object properties into local variables.
const { moveOrResizeEvent } = require('./calendarMoveService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getEventDetails,
  // Contribute this line to the enclosing declaration or statement.
  cancelReservationFromCalendar,
// Continue the surrounding logic with this statement.
} = require('./calendarEventDetailsService');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getEvents,
  // Contribute this line to the enclosing declaration or statement.
  getDay,
  // Contribute this line to the enclosing declaration or statement.
  getCarTimeline,
  // Contribute this line to the enclosing declaration or statement.
  getAvailability,
  // Contribute this line to the enclosing declaration or statement.
  getConflicts,
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  moveOrResizeEvent,
  // Contribute this line to the enclosing declaration or statement.
  getEventDetails,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaff,
  // Contribute this line to the enclosing declaration or statement.
  cancelReservationFromCalendar,
};
