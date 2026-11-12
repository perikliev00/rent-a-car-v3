/**
 * Calendar HTTP controller facade.
 *
 * Re-exports handlers from query / manual-event / task / mutation controllers
 * so routes stay on a single require path.
 */

const {
  // Contribute this line to the enclosing declaration or statement.
  getEvents,
  // Contribute this line to the enclosing declaration or statement.
  getDay,
  // Contribute this line to the enclosing declaration or statement.
  getCar,
  // Contribute this line to the enclosing declaration or statement.
  getAvailability,
  // Contribute this line to the enclosing declaration or statement.
  getConflicts,
  // Contribute this line to the enclosing declaration or statement.
  getEventDetails,
// Continue the surrounding logic with this statement.
} = require('./controller/calendarQueryController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualEvent,
// Continue the surrounding logic with this statement.
} = require('./controller/calendarManualEventController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaff,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
// Continue the surrounding logic with this statement.
} = require('./controller/calendarTaskController');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  moveEvent,
  // Contribute this line to the enclosing declaration or statement.
  resizeEvent,
  // Contribute this line to the enclosing declaration or statement.
  cancelReservation,
// Continue the surrounding logic with this statement.
} = require('./controller/calendarMutationController');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getEvents,
  // Contribute this line to the enclosing declaration or statement.
  getDay,
  // Contribute this line to the enclosing declaration or statement.
  getCar,
  // Contribute this line to the enclosing declaration or statement.
  getAvailability,
  // Contribute this line to the enclosing declaration or statement.
  getConflicts,
  // Contribute this line to the enclosing declaration or statement.
  getEventDetails,
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaff,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  moveEvent,
  // Contribute this line to the enclosing declaration or statement.
  resizeEvent,
  // Contribute this line to the enclosing declaration or statement.
  cancelReservation,
};
