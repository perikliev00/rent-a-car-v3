-- Demo seed data (idempotent)

INSERT INTO categories (name)
VALUES
  ('Economy'),
  ('SUV'),
  ('Luxury'),
  ('Premium')
ON CONFLICT (name) DO NOTHING;

INSERT INTO cars (
  name,
  image,
  transmission,
  price,
  price_per_day,
  price_tier_1_3,
  price_tier_7_31,
  price_tier_31_plus,
  seats,
  fuel_type,
  availability,
  category_id
)
SELECT
  'Volkswagen Golf 7',
  '/images/demo/golf.jpg',
  'Manual',
  50.00,
  45.00,
  55.00,
  40.00,
  35.00,
  5,
  'Diesel',
  TRUE,
  c.id
FROM categories c
WHERE c.name = 'Economy'
  AND NOT EXISTS (SELECT 1 FROM cars WHERE name = 'Volkswagen Golf 7');

INSERT INTO cars (
  name,
  image,
  transmission,
  price,
  price_per_day,
  price_tier_1_3,
  price_tier_7_31,
  price_tier_31_plus,
  seats,
  fuel_type,
  availability,
  category_id
)
SELECT
  'BMW 320d',
  '/images/demo/bmw320.jpg',
  'Automatic',
  90.00,
  85.00,
  95.00,
  80.00,
  70.00,
  5,
  'Diesel',
  TRUE,
  c.id
FROM categories c
WHERE c.name = 'Luxury'
  AND NOT EXISTS (SELECT 1 FROM cars WHERE name = 'BMW 320d');

INSERT INTO cars (
  name,
  image,
  transmission,
  price,
  price_per_day,
  price_tier_1_3,
  price_tier_7_31,
  price_tier_31_plus,
  seats,
  fuel_type,
  availability,
  category_id
)
SELECT
  'Toyota RAV4',
  '/images/demo/rav4.jpg',
  'Automatic',
  75.00,
  70.00,
  80.00,
  65.00,
  60.00,
  5,
  'Petrol',
  TRUE,
  c.id
FROM categories c
WHERE c.name = 'SUV'
  AND NOT EXISTS (SELECT 1 FROM cars WHERE name = 'Toyota RAV4');

INSERT INTO cars (
  name,
  image,
  transmission,
  price,
  price_per_day,
  price_tier_1_3,
  price_tier_7_31,
  price_tier_31_plus,
  seats,
  fuel_type,
  availability,
  category_id
)
SELECT
  'Mercedes-Benz E-Class',
  '/images/demo/eclass.jpg',
  'Automatic',
  120.00,
  110.00,
  125.00,
  100.00,
  90.00,
  5,
  'Diesel',
  TRUE,
  c.id
FROM categories c
WHERE c.name = 'Premium'
  AND NOT EXISTS (SELECT 1 FROM cars WHERE name = 'Mercedes-Benz E-Class');

INSERT INTO cars (
  name,
  image,
  transmission,
  price,
  price_per_day,
  price_tier_1_3,
  price_tier_7_31,
  price_tier_31_plus,
  seats,
  fuel_type,
  availability,
  category_id
)
SELECT
  'Audi A4',
  '/images/demo/a4.jpg',
  'Automatic',
  95.00,
  90.00,
  100.00,
  85.00,
  75.00,
  5,
  'Petrol',
  TRUE,
  c.id
FROM categories c
WHERE c.name = 'Luxury'
  AND NOT EXISTS (SELECT 1 FROM cars WHERE name = 'Audi A4');

INSERT INTO contacts (name, email, phone, subject, message, status)
SELECT
  'Ivan Petrov',
  'ivan.petrov@example.com',
  '+359 888 111 222',
  'Airport pickup',
  'Can you deliver a car to Sofia Airport Terminal 2?',
  'new'
WHERE NOT EXISTS (
  SELECT 1 FROM contacts WHERE email = 'ivan.petrov@example.com' AND subject = 'Airport pickup'
);

INSERT INTO contacts (name, email, phone, subject, message, status)
SELECT
  'Maria Georgieva',
  'maria.georgieva@example.com',
  '+359 888 333 444',
  'Long-term rental',
  'I need a car for 3 weeks starting next month.',
  'ready'
WHERE NOT EXISTS (
  SELECT 1 FROM contacts WHERE email = 'maria.georgieva@example.com' AND subject = 'Long-term rental'
);

INSERT INTO contacts (name, email, phone, subject, message, status)
SELECT
  'Dimitar Stoyanov',
  'dimitar.stoyanov@example.com',
  NULL,
  'Insurance question',
  'Is full insurance included in the daily rate?',
  'done'
WHERE NOT EXISTS (
  SELECT 1 FROM contacts WHERE email = 'dimitar.stoyanov@example.com' AND subject = 'Insurance question'
);

INSERT INTO orders (
  car_id,
  pickup_date,
  pickup_time,
  return_date,
  return_time,
  pickup_location,
  return_location,
  rental_days,
  delivery_price,
  return_price,
  total_price,
  full_name,
  phone_number,
  email,
  address,
  hotel_name,
  status
)
SELECT
  c.id,
  '2030-06-10T10:00:00.000Z',
  '10:00',
  '2030-06-14T10:00:00.000Z',
  '10:00',
  'Sofia Office',
  'Sofia Office',
  4,
  0,
  0,
  320.00,
  'Demo Customer One',
  '+359 888 555 111',
  'customer1@example.com',
  '1 Vitosha Blvd, Sofia',
  NULL,
  'active'
FROM cars c
WHERE c.name = 'BMW 320d'
  AND NOT EXISTS (
    SELECT 1 FROM orders WHERE email = 'customer1@example.com' AND pickup_date = '2030-06-10T10:00:00.000Z'
  );

INSERT INTO orders (
  car_id,
  pickup_date,
  pickup_time,
  return_date,
  return_time,
  pickup_location,
  return_location,
  rental_days,
  delivery_price,
  return_price,
  total_price,
  full_name,
  phone_number,
  email,
  address,
  hotel_name,
  status
)
SELECT
  c.id,
  '2030-08-01T09:00:00.000Z',
  '09:00',
  '2030-08-05T18:00:00.000Z',
  '18:00',
  'Plovdiv Office',
  'Sofia Airport',
  4,
  25.00,
  35.00,
  315.00,
  'Demo Customer Two',
  '+359 888 555 222',
  'customer2@example.com',
  '15 Main St, Plovdiv',
  'Grand Hotel Plovdiv',
  'active'
FROM cars c
WHERE c.name = 'Toyota RAV4'
  AND NOT EXISTS (
    SELECT 1 FROM orders WHERE email = 'customer2@example.com' AND pickup_date = '2030-08-01T09:00:00.000Z'
  );
