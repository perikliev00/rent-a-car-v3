const {
  getEvents,
  getDay,
  getCarTimeline,
  getAvailability,
  getConflicts,
} = require('./calendarQueryService');
const {
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
} = require('./manualBlockService');
const {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  listTasks,
  listAssignableStaff,
} = require('./calendarTaskService');
const { moveOrResizeEvent } = require('./calendarMoveService');
const {
  getEventDetails,
  cancelReservationFromCalendar,
} = require('./calendarEventDetailsService');

module.exports = {
  getEvents,
  getDay,
  getCarTimeline,
  getAvailability,
  getConflicts,
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  moveOrResizeEvent,
  getEventDetails,
  listTasks,
  listAssignableStaff,
  cancelReservationFromCalendar,
};
