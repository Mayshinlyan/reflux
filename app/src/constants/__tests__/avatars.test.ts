import { AVATARS, avatarDef } from '../avatars';

describe('avatars', () => {
  it('has eight', () => {
    expect(AVATARS).toHaveLength(8);
  });

  it('gives every avatar its own tint and its own icon', () => {
    expect(new Set(AVATARS.map((a) => a.tint)).size).toBe(AVATARS.length);
    const icons = AVATARS.filter((a) => a.icon).map((a) => a.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('falls back to the initial for an unknown key', () => {
    expect(avatarDef('nope' as never).key).toBe('initial');
  });
});
