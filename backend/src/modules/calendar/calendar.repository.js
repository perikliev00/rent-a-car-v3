const { mapTask } = require('./repository/calendarTaskMapper');
const {
  listCarsForCalendar,
  listInsuranceWarnings,
} = require('./repository/calendarCarQuery');
const {
  listReservationsInRange,
  findReservationById,
  getDayReservationSections,
} = require('./repository/calendarReservationQuery');
const {
  listManualBlocksInRange,
  findBlockById,
  createManualBlock,
  updateManualBlock,
  deleteManualBlock,
} = require('./repository/calendarBlockRepository');
const {
  listTasksInRange,
  listTasks,
  findTaskById,
  hasAssignedTask,
  createTask,
  updateTaskStatus,
  updateTaskSchedule,
  updateTask,
  deleteTask,
  listAssignedCarIdsForUser,
} = require('./repository/calendarTaskRepository');

module.exports = {
  mapTask,
  listCarsForCalendar,
  listReservationsInRange,
  listManualBlocksInRange,
  listTasksInRange,
  listTasks,
  findTaskById,
  hasAssignedTask,
  createTask,
  updateTaskStatus,
  updateTaskSchedule,
  updateTask,
  deleteTask,
  findBlockById,
  createManualBlock,
  updateManualBlock,
  deleteManualBlock,
  findReservationById,
  listAssignedCarIdsForUser,
  getDayReservationSections,
  listInsuranceWarnings,
};
