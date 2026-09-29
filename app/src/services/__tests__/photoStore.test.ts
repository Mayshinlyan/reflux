import { deletePhoto, savePhoto } from '../photoStore';

const mockCreate = jest.fn();
const mockCopy = jest.fn();
const mockDelete = jest.fn();
let mockExists = true;

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc' },
  Directory: class {
    create(options: unknown) {
      mockCreate(options);
    }
  },
  File: class {
    uri: string;
    constructor(base: unknown, name?: string) {
      this.uri = name ? `file:///doc/photos/${name}` : (base as string);
    }
    copy(destination: unknown) {
      mockCopy(this.uri, destination);
    }
    get exists() {
      return mockExists;
    }
    delete() {
      mockDelete(this.uri);
    }
  },
}));

beforeEach(() => {
  mockCreate.mockClear();
  mockCopy.mockClear();
  mockDelete.mockClear();
  mockExists = true;
});

describe('photoStore', () => {
  it('copies into the photos folder and returns the stored uri', () => {
    const stored = savePhoto('file:///cache/out.jpg');

    expect(mockCreate).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(stored).toMatch(/^file:\/\/\/doc\/photos\/.+\.jpg$/);
    expect(mockCopy).toHaveBeenCalledWith('file:///cache/out.jpg', expect.objectContaining({ uri: stored }));
  });

  it('gives every photo its own name', () => {
    expect(savePhoto('file:///a.jpg')).not.toBe(savePhoto('file:///a.jpg'));
  });

  it('deletes an existing photo and ignores a missing one', () => {
    deletePhoto('file:///doc/photos/x.jpg');
    expect(mockDelete).toHaveBeenCalledWith('file:///doc/photos/x.jpg');

    mockDelete.mockClear();
    mockExists = false;
    deletePhoto('file:///doc/photos/gone.jpg');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
