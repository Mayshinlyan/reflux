import { deleteAllPhotos, deletePhoto, photoUri, savePhoto } from '../photoStore';

const mockCreate = jest.fn();
const mockCopy = jest.fn();
const mockDelete = jest.fn();
let mockExists = true;

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc' },
  Directory: class {
    uri = 'file:///doc/photos';
    create(options: unknown) {
      mockCreate(options);
    }
    get exists() {
      return mockExists;
    }
    delete() {
      mockDelete('photos-dir');
    }
  },
  File: class {
    uri: string;
    constructor(base: unknown, name?: string) {
      const root = typeof base === 'string' ? base : (base as { uri: string }).uri;
      this.uri = name ? `${root}/${name}` : root;
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
  it('copies into the photos folder and returns a path relative to the documents folder', () => {
    const stored = savePhoto('file:///cache/out.jpg');

    expect(mockCreate).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(stored).toMatch(/^photos\/.+\.jpg$/);
    expect(mockCopy).toHaveBeenCalledWith(
      'file:///cache/out.jpg',
      expect.objectContaining({ uri: `file:///doc/${stored}` }),
    );
  });

  it('resolves a stored path against the documents folder', () => {
    expect(photoUri('photos/x.jpg')).toBe('file:///doc/photos/x.jpg');
  });

  it('moves an older absolute address, with a container id that has since changed, to the current folder', () => {
    expect(photoUri('file:///var/mobile/Containers/Data/Application/OLD-ID/Documents/photos/x.jpg')).toBe(
      'file:///doc/photos/x.jpg',
    );
  });

  it('gives every photo its own name', () => {
    expect(savePhoto('file:///a.jpg')).not.toBe(savePhoto('file:///a.jpg'));
  });

  it('deletes an existing photo and ignores a missing one', () => {
    deletePhoto('photos/x.jpg');
    expect(mockDelete).toHaveBeenCalledWith('file:///doc/photos/x.jpg');

    mockDelete.mockClear();
    mockExists = false;
    deletePhoto('photos/gone.jpg');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('removes the whole photos folder when it exists, and ignores a missing one', () => {
    deleteAllPhotos();
    expect(mockDelete).toHaveBeenCalledWith('photos-dir');

    mockDelete.mockClear();
    mockExists = false;
    deleteAllPhotos();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
