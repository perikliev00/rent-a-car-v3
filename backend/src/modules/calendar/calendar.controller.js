const {
  getEvents,
  getDay,
  getCar,
  getAvailability,
  getConflicts,
  getEventDetails,
} = require('./controller/calendarQueryController');
const {
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
} = require('./controller/calendarManualEventController');
const {
  createTask,
  listTasks,
  listAssignableStaff,
  updateTask,
  deleteTask,
  updateTaskStatus,
} = require('./controller/calendarTaskController');
const {
  moveEvent,
  resizeEvent,
  cancelReservation,
} = require('./controller/calendarMutationController');

module.exports = {
  getEvents,
  getDay,
  getCar,
  getAvailability,
  getConflicts,
  getEventDetails,
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
  createTask,
  listTasks,
  listAssignableStaff,
  updateTask,
  deleteTask,
  updateTaskStatus,
  moveEvent,
  resizeEvent,
  cancelReservation,
};
