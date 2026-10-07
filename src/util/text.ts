// Words, for what's shown (a name, a line said): the first letter made a capital ("the tomb of morwen" → "The tomb of
// morwen").

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
