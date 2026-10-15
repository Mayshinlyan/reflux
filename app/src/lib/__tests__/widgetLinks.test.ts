import { readFileSync } from 'fs';
import { join } from 'path';

import {
  isQuickLogAllowed,
  newWidgetToken,
  pickWidgetFoods,
  quickLogLink,
  SNAP_FOOD_LINK,
  WIDGET_FOOD_COUNT,
} from '../widgetLinks';

describe('pickWidgetFoods', () => {
  const foods = ['Oatmeal', 'Chicken', 'Smoothie', 'Toast', 'Soup'].map((mealName, index) => ({
    id: index + 1,
    mealName,
  }));

  it('keeps the first few saved foods, in order, as id and name', () => {
    expect(pickWidgetFoods(foods)).toEqual([
      { id: 1, name: 'Oatmeal' },
      { id: 2, name: 'Chicken' },
      { id: 3, name: 'Smoothie' },
    ]);
    expect(pickWidgetFoods(foods)).toHaveLength(WIDGET_FOOD_COUNT);
  });

  it('shows fewer when fewer are saved, and none for none', () => {
    expect(pickWidgetFoods(foods.slice(0, 1))).toEqual([{ id: 1, name: 'Oatmeal' }]);
    expect(pickWidgetFoods([])).toEqual([]);
  });
});

describe('isQuickLogAllowed', () => {
  it('needs the token the phone made', () => {
    expect(isQuickLogAllowed('abc', 'abc')).toBe(true);
    expect(isQuickLogAllowed('abd', 'abc')).toBe(false);
    expect(isQuickLogAllowed(undefined, 'abc')).toBe(false);
  });

  it('never allows anything before a token exists', () => {
    expect(isQuickLogAllowed('', '')).toBe(false);
    expect(isQuickLogAllowed(undefined, '')).toBe(false);
  });
});

describe('newWidgetToken', () => {
  it('is 32 hex characters and differs each time', () => {
    const first = newWidgetToken();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(newWidgetToken()).not.toBe(first);
  });

  it('still works where the secure random source is missing', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(newWidgetToken(() => 0.5)).toBe('80'.repeat(16));
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});

describe('the widget file', () => {
  // The widget runs in its own runtime and can't import these, so it spells the links out. Keep them the same.
  const source = readFileSync(join(__dirname, '../../widgets/FoodWidget.tsx'), 'utf8');

  it('opens the camera with the same link as SNAP_FOOD_LINK', () => {
    expect(source).toContain(`'${SNAP_FOOD_LINK}'`);
  });

  it('builds the saved-food link the same way as quickLogLink', () => {
    const template = quickLogLink(0, 'TOKEN').replace('0', '${food.id}').replace('TOKEN', '${props.token}');
    expect(source).toContain('`' + template + '`');
  });
});
