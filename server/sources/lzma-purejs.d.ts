declare module 'lzma-purejs' {
  const lzma: { decompressFile(data: Uint8Array): ArrayLike<number> };
  export default lzma;
}
