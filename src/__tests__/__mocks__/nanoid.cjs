/**
 * CommonJS test stub for `nanoid`.
 *
 * nanoid v5 is ESM-only and is pulled in transitively by the @ai-sdk provider
 * packages (never imported directly by this project's source). Under Jest's
 * CommonJS runtime it triggers "Must use import to load ES Module", failing any
 * suite that touches the AI SDK. It is only used to generate opaque IDs, which
 * are irrelevant in tests (AI calls are mocked), so a lightweight stub is safe.
 *
 * Mapped via jest.config.cjs moduleNameMapper for `nanoid` and `nanoid/non-secure`.
 */
const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

function nanoid(size = 21) {
  let id = '';
  for (let i = 0; i < size; i++) {
    id += urlAlphabet[Math.floor(Math.random() * urlAlphabet.length)];
  }
  return id;
}

function customAlphabet(alphabet, defaultSize = 21) {
  return (size = defaultSize) => {
    let id = '';
    for (let i = 0; i < size; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
  };
}

function customRandom(alphabet, size, getRandom) {
  return () => {
    const bytes = getRandom(size);
    let id = '';
    for (let i = 0; i < size; i++) {
      id += alphabet[bytes[i] % alphabet.length];
    }
    return id;
  };
}

function random(bytes) {
  return new Uint8Array(bytes);
}

module.exports = { nanoid, customAlphabet, customRandom, urlAlphabet, random };
