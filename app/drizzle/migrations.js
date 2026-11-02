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
m0008
    }
  }
  