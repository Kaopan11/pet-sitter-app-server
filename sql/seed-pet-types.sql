INSERT INTO pet_types (name)
SELECT v.name
FROM (VALUES ('Dog'), ('Cat'), ('Bird'), ('Rabbit')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM pet_types WHERE LOWER(pet_types.name) = LOWER(v.name)
);
