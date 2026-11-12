// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  insertLinkedBooking,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
// Continue the surrounding logic with this statement.
} = require('./helpers/dbFixtures');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getSofiaIsoDateString,
  // Contribute this line to the enclosing declaration or statement.
  addSofiaCalendarDays,
  // Contribute this line to the enclosing declaration or statement.
  formatSofiaIsoDateFromParts,
  // Contribute this line to the enclosing declaration or statement.
  parseSofiaDate,
// Continue the surrounding logic with this statement.
} = require('../../src/utils/date/timezone');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Define the toSofiaIso function.
function toSofiaIso(date, time) {
  // Create the parsed constant.
  const parsed = parseSofiaDate(date, time);
  // Evaluate the condition and enter the branch when it is true.
  if (!parsed) {
    // Throw an error to stop the current control flow.
    throw new Error(`toSofiaIso: invalid Sofia date/time ${date} ${time}`);
  }
  // Return the resulting value to the caller.
  return parsed.toISOString();
}

// Define the assertDateBlockCovers function.
function assertDateBlockCovers(blocks, startIso, endIso) {
  // Create the covers constant.
  const covers = blocks.some((block) => {
    // Create the block start day constant.
    const blockStartDay = getSofiaIsoDateString(new Date(block.start_date));
    // Create the block end day constant.
    const blockEndDay = getSofiaIsoDateString(new Date(block.end_date));
    // Return the resulting value to the caller.
    return blockStartDay <= startIso && blockEndDay >= endIso;
  });
  // Assert that the value matches the intended expectation.
  expect(covers).toBe(true);
}

// Define the async function resizeCalendarEvent.
async function resizeCalendarEvent(admin, reservationId, body) {
  // Return the resulting value to the caller.
  return withCsrf(
    // Contribute this line to the enclosing declaration or statement.
    admin,
    // Call admin.patch to perform this step.
    admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/resize`)
  // Continue the surrounding logic with this statement.
  ).send({
    // Provide the start field value.
    start: body.start,
    // Provide the end field value.
    end: body.end,
    // Provide the car id field value.
    carId: body.carId != null ? Number(body.carId) : undefined,
    // Provide the force field value.
    force: body.force ?? false,
  });
}

// Call describeIf to perform this step.
describeIf('ADMIN-008: calendarResizeReservation', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Cal Resize Car', price: 55 });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('API resize extends return date and increases total price', async () => {
    // Create the pickup date constant.
    const pickupDate = '2031-06-01';
    // Create the return date constant.
    const returnDate = '2031-06-04';
    // Create the pickup time constant.
    const pickupTime = '10:00';
    // Create the return time constant.
    const returnTime = '10:00';

    // Create the seeded constant.
    const seeded = await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the with block field value.
      withBlock: true,
      // Contribute this line to the enclosing declaration or statement.
      pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      returnDate,
      // Contribute this line to the enclosing declaration or statement.
      pickupTime,
      // Contribute this line to the enclosing declaration or statement.
      returnTime,
      // Provide the day price field value.
      dayPrice: 55,
      // Provide the guest field value.
      guest: { email: `cal-resize-${Date.now()}@example.com`, fullName: 'Cal Resize Guest' },
    });

    // Create the before constant.
    const before = await getReservationById(seeded.reservationId);
    // Create the total before constant.
    const totalBefore = Number(before.total_price);

    // Create the longer return constant.
    const longerReturn = formatSofiaIsoDateFromParts(
      // Call addSofiaCalendarDays to perform this step.
      addSofiaCalendarDays(parseSofiaDate(returnDate, '00:00'), 2)
    );

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the result constant.
    const result = await resizeCalendarEvent(admin, seeded.reservationId, {
      // Provide the start field value.
      start: toSofiaIso(pickupDate, pickupTime),
      // Provide the end field value.
      end: toSofiaIso(longerReturn, returnTime),
      // Contribute this line to the enclosing declaration or statement.
      carId,
    });
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe(200);

    // Create the after constant.
    const after = await getReservationById(seeded.reservationId);
    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(new Date(after.pickup_date))).toBe(pickupDate);
    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(longerReturn);
    // Assert that the value matches the intended expectation.
    expect(Number(after.total_price)).toBeGreaterThan(totalBefore);
    // Create the snapshot total constant.
    const snapshotTotal = Number(after.price_snapshot?.totalPrice ?? 0);
    // Assert that the value matches the intended expectation.
    expect(snapshotTotal).toBe(Number(after.total_price));
    // Assert that the value matches the intended expectation.
    expect(snapshotTotal).toBeGreaterThan(totalBefore);

    // Call assertDateBlockCovers to perform this step.
    assertDateBlockCovers(await getDateBlocksForCar(carId), pickupDate, longerReturn);
  });

  // Define a single test case and its expectations.
  test('API resize shorter stay decreases total price', async () => {
    // Create the pickup date constant.
    const pickupDate = '2031-07-01';
    // Create the return date constant.
    const returnDate = '2031-07-06';
    // Create the pickup time constant.
    const pickupTime = '10:00';
    // Create the return time constant.
    const returnTime = '10:00';

    // Create the seeded constant.
    const seeded = await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the with block field value.
      withBlock: true,
      // Contribute this line to the enclosing declaration or statement.
      pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      returnDate,
      // Contribute this line to the enclosing declaration or statement.
      pickupTime,
      // Contribute this line to the enclosing declaration or statement.
      returnTime,
      // Provide the day price field value.
      dayPrice: 55,
      // Provide the guest field value.
      guest: {
        // Provide the email field value.
        email: `cal-resize-short-${Date.now()}@example.com`,
        // Provide the full name field value.
        fullName: 'Cal Resize Short',
      },
    });

    // Create the before constant.
    const before = await getReservationById(seeded.reservationId);
    // Create the total before constant.
    const totalBefore = Number(before.total_price);

    // Create the shorter return constant.
    const shorterReturn = formatSofiaIsoDateFromParts(
      // Call addSofiaCalendarDays to perform this step.
      addSofiaCalendarDays(parseSofiaDate(pickupDate, '00:00'), 2)
    );

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the result constant.
    const result = await resizeCalendarEvent(admin, seeded.reservationId, {
      // Provide the start field value.
      start: toSofiaIso(pickupDate, pickupTime),
      // Provide the end field value.
      end: toSofiaIso(shorterReturn, returnTime),
      // Contribute this line to the enclosing declaration or statement.
      carId,
    });
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe(200);

    // Create the after constant.
    const after = await getReservationById(seeded.reservationId);
    // Assert that the value matches the intended expectation.
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(shorterReturn);
    // Assert that the value matches the intended expectation.
    expect(Number(after.total_price)).toBeLessThan(totalBefore);
    // Call assertDateBlockCovers to perform this step.
    assertDateBlockCovers(await getDateBlocksForCar(carId), pickupDate, shorterReturn);
  });
});
