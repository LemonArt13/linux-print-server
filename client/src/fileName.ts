export function displayFileName(name: string): string {
  if (!/[ÐÑ]/.test(name)) return name;
  try {
    const bytes = Uint8Array.from(name, (character: string) => character.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded || name;
  } catch {
    return name;
  }
}
