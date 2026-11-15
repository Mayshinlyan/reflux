// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_unchecked_meals.sql';
import m0002 from './0002_my_foods.sql';
import m0003 from './0003_good_verdict.sql';
import m0004 from './0004_tearful_black_queen.sql';
import m0005 from './0005_nosy_saracen.sql';
import m0006 from './0006_food_details.sql';
import m0007 from './0007_saved_symptoms.sql';
import m0008 from './0008_saved_kind_zone.sql';
import m0009 from './0009_kitchen.sql';
import m0010 from './0010_fridge.sql';
import m0011 from './0011_meal_plan.sql';
import m0012 from './0012_plan_checks.sql';
import m0013 from './0013_plan_prep.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009,
m0010,
m0011,
m0012,
m0013
    }
  }
  